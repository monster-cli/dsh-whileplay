param(
  [string]$HarnessRoot = $env:DSH_SOURCE_ROOT,
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$HarnessArgs
)
$ErrorActionPreference = 'Stop'
$pluginRoot = Split-Path $PSScriptRoot -Parent
$entry = Join-Path $pluginRoot 'index.js'
if ([string]::IsNullOrWhiteSpace($HarnessRoot)) { throw 'Pass -HarnessRoot or set DSH_SOURCE_ROOT to a prepared DeepSeek Harness source checkout.' }
$HarnessRoot = (Resolve-Path -LiteralPath $HarnessRoot).Path
if (-not (Test-Path -LiteralPath (Join-Path $HarnessRoot 'apps\cli\src\bin.ts'))) { throw "Harness source not found: $HarnessRoot" }
Push-Location $pluginRoot
try {
  node scripts/build.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Plugin build failed' }
  $runtimeDir = Join-Path $pluginRoot '.runtime'
  New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
  $overlay = Join-Path $runtimeDir 'arcade.patch.yml'
  $entryUrl = ([System.Uri]$entry).AbsoluteUri
  "- insert:`n    - id: whileplay`n      name: '$entryUrl'" | Set-Content -LiteralPath $overlay -Encoding utf8
  Push-Location $HarnessRoot
  try {
    node --import tsx/esm apps/cli/src/bin.ts web --patch $overlay @HarnessArgs
  } finally { Pop-Location }
} finally { Pop-Location }
