#!/usr/bin/env bash
# start.sh — Boot the full Empirica x webDiplomacy stack (Linux/macOS)
# Usage: ./start.sh [gameID]
set -euo pipefail
GAME_ID="${1:-1}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$ROOT/tools/empirica/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "WARNING: .env not found — copying from .env.example"
  cp "$ROOT/tools/empirica/.env.example" "$ENV_FILE"
  echo "Edit $ENV_FILE with your WEBDIP_API_KEY, then re-run."
  exit 1
fi

export GAME_ID="$GAME_ID"
echo "Starting full stack (game $GAME_ID)..."
cd "$ROOT/tools/empirica"
node start.js
