/**
 * 每日外包同步 — 純 Apps Script 版
 * 讀唯晶日報 Sheet → 解析 → 批量寫入外包 Sheet
 * 
 * 部署位置：外包 Sheet (11cuSAO3MZfUmau1pd603685i18d0SlQKN-h--jUrp2s) 的 Apps Script
 * 觸發：每日 9:00~10:00 定時 + 前端按鈕 doGet(?action=dailySync&month=2026/06)
 */

var SYNC_DAILY_SHEET_ID = '1gppJhZkxQYGNNM1-hk3v12Hp-qzV8VnJdCLCNrf-cog';
var SYNC_OUTSOURCE_SHEET_ID = '11cuSAO3MZfUmau1pd603685i18d0SlQKN-h--jUrp2s';
var SYNC_MAIN_SHEET_ID = '142VCJ65sgkzmELIy6ImUFD8z2RXQRwVs-YvkWnPCF2s';

/**
 * 前端按鈕觸發入口（加到現有 doGet 或獨立部署）
 * URL: ?action=dailySync&month=2026/06
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'dailySync') {
    var month = e.parameter.month || null;
    var result = dailySync(month);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({error: 'unknown action'})).setMimeType(ContentService.MimeType.JSON);
}

function dailySync(monthParam) {
  var now = new Date();
  var year = now.getFullYear();
  var mon = now.getMonth() + 1;
  var month = monthParam || (year + '/' + (mon < 10 ? '0' + mon : mon));
  var parts = month.split('/');
  var pYear = parseInt(parts[0]);
  var pMon = parseInt(parts[1]);
  var monthPrefix = pYear + '/' + pMon + '/';

  // 1. 讀唯晶日報當月分頁
  var dailySS = SpreadsheetApp.openById(SYNC_DAILY_SHEET_ID);
  var dailySheet = dailySS.getSheetByName(month);
  if (!dailySheet) {
    return {success: false, error: '唯晶日報找不到分頁 ' + month};
  }
  var data = dailySheet.getDataRange().getValues();
  if (data.length <= 1) {
    return {success: false, error: '分頁無資料'};
  }

  // 2. 解析
  var results = [];
  var currentDate = '';

  for (var r = 1; r < data.length; r++) {
    var col0 = String(data[r][0] || '').trim();
    var col1 = String(data[r][1] || '').trim();
    var col2 = String(data[r][2] || '').trim();
    var col3 = String(data[r][3] || '').trim();

    if (/^\d{4}\/\d+\/\d+/.test(col0)) {
      currentDate = col0.replace(/\(.*$/, '').trim();
    }

    if (/NAME[：:]/.test(col1)) {
      var lines = col1.split('\n');
      var owner = lines[0].replace(/NAME[：:]/, '').trim();
      var rest = lines.slice(1);

      if (rest.some(function(l) { return l.indexOf('請假') >= 0; })) {
        results.push([owner, '請假', '已完成', currentDate, currentDate, '', '']);
      }

      var taskLines = rest.filter(function(l) { return /^\s*\d+/.test(l); });
      var progLines = col2.split('\n').filter(function(l) { return l.trim(); });
      var hrLines = col3.split('\n').filter(function(l) { return l.trim(); });

      for (var i = 0; i < taskLines.length; i++) {
        var taskName = taskLines[i].replace(/^\s*\d+[\.\s、]+/, '').trim();
        if (taskName.length <= 2 && taskName !== '請假') continue;
        var progress = i < progLines.length ? progLines[i].replace(/^\s*\d+[\.\s、]+/, '').trim() : '';
        var status = progress === '完成' ? '已完成' : progress ? '進行中' : '待辦';
        var hours = i < hrLines.length ? hrLines[i].trim() : '';
        results.push([owner, taskName, status, currentDate, currentDate, progress, hours]);
      }
    }
  }

  if (results.length === 0) {
    return {success: false, error: '解析結果為空'};
  }

  // 日期驗證
  var hasCurrentMonth = results.some(function(row) { return row[3].indexOf(monthPrefix) === 0; });
  if (!hasCurrentMonth) {
    return {success: false, error: '資料日期不包含當月(' + monthPrefix + ')，來源可能有誤'};
  }

  // 3. 寫入外包 Sheet
  var outSS = SpreadsheetApp.openById(SYNC_OUTSOURCE_SHEET_ID);
  var outSheet = outSS.getSheetByName(month);
  if (!outSheet) {
    outSheet = outSS.insertSheet(month);
    outSheet.appendRow(['負責人', '工作項目', '狀態', '開始日', '截止日', '備註', '工時']);
  } else {
    if (outSheet.getLastRow() > 1) {
      outSheet.getRange(2, 1, outSheet.getLastRow() - 1, 7).clearContent();
    }
  }
  outSheet.getRange(2, 1, results.length, 7).setValues(results);

  // 4. 存同步時間
  var ts = pYear + '/' + pMon + '/' + now.getDate() + ' ' +
    (now.getHours() < 10 ? '0' : '') + now.getHours() + ':' +
    (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();
  var mainSS = SpreadsheetApp.openById(SYNC_MAIN_SHEET_ID);
  var notesSheet = mainSS.getSheetByName('notes');
  if (!notesSheet) notesSheet = mainSS.insertSheet('notes');
  var noteKey = 'sync_time_' + pYear + '_' + pMon;
  var notesData = notesSheet.getDataRange().getValues();
  var found = false;
  for (var j = 0; j < notesData.length; j++) {
    if (notesData[j][0] === noteKey) {
      notesSheet.getRange(j + 1, 2).setValue(ts);
      found = true;
      break;
    }
  }
  if (!found) notesSheet.appendRow([noteKey, ts]);

  Logger.log('同步完成: ' + results.length + ' 筆, 時間: ' + ts);
  return {success: true, count: results.length, syncTime: ts};
}
