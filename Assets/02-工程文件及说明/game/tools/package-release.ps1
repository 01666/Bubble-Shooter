param([string]$Version,[string]$BaselineVersion='1.5.5')
$ErrorActionPreference='Stop'
if(-not $PSBoundParameters.ContainsKey('Version')){$Version=(Get-Content -LiteralPath (Join-Path (Split-Path $PSScriptRoot -Parent) 'package.json') -Raw | ConvertFrom-Json).version}
if($Version -notmatch '^\d+\.\d+\.\d+$'){throw 'Invalid release version'}
$actualVersion=(Get-Content -LiteralPath (Join-Path (Split-Path $PSScriptRoot -Parent) 'package.json') -Raw | ConvertFrom-Json).version
if($actualVersion -ne $Version){throw 'Package version does not match requested release version'}
$workspace=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$releases=Join-Path $workspace 'output\releases'
$destination=[IO.Path]::GetFullPath((Join-Path $releases ('v'+$Version)))
if(-not $destination.StartsWith([IO.Path]::GetFullPath($releases)+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Release outside output/releases'}
if(Test-Path -LiteralPath $destination){throw 'Release already exists. Use a new version; previous release is preserved.'}
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$payload=Join-Path $destination 'source'
New-Item -ItemType Directory -Path $payload | Out-Null
foreach($folder in @('game','docs')){
 $sourceFolder=Join-Path $workspace $folder
 foreach($entry in (Get-ChildItem -LiteralPath $sourceFolder -Recurse -File | Where-Object {$_.FullName -notlike '*\node_modules\*'})){
  $relative=$entry.FullName.Substring($workspace.Length+1)
  $target=Join-Path $payload $relative
  New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
  Copy-Item -LiteralPath $entry.FullName -Destination $target
 }
}
foreach($file in @('README.md','启动游戏.cmd')){Copy-Item -LiteralPath (Join-Path $workspace $file) -Destination (Join-Path $payload $file)}
$records=@(Get-ChildItem -LiteralPath $payload -Recurse -File | ForEach-Object { [ordered]@{path=$_.FullName.Substring($payload.Length+1).Replace('\','/');bytes=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()} })
[ordered]@{version=$Version;baseline=$BaselineVersion;createdUtc=[DateTime]::UtcNow.ToString('o');files=$records} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $destination 'manifest.json') -Encoding UTF8
Compress-Archive -Path (Join-Path $payload '*') -DestinationPath (Join-Path $destination ('bubble-arcade-v'+$Version+'.zip')) -CompressionLevel Optimal
Write-Output $destination
