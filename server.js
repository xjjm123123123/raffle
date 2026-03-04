import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis';

const tokenCache = new Map();

async function getTenantAccessToken(appId, appSecret) {
  const cacheKey = `${appId}_${appSecret}`;
  
  const cached = tokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expireTime) {
    return cached.token;
  }

  const response = await fetch(`${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret })
  });

  const data = await response.json();
  
  if (data.code !== 0) {
    throw new Error(`获取 token 失败: ${data.msg}`);
  }

  tokenCache.set(cacheKey, {
    token: data.tenant_access_token,
    expireTime: Date.now() + (data.expire - 300) * 1000
  });
  
  return data.tenant_access_token;
}

function extractFieldValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (value.text) return value.text;
    if (Array.isArray(value)) {
      return value.map(v => typeof v === 'object' ? v.text || '' : v).join(', ');
    }
  }
  return String(value);
}

app.post('/api/activities', async (req, res) => {
  try {
    const { appId, appSecret, appToken, tableId, activityField } = req.body;
    const token = await getTenantAccessToken(appId, appSecret);
    
    const response = await fetch(
      `${FEISHU_API_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records?page_size=500`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    const data = await response.json();
    
    if (data.code !== 0) {
      return res.json({ success: false, message: data.msg, activities: [] });
    }
    
    const activitySet = new Set();
    (data.data?.items || []).forEach(item => {
      const activity = item.fields[activityField || '活动'];
      const activityText = extractFieldValue(activity);
      if (activityText) {
        activitySet.add(activityText);
      }
    });
    
    const activities = Array.from(activitySet).map((name, index) => ({
      id: String(index + 1),
      name
    }));
    
    res.json({ success: true, activities });
  } catch (error) {
    res.json({ success: false, message: error.message, activities: [] });
  }
});

app.post('/api/participants', async (req, res) => {
  try {
    const { appId, appSecret, appToken, tableId, activityName, nameField, activityField, wonField, whitelistField } = req.body;
    const token = await getTenantAccessToken(appId, appSecret);
    
    const body = {
      page_size: 500,
      filter: {
        conditions: [{
          field_name: wonField || '是否中奖',
          operator: 'is',
          value: [false]
        }],
        conjunction: 'and'
      }
    };
    
    if (activityName) {
      body.filter.conditions.push({
        field_name: activityField || '活动',
        operator: 'contains',
        value: [activityName]
      });
    }
    
    const response = await fetch(
      `${FEISHU_API_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records/search`,
      {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );
    
    const data = await response.json();
    
    if (data.code !== 0) {
      return res.json({ success: false, message: data.msg, participants: [] });
    }
    
    const participants = (data.data?.items || []).map(item => {
      const activityValue = extractFieldValue(item.fields[activityField || '活动']);
      if (activityName && activityValue !== activityName) {
        return null;
      }
      
      // 简单的白名单判断：只要该字段有值（非空），即视为在白名单中
      const whitelistVal = item.fields[whitelistField || '白名单'];
      // Debug: 打印白名单原始值
      // console.log(`[DEBUG] Name: ${extractFieldValue(item.fields[nameField || '姓名'])}, WhitelistRaw:`, JSON.stringify(whitelistVal));
      
      // 飞书 Checkbox 可能返回 boolean, 或者包含 text 的对象/数组
      let isWhitelist = false;
      if (typeof whitelistVal === 'boolean') {
        isWhitelist = whitelistVal;
      } else if (Array.isArray(whitelistVal)) {
         // 如果是数组，只要长度大于0且有内容
         isWhitelist = whitelistVal.length > 0;
      } else if (typeof whitelistVal === 'object' && whitelistVal !== null) {
         // 如果是对象，通常有 text 字段
         isWhitelist = !!whitelistVal.text || !!whitelistVal.value; 
      } else {
         isWhitelist = !!whitelistVal;
      }

      return {
        id: item.record_id,
        name: extractFieldValue(item.fields[nameField || '姓名']),
        isWhitelist
      };
    }).filter(p => p && p.name);
    
    res.json({ success: true, participants });
  } catch (error) {
    res.json({ success: false, message: error.message, participants: [] });
  }
});

app.post('/api/winners', async (req, res) => {
  try {
    const { appId, appSecret, appToken, tableId, recordId, time, fields } = req.body;
    
    const token = await getTenantAccessToken(appId, appSecret);
    
    const recordData = { 
      fields: {}
    };
    if (fields?.won) recordData.fields[fields.won] = true;
    if (fields?.time) recordData.fields[fields.time] = time;
    
    const response = await fetch(
      `${FEISHU_API_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
      {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(recordData)
      }
    );
    
    const data = await response.json();
    
    if (data.code !== 0) {
      return res.json({ success: false, message: data.msg });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

app.post('/api/winners/list', async (req, res) => {
  try {
    const { appId, appSecret, appToken, tableId, activityName, activityField, nameField, timeField, wonField } = req.body;
    
    const token = await getTenantAccessToken(appId, appSecret);
    
    const body = {
      page_size: 500,
      filter: {
        conditions: [{
          field_name: wonField || '是否中奖',
          operator: 'is',
          value: [true]
        }],
        conjunction: 'and'
      },
      sort: [{ field_name: timeField || '时间', desc: true }]
    };
    
    if (activityName) {
      body.filter.conditions.push({
        field_name: activityField || '活动',
        operator: 'contains',
        value: [activityName]
      });
    }
    
    const response = await fetch(
      `${FEISHU_API_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records/search`,
      {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );
    
    const data = await response.json();
    
    if (data.code !== 0) {
      return res.json({ success: false, message: data.msg, winners: [] });
    }
    
    const winners = (data.data?.items || []).map(item => {
      const activityValue = extractFieldValue(item.fields[activityField || '活动']);
      if (activityName && activityValue !== activityName) {
        return null;
      }
      return {
        id: item.record_id,
        name: extractFieldValue(item.fields[nameField || '姓名']),
        time: extractFieldValue(item.fields[timeField || '时间']),
        activityName: activityValue
      };
    }).filter(w => w && w.name);
    
    res.json({ success: true, winners });
  } catch (error) {
    res.json({ success: false, message: error.message, winners: [] });
  }
});

// 重置接口
app.post('/api/winners/reset', async (req, res) => {
  try {
    const { appId, appSecret, appToken, tableId, activityName, activityField, wonField, timeField } = req.body;
    const token = await getTenantAccessToken(appId, appSecret);

    // 1. 查找所有中奖记录
    const searchBody = {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: wonField || '是否中奖', operator: 'is', value: [true] }
        ]
      },
      page_size: 500 
    };

    if (activityName) {
      searchBody.filter.conditions.push({
        field_name: activityField || '活动',
        operator: 'contains',
        value: [activityName]
      });
    }

    const searchRes = await fetch(
      `${FEISHU_API_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records/search`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(searchBody)
      }
    );
    const searchData = await searchRes.json();
    if (searchData.code !== 0) return res.json({ success: false, message: searchData.msg });

    const records = searchData.data?.items || [];
    if (records.length === 0) return res.json({ success: true, count: 0 });

    // 2. 批量更新
    const updateBody = {
      records: records.map(r => ({
        record_id: r.record_id,
        fields: {
          [wonField || '是否中奖']: false,
          [timeField || '时间']: ""
        }
      }))
    };

    const updateRes = await fetch(
      `${FEISHU_API_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_update`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody)
      }
    );
    const updateData = await updateRes.json();
    if (updateData.code !== 0) return res.json({ success: false, message: updateData.msg });

    res.json({ success: true, count: records.length });

  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
  console.log(`抽奖系统后端服务已启动: http://localhost:${PORT}`);
});
