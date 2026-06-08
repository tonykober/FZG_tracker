#!/usr/bin/env node
// 每日外包資料同步腳本 (Node.js) — 讀唯晶日報 gviz → 寫外包 Sheet

const DAILY_SHEET_ID = '1gppJhZkxQYGNNM1-hk3v12Hp-qzV8VnJdCLCNrf-cog';
const OUTSOURCE_SHEET_ID = '11cuSAO3MZfUmau1pd603685i18d0SlQKN-h--jUrp2s';
const OUTSOURCE_SCRIPT = 'https://script.google.com/macros/s/AKfycbyuqw9ZXRCGLeOtKyYbv0p7xrdIXHYSUydXNuR2j2tiUYrUwK3JFjK765J4Kh0Pk2_I/exec';
const MAIN_SCRIPT = 'https://script.google.com/macros/s/AKfycbyNevW7oTS-hKWXTkFknvQfVmai9pqlkUXmU9viGTPHDqs261F312cvY_JMEGwOrt_4/exec';

const now = new Date();
const year = now.getFullYear();
const mon = now.getMonth() + 1;
const month = `${year}/${String(mon).padStart(2, '0')}`;
const gvizSheet = month;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify(body),
    redirect: 'follow'
  });
  return res.text();
}

async function fetchGviz(sheetId, sheet, headers = 0) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&headers=${headers}&sheet=${encodeURIComponent(sheet)}`;
  const res = await fetch(url, { redirect: 'follow' });
  const text = await res.text();
  const json = text.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
  return JSON.parse(json);
}

function parseDaily(data) {
  const results = [];
  let currentDate = '';

  for (const row of data.table.rows) {
    const vals = row.c.map(c => (c && c.v != null) ? String(c.v).trim() : '');
    const [col0, col1, col2, col3] = vals;

    if (/^\d{4}\/\d+\/\d+/.test(col0)) {
      currentDate = col0.replace(/\(.*$/, '').trim();
    }

    if (/NAME[：:]/.test(col1)) {
      const lines = col1.split('\n');
      const owner = lines[0].replace(/NAME[：:]/, '').trim();
      const rest = lines.slice(1);

      // 請假特殊處理
      if (rest.some(l => l.includes('請假'))) {
        results.push({ owner, task: '請假', status: '已完成', startDate: currentDate, dueDate: currentDate });
      }

      const taskLines = rest.filter(l => /^\s*\d+/.test(l));
      const progLines = (col2 || '').split('\n').filter(l => l.trim());
      const hrLines = (col3 || '').split('\n').filter(l => l.trim());

      for (let i = 0; i < taskLines.length; i++) {
        const taskName = taskLines[i].replace(/^\s*\d+[\.\s、]+/, '').trim();
        if (taskName.length <= 2 && taskName !== '請假') continue;
        const progress = (i < progLines.length) ? progLines[i].replace(/^\s*\d+[\.\s、]+/, '').trim() : '';
        const status = progress === '完成' ? '已完成' : progress ? '進行中' : '待辦';
        results.push({ owner, task: taskName, status, startDate: currentDate, dueDate: currentDate });
      }
    }
  }
  return results;
}

async function main() {
  console.log(`=== 外包同步 ${month} ===`);

  // 1. 讀唯晶日報
  console.log('讀取唯晶日報...');
  const data = await fetchGviz(DAILY_SHEET_ID, gvizSheet);
  const results = parseDaily(data);
  console.log(`解析完成: ${results.length} 筆`);
  if (results.length === 0) { console.log('ERROR: 無資料，中止（分頁可能不存在或資料格式有誤）'); process.exit(1); }

  // 驗證日期屬於當月（防止 gviz 返回錯誤分頁資料）
  const monthPrefix = `${year}/${mon}/`;
  const hasCurrentMonth = results.some(r => r.startDate.startsWith(monthPrefix));
  if (!hasCurrentMonth) {
    console.log(`ERROR: 解析的資料日期不包含當月(${monthPrefix})，來源可能有誤，中止同步`);
    process.exit(1);
  }

  // 2. Clear 外包 Sheet 當月
  console.log('清除外包 Sheet 當月...');
  await post(OUTSOURCE_SCRIPT, { action: 'clear', month });
  await sleep(1000);

  // 3. 逐筆 add
  let ok = 0, fail = 0;
  for (const r of results) {
    try {
      await post(OUTSOURCE_SCRIPT, {
        action: 'add', month,
        owner: r.owner, task: r.task, status: r.status,
        progress: '', startDate: r.startDate, dueDate: r.dueDate
      });
      ok++;
    } catch (e) { fail++; }
    await sleep(300);
  }
  console.log(`寫入完成: ${ok} ok, ${fail} fail`);

  // 4. 驗證（含重試）
  let verified = -1;
  for (let retry = 0; retry < 3; retry++) {
    await sleep(3000);
    try {
      const vData = await fetchGviz(OUTSOURCE_SHEET_ID, month, 1);
      verified = vData.table.rows.length;
      break;
    } catch (e) {
      console.log(`驗證重試 ${retry + 1}/3...`);
    }
  }
  if (verified >= 0) console.log(`驗證: Sheet 有 ${verified} 筆 (預期 ${results.length})`);
  else console.log(`驗證失敗（網路問題），但資料已寫入 ${ok} 筆`);

  // 5. 存同步時間
  const syncNow = new Date();
  const ts = `${syncNow.getFullYear()}/${syncNow.getMonth()+1}/${syncNow.getDate()} ${String(syncNow.getHours()).padStart(2,'0')}:${String(syncNow.getMinutes()).padStart(2,'0')}`;
  const noteKey = `sync_time_${year}_${mon}`;
  try {
    await post(MAIN_SCRIPT, { action: 'saveNote', month: noteKey, text: ts });
    console.log(`同步時間: ${ts}`);
  } catch (e) { console.log(`同步時間儲存失敗(${e.message})，但資料已同步成功`); }
  console.log('=== 完成 ===');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
