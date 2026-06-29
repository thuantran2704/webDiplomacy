# start.ps1 — Boot the full Empirica x webDiplomacy stack (Windows)
# Usage: .\start.ps1  [gameID]
param([string]$GameID = "1")

$ErrorActionPreference = "Stop"
$Root = Split-Path $MyInvocation.MyCommand.Path -Parent

# Ensure .env exists for the runner
$EnvFile = Join-Path $Root "tools\empirica\.env"
if (-not (Test-Path $EnvFile)) {
    Write-Warning ".env not found at $EnvFile — copying from .env.example"
    Copy-Item (Join-Path $Root "tools\empirica\.env.example") $EnvFile
    Write-Host "Edit $EnvFile with your WEBDIP_API_KEY before running." -ForegroundColor Yellow
    exit 1
}

# Forward GAME_ID so start.js picks it up
$env:GAME_ID = $GameID

Write-Host "Starting full stack (game $GameID)..." -ForegroundColor Cyan
Set-Location (Join-Path $Root "tools\empirica")
node start.js
