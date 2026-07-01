#!/usr/bin/env bash
# start.sh — One-command setup + boot for webDiplomacy × Empirica (Linux/macOS)
# Usage: ./start.sh [gameID]
set -euo pipefail
GAME_ID="${1:-1}"
ROOT="$(cd "$(dirname "$0")" && pwd)"

step() { echo "[setup] $1"; }
ok()   { echo "  ✔ $1"; }

echo ""
echo "  webDiplomacy × Empirica — Starting up"
echo "  ─────────────────────────────────────"
echo ""

# ── 0. Docker ──────────────────────────────────────────────────────────────
step "Checking Docker..."
docker info > /dev/null 2>&1 || { echo "ERROR: Docker is not running. Start Docker Desktop first."; exit 1; }
ok "Docker is running."

# ── 1. Config files ────────────────────────────────────────────────────────
step "Checking config files..."
[ ! -f "$ROOT/config.php" ]              && cp "$ROOT/config.sample.php"              "$ROOT/config.php"              && ok "config.php created."
[ ! -f "$ROOT/sse-server/.env" ]         && cp "$ROOT/sse-server/sample.env"          "$ROOT/sse-server/.env"         && ok "sse-server/.env created."
[ ! -f "$ROOT/tools/empirica/.env" ]     && cp "$ROOT/tools/empirica/.env.example"    "$ROOT/tools/empirica/.env"     && ok "tools/empirica/.env created."

# ── 2. PHP deps via Docker ─────────────────────────────────────────────────
if [ ! -f "$ROOT/vendor/autoload.php" ]; then
  step "Installing PHP dependencies via Docker (first time, ~1 min)..."
  docker run --rm -v "$ROOT:/app" -e COMPOSER_ALLOW_SUPERUSER=1 composer:latest \
    config --no-plugins policy.advisories.block false > /dev/null 2>&1
  docker run --rm -v "$ROOT:/app" -e COMPOSER_ALLOW_SUPERUSER=1 composer:latest \
    update --no-interaction
  ok "PHP dependencies installed."
fi

# ── 3. Docker stack ────────────────────────────────────────────────────────
step "Starting Docker containers..."
docker compose --profile core --profile dev up -d
ok "Containers started."

# ── 4. Wait for webDiplomacy ───────────────────────────────────────────────
step "Waiting for http://localhost:43000 (up to 120s)..."
DEADLINE=$((SECONDS + 120))
READY=0
while [ $SECONDS -lt $DEADLINE ]; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:43000 2>/dev/null || echo "000")
  if [ "$STATUS" -lt 500 ] && [ "$STATUS" -gt 0 ]; then READY=1; break; fi
  sleep 3; printf "."
done
echo ""
[ $READY -eq 0 ] && { echo "ERROR: webDiplomacy did not start in time. Run: docker compose logs webserver php-fpm"; exit 1; }
ok "webDiplomacy is up!"

# ── 5. First-time setup check ──────────────────────────────────────────────
ENV_FILE="$ROOT/tools/empirica/.env"
if grep -qE 'WEBDIP_API_KEY=your_api_key_here|WEBDIP_API_KEY=$' "$ENV_FILE"; then
  echo ""
  echo "══════════════════════════════════════════════════"
  echo "  FIRST-TIME SETUP (do this once in your browser)"
  echo "══════════════════════════════════════════════════"
  echo ""
  echo "  1. Register (quick shortcut):"
  echo "     http://localhost:43000/register.php?emailToken=9513e6f6%7C1665482821%7Ctest%40test.com"
  echo ""
  echo "  2. Become admin:"
  echo "     http://localhost:43000/gamemaster.php?gameMasterSecret="
  echo ""
  echo "  3. Generate API key:"
  echo "     http://localhost:43000/admincp.php  →  API Keys tab  →  Generate"
  echo ""
  echo "  4. Paste into tools/empirica/.env:"
  echo "     WEBDIP_API_KEY=<your key>"
  echo ""
  echo "  5. Re-run:  ./start.sh"
  echo ""
  echo "  Email inbox: http://localhost:43001"
  echo "══════════════════════════════════════════════════"
  exit 0
fi

# ── 6. Launch AI runners + Empirica app ───────────────────────────────────
export GAME_ID="$GAME_ID"
ok "Configuration looks good. Launching AI runners + Empirica app (game $GAME_ID)..."
cd "$ROOT/tools/empirica"
node start.js
