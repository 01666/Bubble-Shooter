param([switch]$NoOpen,[int]$Port=4210)
$ErrorActionPreference='Stop'
$gameRoot=Split-Path $PSScriptRoot -Parent
$expectedVersion=(Get-Content -LiteralPath (Join-Path $gameRoot 'package.json') -Raw | ConvertFrom-Json).version
$nodeCommand=Get-Command node -ErrorAction SilentlyContinue
if($nodeCommand){$gameNode=$nodeCommand.Source}else{$gameNode=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'}
$useNode=Test-Path -LiteralPath $gameNode
$gameUrl='http://127.0.0.1:'+ $Port +'/'
$healthy=$false
try{$health=Invoke-RestMethod ($gameUrl+'health') -TimeoutSec 2;$healthy=$health.app -eq 'bubble-ticket-arcade' -and $health.version -eq $expectedVersion;if(-not $healthy){throw 'Port is occupied by another application.'}}catch{if($_.Exception.Message -eq 'Port is occupied by another application.'){throw}}
if(-not $healthy){$logs=Join-Path $gameRoot '..\output\logs';New-Item -ItemType Directory -Force -Path $logs | Out-Null;if($useNode){$previousPort=$env:GAME_PORT;try{$env:GAME_PORT=[string]$Port;Start-Process -FilePath $gameNode -ArgumentList ('"'+(Join-Path $PSScriptRoot 'server.mjs')+'"') -WorkingDirectory $gameRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'server.log') -RedirectStandardError (Join-Path $logs 'server-error.log')}finally{$env:GAME_PORT=$previousPort}}else{$psArgs='-NoProfile -ExecutionPolicy Bypass -File "'+(Join-Path $PSScriptRoot 'offline-server.ps1')+'" -Port '+$Port;Start-Process -FilePath 'powershell.exe' -ArgumentList $psArgs -WorkingDirectory $gameRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'server.log') -RedirectStandardError (Join-Path $logs 'server-error.log')}
for($attempt=0;$attempt -lt 25;$attempt++){Start-Sleep -Milliseconds 200;try{$health=Invoke-RestMethod ($gameUrl+'health') -TimeoutSec 1;if($health.app -eq 'bubble-ticket-arcade'){$healthy=$true;break}}catch{}}}
if(-not $healthy){throw 'Game server did not start. The port may be occupied; see output/logs/server-error.log.'}
if(-not $NoOpen){Start-Process $gameUrl}
Write-Output $gameUrl
