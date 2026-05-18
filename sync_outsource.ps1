# 每日外包資料同步腳本
# 優先讀取本機 Excel，失敗則 fallback 到 Google Sheet gviz
$excelPath = 'F:\International Games System\研一外包_唯晶科技 - 桑比槍台\唯晶_桑比槍台_美術_工作日報.xlsx'
$month = Get-Date -Format 'yyyy/MM'
$sheetName = Get-Date -Format 'yyyyMM'
$SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyuqw9ZXRCGLeOtKyYbv0p7xrdIXHYSUydXNuR2j2tiUYrUwK3JFjK765J4Kh0Pk2_I/exec'
$DAILY_SHEET_ID = '1gppJhZkxQYGNNM1-hk3v12Hp-qzV8VnJdCLCNrf-cog'
$OUTSOURCE_SHEET_ID = '11cuSAO3MZfUmau1pd603685i18d0SlQKN-h--jUrp2s'

$results = @()
$source = ''
$currentDate = ''

# 1. Try Excel COM
try {
  if(!(Test-Path $excelPath)){ throw "File not found" }
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false; $excel.DisplayAlerts = $false
  $wb = $excel.Workbooks.Open($excelPath, $false, $true)
  $ws = $wb.Sheets.Item($sheetName)
  $lastRow = $ws.UsedRange.Rows.Count
  for($r=2;$r -le $lastRow;$r++){
    $col0 = [string]($ws.Cells.Item($r,1).Text)
    $col1 = [string]($ws.Cells.Item($r,2).Text)
    $col2 = [string]($ws.Cells.Item($r,3).Text)
    $col3 = [string]($ws.Cells.Item($r,4).Text)
    if($col0 -match '^\d{4}/\d+/\d+'){ $currentDate = ($col0 -replace '\(.*$','').Trim() }
    if($col1 -match 'NAME[：:](.+)'){
      $lines1 = $col1 -split "`n"
      $owner = ($lines1[0] -replace 'NAME[：:]','').Trim()
      $taskLines = @($lines1 | Select-Object -Skip 1 | Where-Object { $_ -match '^\s*\d+' })
      $progLines = @(($col2 -split "`n") | Where-Object { $_.Trim() -ne '' })
      $hrLines = @(($col3 -split "`n") | Where-Object { $_.Trim() -ne '' })
      for($i=0;$i -lt $taskLines.Count;$i++){
        $taskName = ($taskLines[$i] -replace '^\s*\d+[\.\s、]+','').Trim()
        if($taskName.Length -le 2 -and $taskName -ne '請假'){ continue }
        $progress = if($i -lt $progLines.Count){($progLines[$i] -replace '^\s*\d+[\.\s、]+','').Trim()}else{''}
        $hr = if($i -lt $hrLines.Count){$hrLines[$i].Trim()}else{''}
        $status = if($progress -eq '完成'){'已完成'}elseif($progress){'進行中'}else{'待辦'}
        $results += [PSCustomObject]@{owner=$owner;task=$taskName;status=$status;startDate=$currentDate;dueDate=$currentDate;note=$progress;hours=$hr}
      }
    }
  }
  $wb.Close($false); $excel.Quit()
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
  $source = "Excel ($($results.Count) tasks)"
} catch {
  Write-Output "Excel failed: $_ - falling back to gviz"
  # 2. Fallback to Google Sheet gviz
  try {
    $gvizSheet = (Get-Date -Format 'yyyy') + '/' + (Get-Date -Format 'MM')
    $raw = (Invoke-WebRequest -Uri "https://docs.google.com/spreadsheets/d/$DAILY_SHEET_ID/gviz/tq?tqx=out:json&headers=1&sheet=$gvizSheet" -UseBasicParsing).Content
    $json = $raw -replace '^[^{]*','' -replace '[^}]*$',''
    $data = $json | ConvertFrom-Json
    foreach($row in $data.table.rows){
      $vals = @(); foreach($c in $row.c){ if($c -and $c.v){ $vals += $c.v } else { $vals += '' } }
      $col0 = $vals[0].Trim(); $col1 = $vals[1]; $col2 = $vals[2]; $col3 = $vals[3]
      if($col0 -match '^\d{4}/\d+/\d+'){ $currentDate = ($col0 -replace '\(.*$','').Trim() }
      if($col1 -match 'NAME[：:](.+)'){
        $lines1 = $col1 -split "`n"
        $owner = ($lines1[0] -replace 'NAME[：:]','').Trim()
        $taskLines = @($lines1 | Select-Object -Skip 1 | Where-Object { $_ -match '^\s*\d+' })
        $progLines = @(($col2 -split "`n") | Where-Object { $_.Trim() -ne '' })
        $hrLines = @(($col3 -split "`n") | Where-Object { $_.Trim() -ne '' })
        for($i=0;$i -lt $taskLines.Count;$i++){
          $taskName = ($taskLines[$i] -replace '^\s*\d+[\.\s、]+','').Trim()
          if($taskName.Length -le 2 -and $taskName -ne '請假'){ continue }
          $progress = if($i -lt $progLines.Count){($progLines[$i] -replace '^\s*\d+[\.\s、]+','').Trim()}else{''}
          $hr = if($i -lt $hrLines.Count){$hrLines[$i].Trim()}else{''}
          $status = if($progress -eq '完成'){'已完成'}elseif($progress){'進行中'}else{'待辦'}
          $results += [PSCustomObject]@{owner=$owner;task=$taskName;status=$status;startDate=$currentDate;dueDate=$currentDate;note=$progress;hours=$hr}
        }
      }
    }
    $source = "gviz fallback ($($results.Count) tasks)"
  } catch {
    Write-Output "BOTH SOURCES FAILED. Notify operator."
    exit 1
  }
}

if($results.Count -eq 0){ Write-Output "No data parsed. Aborting."; exit 1 }
Write-Output "Source: $source"

# Clear and write
Invoke-RestMethod -Uri $SCRIPT_URL -Method POST -Body ([System.Text.Encoding]::UTF8.GetBytes((@{action='clear';month=$month} | ConvertTo-Json))) -ContentType 'application/json; charset=utf-8' | Out-Null
$success = 0; $fail = 0
foreach($r in $results){
  $body = @{action='add';month=$month;owner=$r.owner;task=$r.task;status=$r.status;startDate=$r.startDate;dueDate=$r.dueDate;note=$r.note;hours=$r.hours} | ConvertTo-Json -Depth 5
  try{ Invoke-RestMethod -Uri $SCRIPT_URL -Method POST -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -ContentType 'application/json; charset=utf-8' | Out-Null; $success++ } catch { $fail++ }
  Start-Sleep -Milliseconds 300
}
Write-Output "Write: $success ok, $fail fail"

# Verify
$vRaw = (Invoke-WebRequest -Uri "https://docs.google.com/spreadsheets/d/$OUTSOURCE_SHEET_ID/gviz/tq?tqx=out:json&headers=1&sheet=$([uri]::EscapeDataString($month))" -UseBasicParsing).Content
$vJson = ($vRaw -replace '^[^{]*','' -replace '[^}]*$','') | ConvertFrom-Json
Write-Output "Verified: $($vJson.table.rows.Count) rows"
