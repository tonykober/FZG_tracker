/**
 * 一次性遷移腳本：為現有任務補上 ID
 * 在 Apps Script 編輯器中手動執行一次
 * 
 * 邏輯：
 * 1. 掃描所有月份分頁
 * 2. 如果 O 欄（第15欄）沒有 ID，生成一個
 * 3. 跨月同名任務給同一個 ID
 */
function migrateAddIds() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var nameToId = {}; // 用名稱映射 ID（跨月同名 = 同 ID）
  var count = 0;

  // First pass: collect existing IDs
  sheets.forEach(function(sheet) {
    var name = sheet.getName();
    if (name === 'notes' || !/^\d{4}\//.test(name)) return;
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    
    // Ensure header has ID column
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (headers.length < 15 || headers[14] !== 'ID') {
      sheet.getRange(1, 15).setValue('ID');
    }
    
    var data = sheet.getRange(2, 1, lastRow - 1, 15).getValues();
    for (var i = 0; i < data.length; i++) {
      var taskName = data[i][0];
      var existingId = data[i][14];
      if (taskName && existingId) {
        nameToId[taskName] = existingId;
      }
    }
  });

  // Second pass: assign IDs
  sheets.forEach(function(sheet) {
    var name = sheet.getName();
    if (name === 'notes' || !/^\d{4}\//.test(name)) return;
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    
    var data = sheet.getRange(2, 1, lastRow - 1, 15).getValues();
    var updates = [];
    
    for (var i = 0; i < data.length; i++) {
      var taskName = data[i][0];
      var existingId = data[i][14];
      
      if (taskName && !existingId) {
        var id;
        if (nameToId[taskName]) {
          id = nameToId[taskName]; // 跨月同名用相同 ID
        } else {
          id = 't' + new Date().getTime() + Math.random().toString(36).substr(2, 4);
          Utilities.sleep(1); // ensure unique timestamp
          nameToId[taskName] = id;
        }
        sheet.getRange(i + 2, 15).setValue(id);
        count++;
      }
    }
  });

  Logger.log('Migration done: ' + count + ' IDs assigned');
}
