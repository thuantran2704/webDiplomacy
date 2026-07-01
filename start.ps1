# start.ps1 — One-command setup + boot for webDiplomacy × Empirica
# Usage: .\start.ps1 [gameID]
param([string]$GameID = "1")

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

function Step($msg) { Write-Host "[setup] $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "  ✔ $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "  ! $msg" -ForegroundColor Yellow }

Write-Host ""
Write-Host "  webDiplomacy × Empirica — Starting up" -ForegroundColor Cyan
Write-Host "  ─────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

# ── 0. Docker running? ───────────────────────────────────────────────────────
Step "Checking Docker..."
try {
    docker info 2>&1 | Out-Null
    Ok "Docker is running."
} catch {
    Write-Error "Docker is not running. Open Docker Desktop and wait for 'Engine running', then retry."
    exit 1
}

# ── 1. Auto-copy config files ────────────────────────────────────────────────
Step "Checking config files..."

if (-not (Test-Path "$Root\config.php")) {
    Copy-Item "$Root\config.sample.php" "$Root\config.php"
    Ok "config.php created from sample."
}

if (-not (Test-Path "$Root\sse-server\.env")) {
    Copy-Item "$Root\sse-server\sample.env" "$Root\sse-server\.env"
    Ok "sse-server/.env created."
}

$EmpiricaEnv = "$Root\tools\empirica\.env"
if (-not (Test-Path $EmpiricaEnv)) {
    Copy-Item "$Root\tools\empirica\.env.example" $EmpiricaEnv
    Ok "tools/empirica/.env created."
}

# ── 2. PHP dependencies via Docker (no local PHP needed) ─────────────────────
if (-not (Test-Path "$Root\vendor\autoload.php")) {
    Step "Installing PHP dependencies via Docker (first time, ~1 min)..."
    docker run --rm -v "${Root}:/app" -e COMPOSER_ALLOW_SUPERUSER=1 composer:latest `
        config --no-plugins policy.advisories.block false 2>&1 | Out-Null
    docker run --rm -v "${Root}:/app" -e COMPOSER_ALLOW_SUPERUSER=1 composer:latest `
        update --no-interaction
    Ok "PHP dependencies installed."
}

# ── 3. Start Docker stack ────────────────────────────────────────────────────
Step "Starting Docker containers..."
docker compose --profile core --profile dev up -d
Ok "Containers started."

# ── 4. Wait for webDiplomacy ─────────────────────────────────────────────────
Step "Waiting for http://localhost:43000 (up to 120s)..."
$deadline = (Get-Date).AddSeconds(120)
$ready    = $false
while ((Get-Date) -lt $deadline) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:43000" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
        if ($r.StatusCode -lt 500) { $ready = $true; break }
    } catch {}
    Start-Sleep -Seconds 3
    Write-Host -NoNewline "."
}
Write-Host ""
if (-not $ready) {
    Write-Warning "webDiplomacy didn't respond in 120s."
    Write-Host "Check logs: docker compose logs webserver php-fpm"
    exit 1
}
Ok "webDiplomacy is up!"

# ── 5. First-time setup check ────────────────────────────────────────────────
$envContent = Get-Content $EmpiricaEnv -Raw
$needsKey   = ($envContent -match 'WEBDIP_API_KEY=your_api_key_here') -or
              ($envContent -match 'WEBDIP_API_KEY=\s*$')

if ($needsKey) {
    Write-Host ""
    Write-Host "══════════════════════════════════════════════════" -ForegroundColor Yellow
    Write-Host "  FIRST-TIME SETUP (do this once in your browser)" -ForegroundColor Yellow
    Write-Host "══════════════════════════════════════════════════" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  1. Register (quick shortcut — skips email):" -ForegroundColor White
    Write-Host "     http://localhost:43000/register.php?emailToken=9513e6f6%7C1665482821%7Ctest%40test.com" -ForegroundColor DarkCyan
    Write-Host ""
    Write-Host "  2. Become admin:" -ForegroundColor White
    Write-Host "     http://localhost:43000/gamemaster.php?gameMasterSecret=" -ForegroundColor DarkCyan
    Write-Host ""
    Write-Host "  3. Generate API key:" -ForegroundColor White
    Write-Host "     http://localhost:43000/admincp.php  →  API Keys tab  →  Generate" -ForegroundColor DarkCyan
    Write-Host ""
    Write-Host "  4. Paste the key into tools\empirica\.env:" -ForegroundColor White
    Write-Host "     WEBDIP_API_KEY=<your key>" -ForegroundColor DarkCyan
    Write-Host ""
    Write-Host "  5. Re-run:  .\start.ps1" -ForegroundColor White
    Write-Host ""
    Write-Host "  Email inbox (if needed): http://localhost:43001" -ForegroundColor DarkGray
    Write-Host "══════════════════════════════════════════════════" -ForegroundColor Yellow
    exit 0
}

# ── 6. Launch AI runners + Empirica app ──────────────────────────────────────
$env:GAME_ID = $GameID
Write-Host ""
Ok "Configuration looks good. Launching AI runners + Empirica app (game $GameID)..."
Set-Location "$Root\tools\empirica"
node start.js
