param(
  [Parameter(Mandatory = $true)]
  [string]$PackageRoot
)

$ErrorActionPreference = 'Stop'
$sourceRoot = (Resolve-Path -LiteralPath $PackageRoot).Path
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$parserSource = Join-Path $sourceRoot 'parser\src\parsers'
$mappingSource = Join-Path $sourceRoot 'integration\map-marker-entity-map.csv'

if (-not (Test-Path -LiteralPath (Join-Path $parserSource 'hollow-knight.ts'))) {
  throw "Invalid Hollow Knight package root: $sourceRoot"
}
if (-not (Test-Path -LiteralPath $mappingSource)) {
  throw "Missing map marker mapping: $mappingSource"
}

$parserDestination = Join-Path $repositoryRoot 'app\save-parser\vendor\parsers'
New-Item -ItemType Directory -Force -Path $parserDestination | Out-Null
Copy-Item -Path (Join-Path $parserSource '*') -Destination $parserDestination -Recurse -Force
Get-ChildItem -Path $parserDestination -Recurse -Filter '*.ts' | ForEach-Object {
  $content = Get-Content -LiteralPath $_.FullName -Raw -Encoding utf8
  $content = $content.Replace('"../../../data/', '"../../data/')
  Set-Content -LiteralPath $_.FullName -Value $content -Encoding utf8
}

$dataAreas = @('abilities', 'achievements', 'bosses', 'challenges', 'collectibles', 'journal', 'key-items', 'npcs')
foreach ($area in $dataAreas) {
  $generatedSource = Join-Path $sourceRoot "data\hollow-knight\$area\generated"
  $generatedDestination = Join-Path $repositoryRoot "app\save-parser\data\hollow-knight\$area\generated"
  New-Item -ItemType Directory -Force -Path $generatedDestination | Out-Null
  Copy-Item -Path (Join-Path $generatedSource '*.json') -Destination $generatedDestination -Force
}

$mapping = Import-Csv -LiteralPath $mappingSource | ForEach-Object {
  [ordered]@{
    groupName = $_.group_name
    mapSequence = [int]$_.map_sequence
    markerId = $_.marker_id
    parserId = $_.parser_id
    module = $_.module
  }
}
$mappingDestination = Join-Path $repositoryRoot 'app\save-parser\parser-mapid-map.json'
$mapping | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $mappingDestination -Encoding utf8

Write-Output "Synced Hollow Knight parser and $($mapping.Count) marker mappings from $sourceRoot"
