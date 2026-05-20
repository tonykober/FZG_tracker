# 每日外包資料同步腳本 — 程式版（OpenXML）
$excelPath = 'F:\International Games System\研一外包_唯晶科技 - 桑比槍台\唯晶_桑比槍台_軟體_工作日報.xlsx'
$month = Get-Date -Format 'yyyy/MM'
$sheetName = Get-Date -Format 'yyyyMM'
$SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyQGrEoHFDrxHRaNOFDpOUC6Rxq-4NAf0JwJnExAapoQ3rXe7AFuhBbShhBsIEur8v9hQ/exec'
$MAIN_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxrEYSY5jCnYXbrBY-1or5VGGSe1serugCHqWYtPU8nGC_zQcUg_nBFR2OcjqscyJs6CQ/exec'

$results = @()
$source = ''
$currentDate = ''

function GetCol($ref){$col='';foreach($ch in $ref.ToCharArray()){if($ch -ge 'A' -and $ch -le 'Z'){$col+=$ch}};$idx=0;foreach($ch in $col.ToCharArray()){$idx=$idx*26+([int]$ch-64)};return $idx}

# 1. Read Excel via OpenXML
try {
  if(!(Test-Path $excelPath)){ throw "File not found" }
  Add-Type -AssemblyName 'System.IO.Compression'
  $stream = [System.IO.File]::Open($excelPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
  $zip = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Read)

  $r1 = New-Object System.IO.StreamReader($zip.GetEntry('xl/sharedStrings.xml').Open())
  $ssXml = [xml]$r1.ReadToEnd(); $r1.Close()
  $strings = @()
  foreach($si in $ssXml.sst.si){
    $t=''; foreach($node in $si.ChildNodes){
      if($node.LocalName -eq 't'){$t+=$node.InnerText}
      elseif($node.LocalName -eq 'r'){foreach($rn in $node.ChildNodes){if($rn.LocalName -eq 't'){$t+=$rn.InnerText}}}
    }; $strings += $t
  }

  # Find sheet index
  $wbR = New-Object System.IO.StreamReader($zip.GetEntry('xl/workbook.xml').Open())
  $wbXml = [xml]$wbR.ReadToEnd(); $wbR.Close()
  $sheetIdx = 0; $found = $false
  foreach($s in $wbXml.workbook.sheets.sheet){ $sheetIdx++; if($s.name -eq $sheetName){ $found=$true; break } }
  if(!$found){ throw "Sheet $sheetName not found" }

  $sheetFile = "xl/worksheets/sheet${sheetIdx}.xml"
  $r2 = New-Object System.IO.StreamReader($zip.GetEntry($sheetFile).Open())
  $shXml = [xml]$r2.ReadToEnd(); $r2.Close()
  $zip.Dispose(); $stream.Dispose()

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
  Write-Output "FAILED: $_"
  exit 1
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
Write-Output "Written: $success ok, $fail fail"

# Save sync time
$ts = Get-Date -Format 'yyyy/M/d HH:mm'
Invoke-RestMethod -Uri "$MAIN_SCRIPT_URL`?action=saveNote&month=sync_time_$((Get-Date).Year)_$((Get-Date).Month)&text=$([uri]::EscapeDataString($ts))" | Out-Null
Write-Output "Sync time: $ts"
