/**
 * FZG 內部 Sheet — Apps Script (含 ID 系統)
 * 部署位置：美術版內部 Sheet (142VCJ65sgkzmELIy6ImUFD8z2RXQRwVs-YvkWnPCF2s)
 * 
 * 欄位(15): 任務名稱,負責人,狀態,進度,開始日,截止日,備註,優先級,標籤,父任務,工時,評論,排序,收合,ID
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    
    if (action === 'add') return _add(data);
    if (action === 'update') return _update(data);
    if (action === 'delete') return _delete(data);
    if (action === 'updateSort') return _updateSort(data);
    if (action === 'moveTask') return _moveTask(data);
    if (action === 'saveNote') return _saveNote(data);
    if (action === 'clear') return _clear(data);
    if (action === 'syncRename') return _syncRename(data);
    if (action === 'syncUpdate') return _syncUpdate(data);
    
    return _json({result: 'unknown'});
  } finally {
    lock.releaseLock();
  }
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function _getSheet(month) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(month);
  if (!sheet) {
    sheet = ss.insertSheet(month);
    sheet.appendRow(['任務名稱','負責人','狀態','進度','開始日','截止日','備註','優先級','標籤','父任務','工時','評論','排序','收合','ID']);
  }
  return sheet;
}

function _genId() {
  return 't' + new Date().getTime() + Math.random().toString(36).substr(2, 4);
}

function _add(data) {
  var month = data.month || _currentMonth();
  var sheet = _getSheet(month);
  var id = data.id || _genId();
  var maxSort = 0;
  if (sheet.getLastRow() > 1) {
    var sorts = sheet.getRange(2, 13, sheet.getLastRow() - 1, 1).getValues();
    sorts.forEach(function(r) { var v = parseInt(r[0]); if (v > maxSort) maxSort = v; });
  }
  sheet.appendRow([
    data.name || '', data.owner || '', data.status || '待辦', data.progress || '',
    data.startDate || '', data.dueDate || '', data.note || '', data.priority || '',
    data.tags || '', data.parent || '', data.hours || '', data.comment || '',
    String(maxSort + 1), '', id
  ]);
  return _json({result: 'ok', id: id});
}

function _update(data) {
  var month = data.month || _currentMonth();
  var sheet = _getSheet(month);
  var row = parseInt(data.row) + 2;
  if (row < 2 || row > sheet.getLastRow()) return _json({result: 'ok'});
  var range = sheet.getRange(row, 1, 1, 14);
  var existing = range.getValues()[0];
  var existingId = sheet.getRange(row, 15).getValue();
  range.setValues([[
    data.name || existing[0], data.owner || existing[1], data.status || existing[2],
    data.progress !== undefined ? data.progress : existing[3],
    data.startDate !== undefined ? data.startDate : existing[4],
    data.dueDate !== undefined ? data.dueDate : existing[5],
    data.note !== undefined ? data.note : existing[6],
    data.priority !== undefined ? data.priority : existing[7],
    data.tags !== undefined ? data.tags : existing[8],
    data.parent !== undefined ? data.parent : existing[9],
    data.hours !== undefined ? data.hours : existing[10],
    data.comment !== undefined ? data.comment : existing[11],
    existing[12], existing[13]
  ]]);
  // Preserve ID (don't overwrite)
  if (!existingId && data.id) sheet.getRange(row, 15).setValue(data.id);
  return _json({result: 'ok'});
}

function _delete(data) {
  var month = data.month || _currentMonth();
  var sheet = _getSheet(month);
  var row = parseInt(data.row) + 2;
  if (row >= 2 && row <= sheet.getLastRow()) {
    sheet.deleteRow(row);
  }
  return _json({result: 'ok'});
}

function _updateSort(data) {
  var month = data.month || _currentMonth();
  var sheet = _getSheet(month);
  var row = parseInt(data.row) + 2;
  if (row >= 2 && row <= sheet.getLastRow()) {
    sheet.getRange(row, 13).setValue(data.sort);
  }
  return _json({result: 'ok'});
}

function _moveTask(data) {
  var fromSheet = _getSheet(data.fromMonth);
  var toSheet = _getSheet(data.toMonth);
  var row = parseInt(data.row) + 2;
  if (row < 2 || row > fromSheet.getLastRow()) return _json({result: 'ok'});
  var values = fromSheet.getRange(row, 1, 1, 15).getValues()[0];
  fromSheet.deleteRow(row);
  toSheet.appendRow(values);
  return _json({result: 'ok'});
}

function _saveNote(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('notes');
  if (!sheet) { sheet = ss.insertSheet('notes'); }
  var values = sheet.getDataRange().getValues();
  for (var i = 0; i < values.length; i++) {
    if (values[i][0] === data.month) {
      sheet.getRange(i + 1, 2).setValue(data.text);
      return _json({result: 'ok'});
    }
  }
  sheet.appendRow([data.month, data.text]);
  return _json({result: 'ok'});
}

function _clear(data) {
  var month = data.month;
  var sheet = _getSheet(month);
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    if (sheet.getLastRow() > 1) {
      sheet.deleteRows(2, sheet.getLastRow() - 1);
    }
  }
  return _json({result: 'ok'});
}

/**
 * syncRename: 根據 ID 在所有月份分頁中改名
 * params: {action:'syncRename', id:'t123...', newName:'新名稱', oldName:'舊名稱'}
 */
function _syncRename(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var count = 0;
  sheets.forEach(function(sheet) {
    if (sheet.getName() === 'notes') return;
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    var ids = sheet.getRange(2, 15, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] === data.id) {
        sheet.getRange(i + 2, 1).setValue(data.newName);
        count++;
      }
    }
    // Also update parent references (by old name → new name)
    if (data.oldName && data.newName) {
      var parents = sheet.getRange(2, 10, lastRow - 1, 1).getValues();
      for (var j = 0; j < parents.length; j++) {
        if (parents[j][0] === data.oldName) {
          sheet.getRange(j + 2, 10).setValue(data.newName);
          count++;
        }
      }
    }
  });
  return _json({result: 'ok', count: count});
}

/**
 * syncUpdate: 根據 ID 在所有月份分頁中同步欄位
 * params: {action:'syncUpdate', id:'t123...', fields:{status:'已完成', dueDate:'2026/06/10', ...}}
 */
function _syncUpdate(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var colMap = {name:1, owner:2, status:3, progress:4, startDate:5, dueDate:6, note:7, priority:8, tags:9, parent:10, hours:11, comment:12};
  var count = 0;
  sheets.forEach(function(sheet) {
    if (sheet.getName() === 'notes') return;
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    var ids = sheet.getRange(2, 15, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] === data.id) {
        var fields = data.fields || {};
        Object.keys(fields).forEach(function(key) {
          if (colMap[key]) {
            sheet.getRange(i + 2, colMap[key]).setValue(fields[key]);
          }
        });
        count++;
      }
    }
  });
  return _json({result: 'ok', count: count});
}

function _currentMonth() {
  var now = new Date();
  var m = now.getMonth() + 1;
  return now.getFullYear() + '/' + (m < 10 ? '0' + m : m);
}
