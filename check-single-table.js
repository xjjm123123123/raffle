const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis';

const config = {
  appId: 'cli_a922afd6e5b89bc8',
  appSecret: 'yc0Vf7bE9kA8AmlTn0h6nchyssucONp2',
  appToken: 'ZY0RbMz6na5PwMsTf2NcKSzsnTd',
  tableId: 'tbl7SgCO4iXhcijQ'
};

async function getToken() {
  const response = await fetch(`${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      app_id: config.appId, 
      app_secret: config.appSecret 
    })
  });
  const data = await response.json();
  return data.tenant_access_token;
}

async function getFields(token, tableId) {
  const response = await fetch(
    `${FEISHU_API_BASE}/bitable/v1/apps/${config.appToken}/tables/${tableId}/fields`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return response.json();
}

async function addField(token, tableId, fieldName, fieldType) {
  const url = `${FEISHU_API_BASE}/bitable/v1/apps/${config.appToken}/tables/${tableId}/fields`;
  
  const body = {
    field_name: fieldName,
    type: fieldType
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  return response.json();
}

async function getRecords(token, tableId) {
  const response = await fetch(
    `${FEISHU_API_BASE}/bitable/v1/apps/${config.appToken}/tables/${tableId}/records?page_size=10`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return response.json();
}

async function main() {
  const token = await getToken();
  
  console.log('=== 查看表字段 ===\n');
  console.log(`Table ID: ${config.tableId}\n`);
  
  const fieldsData = await getFields(token, config.tableId);
  console.log('现有字段:');
  (fieldsData.data?.items || []).forEach(f => {
    console.log(`  - ${f.field_name} (field_id: ${f.field_id}, type: ${f.type})`);
  });
  
  const existingFields = (fieldsData.data?.items || []).map(f => f.field_name);
  
  if (!existingFields.includes('是否中奖')) {
    console.log('\n添加"是否中奖"字段 (复选框类型)...');
    const result = await addField(token, config.tableId, '是否中奖', 7);
    console.log('结果:', result.code === 0 ? '成功' : result.msg);
  }
  
  console.log('\n=== 最终字段列表 ===');
  const finalFields = await getFields(token, config.tableId);
  (finalFields.data?.items || []).forEach(f => {
    console.log(`  - ${f.field_name} (field_id: ${f.field_id}, type: ${f.type})`);
  });
  
  console.log('\n=== 示例数据 ===');
  const records = await getRecords(token, config.tableId);
  (records.data?.items || []).forEach(item => {
    console.log(`  ${JSON.stringify(item.fields)}`);
  });
}

main().catch(console.error);
