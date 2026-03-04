const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis';

const config = {
  appId: 'cli_a922afd6e5b89bc8',
  appSecret: 'yc0Vf7bE9kA8AmlTn0h6nchyssucONp2',
  appToken: 'ZY0RbMz6na5PwMsTf2NcKSzsnTd',
  activityTableId: 'tblapmQeHoQxleuy',
  participantTableId: 'tblHCMt5VVjkHg7Y',
  winnerTableId: 'tbl7SgCO4iXhcijQ'
};

let cachedToken = null;

async function getToken() {
  if (cachedToken) return cachedToken;
  
  const response = await fetch(`${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      app_id: config.appId, 
      app_secret: config.appSecret 
    })
  });
  
  const data = await response.json();
  if (data.code !== 0) throw new Error(`获取 token 失败: ${data.msg}`);
  cachedToken = data.tenant_access_token;
  return cachedToken;
}

async function addRecord(tableId, fields) {
  const token = await getToken();
  const response = await fetch(
    `${FEISHU_API_BASE}/bitable/v1/apps/${config.appToken}/tables/${tableId}/records`,
    {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields })
    }
  );
  return response.json();
}

async function main() {
  console.log('=== 添加示例参与者 ===\n');
  
  const participants = [
    { name: '张三', activity: '2026 年会特等奖' },
    { name: '李四', activity: '2026 年会特等奖' },
    { name: '王五', activity: '2026 年会特等奖' },
    { name: '赵六', activity: '2026 年会一等奖' },
    { name: '钱七', activity: '2026 年会一等奖' },
    { name: '孙八', activity: '2026 年会二等奖' },
    { name: '周九', activity: '2026 年会二等奖' },
    { name: '吴十', activity: '阳光普照奖' }
  ];
  
  for (const p of participants) {
    const result = await addRecord(config.participantTableId, { '姓名': p.name, '活动': p.activity });
    console.log(`添加参与者: ${p.name} (${p.activity})`, result.code === 0 ? '✓' : result.msg);
  }
  
  console.log('\n=== 配置完成 ===');
  console.log('\n前端配置信息:');
  console.log('---');
  console.log(`App ID: ${config.appId}`);
  console.log(`App Secret: ${config.appSecret}`);
  console.log(`多维表格 Token: ${config.appToken}`);
  console.log(`活动表 ID: ${config.activityTableId}`);
  console.log(`参与者表 ID: ${config.participantTableId}`);
  console.log(`中奖记录表 ID: ${config.winnerTableId}`);
  console.log('---');
}

main().catch(console.error);
