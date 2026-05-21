# 每日外包資料同步腳本（OpenXML 方式，不受檔案鎖定影響）
$excelPath = 'F:\International Games System\研一外包_唯晶科技 - 桑比槍台\唯晶_桑比槍台_美術_工作日報.xlsx'
$month = Get-Date -Format 'yyyy/MM'
$sheetName = Get-Date -Format 'yyyyMM'
$SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyuqw9ZXRCGLeOtKyYbv0p7xrdIXHYSUydXNuR2j2tiUYrUwK3JFjK765J4Kh0Pk2_I/exec'
$DAILY_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx9rjF3pdXD0dgvjkpBmd0dGHoz0EBmKgDFYH2qc27dLz7WDf8cnOCQUlZRrI7NDaIA/exec'
$MAIN_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyNevW7oTS-hKWXTkFknvQfVmai9pqlkUXmU9viGTPHDqs261F312cvY_JMEGwOrt_4/exec'
$DAILY_SHEET_ID = '1gppJhZkxQYGNNM1-hk3v12Hp-qzV8VnJdCLCNrf-cog'
$OUTSOURCE_SHEET_ID = '11cuSAO3MZfUmau1pd603685i18d0SlQKN-h--jUrp2s'

$results = @()
$rawRows = @()
$source = ''
$currentDate = ''

# Helper functions for OpenXML parsing
function GetCol($ref){$col='';foreach($ch in $ref.ToCharArray()){if($ch -ge 'A' -and $ch -le 'Z'){$col+=$ch}};$idx=0;foreach($ch in $col.ToCharArray()){$idx=$idx*26+([int]$ch-64)};return $idx}

# 1. Try OpenXML (works even when file is locked)
try {
  if(!(Test-Path $excelPath)){ throw "File not found" }
  Add-Type -AssemblyName 'System.IO.Compression'
  $stream = [System.IO.File]::Open($excelPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
  $zip = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Read)

  # Read shared strings
  $r1 = New-Object System.IO.StreamReader($zip.GetEntry('xl/sharedStrings.xml').Open())
  $ssXml = [xml]$r1.ReadToEnd(); $r1.Close()
  $strings = @()
  foreach($si in $ssXml.sst.si){
    $t=''; foreach($node in $si.ChildNodes){
      if($node.LocalName -eq 't'){$t+=$node.InnerText}
      elseif($node.LocalName -eq 'r'){foreach($rn in $node.ChildNodes){if($rn.LocalName -eq 't'){$t+=$rn.InnerText}}}
    }; $strings += $t
  }

  # Find sheet file (workbook.xml maps sheet names to rIds)
  $wbR = New-Object System.IO.StreamReader($zip.GetEntry('xl/workbook.xml').Open())
  $wbXml = [xml]$wbR.ReadToEnd(); $wbR.Close()
  $sheetIdx = 0; $found = $false
  foreach($s in $wbXml.workbook.sheets.sheet){ $sheetIdx++; if($s.name -eq $sheetName){ $found=$true; break } }
  if(!$found){ throw "Sheet $sheetName not found" }

  # Read sheet data
  $sheetFile = "xl/worksheets/sheet${sheetIdx}.xml"
  $r2 = New-Object System.IO.StreamReader($zip.GetEntry($sheetFile).Open())
  $shXml = [xml]$r2.ReadToEnd(); $r2.Close()
  $zip.Dispose(); $stream.Dispose()

  # Parse rows
  foreach($row in $shXml.worksheet.sheetData.row){
    if($row.r -eq '1'){continue}
    $cells = @('','','','')
    foreach($c in $row.c){
      $ci = (GetCol $c.r) - 1
      if($ci -ge 0 -and $ci -le 3){
        if($c.t -eq 's'){$cells[$ci]=$strings[[int]$c.v]}elseif($c.v){$cells[$ci]=$c.v}
      }
    }
    $col0=$cells[0];$col1=$cells[1];$col2=$cells[2];$col3=$cells[3]
    $rawRows += [PSCustomObject]@{date=$col0;content=$col1;progress=$col2;hours=$col3}
    if($col0 -match '^\d{4}/\d+/\d+'){ $currentDate = ($col0 -replace '\(.*$','').Trim() }
    if($col1 -match 'NAME[：:](.+)'){
      $lines1 = $col1 -split "`n"
      $owner = ($lines1[0] -replace 'NAME[：:]','').Trim()
      $taskLines = @($lines1 | Select-Object -Skip 1 | Where-Object { $_ -match '^\s*\d+' })
      if(($lines1 | Select-Object -Skip 1) -match '請假'){
        $results += [PSCustomObject]@{owner=$owner;task='請假';status='已完成';startDate=$currentDate;dueDate=$currentDate;note='';hours=''}
      }
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
  $source = "Excel OpenXML ($($results.Count) tasks)"
} catch {
  Write-Output "Excel failed: $_ - falling back to gviz"
  # 2. Fallback to Google Sheet gviz
  try {
    $gvizSheet = (Get-Date -Format 'yyyy') + '/' + (Get-Date -Format 'MM')
    $raw = (Invoke-WebRequest -Uri "https://docs.google.com/spreadsheets/d/$DAILY_SHEET_ID/gviz/tq?tqx=out:json&headers=0&sheet=$gvizSheet" -UseBasicParsing).Content
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
        if(($lines1 | Select-Object -Skip 1) -match '請假'){
          $results += [PSCustomObject]@{owner=$owner;task='請假';status='已完成';startDate=$currentDate;dueDate=$currentDate;note='';hours=''}
        }
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

# Clear and write to FZG_外包
Invoke-RestMethod -Uri $SCRIPT_URL -Method POST -Body ([System.Text.Encoding]::UTF8.GetBytes((@{action='clear';month=$month} | ConvertTo-Json))) -ContentType 'application/json; charset=utf-8' | Out-Null
$success = 0; $fail = 0
foreach($r in $results){
  $body = @{action='add';month=$month;owner=$r.owner;task=$r.task;status=$r.status;startDate=$r.startDate;dueDate=$r.dueDate;note=$r.note;hours=$r.hours} | ConvertTo-Json -Depth 5
  try{ Invoke-RestMethod -Uri $SCRIPT_URL -Method POST -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -ContentType 'application/json; charset=utf-8' | Out-Null; $success++ } catch { $fail++ }
  Start-Sleep -Milliseconds 300
}
Write-Output "FZG_外包: $success ok, $fail fail"

# Verify
$vRaw = (Invoke-WebRequest -Uri "https://docs.google.com/spreadsheets/d/$OUTSOURCE_SHEET_ID/gviz/tq?tqx=out:json&headers=1&sheet=$([uri]::EscapeDataString($month))" -UseBasicParsing).Content
$vJson = ($vRaw -replace '^[^{]*','' -replace '[^}]*$','') | ConvertFrom-Json
Write-Output "Verified: $($vJson.table.rows.Count) rows"

# Also sync raw Excel rows to 唯晶日報 Google Sheet
if($rawRows.Count -gt 0){
  try {
    Invoke-RestMethod -Uri $DAILY_SCRIPT_URL -Method POST -Body ([System.Text.Encoding]::UTF8.GetBytes((@{action='clear';month=$month} | ConvertTo-Json))) -ContentType 'application/json; charset=utf-8' | Out-Null
    $ds = 0
    foreach($r in $rawRows){
      $body2 = @{action='add';month=$month;date=$r.date;content=$r.content;progress=$r.progress;hours=$r.hours} | ConvertTo-Json -Depth 5
      try{ Invoke-RestMethod -Uri $DAILY_SCRIPT_URL -Method POST -Body ([System.Text.Encoding]::UTF8.GetBytes($body2)) -ContentType 'application/json; charset=utf-8' | Out-Null; $ds++ } catch {}
      Start-Sleep -Milliseconds 300
    }
    Write-Output "唯晶日報: $ds rows synced"
  } catch { Write-Output "唯晶日報 sync failed: $_" }
}

# Save sync time
$ts = Get-Date -Format 'yyyy/M/d HH:mm'
Invoke-RestMethod -Uri "$MAIN_SCRIPT_URL`?action=saveNote&month=sync_time_$((Get-Date).Year)_$((Get-Date).Month)&text=$([uri]::EscapeDataString($ts))" | Out-Null
Write-Output "Sync time: $ts"
