# Empirica Integration — Setup

> ⚠️ **SUPERSEDED** — Setup instructions have moved to the root [`README.md`](../../README.md).
> Do not follow these instructions; run `npm run setup` instead.

## Prerequisites

- webDiplomacy running (Docker: `docker-compose up -d`, DB from `install/FullInstall/fullInstall.sql`).
- Node.js 18+ (Empirica + orchestrator + AI runner).
- Empirica CLI: `curl https://install.empirica.dev | sh`.
- (Optional) Ollama for local models: `ollama serve` + `ollama pull llama3`.

## APIs you need

1. **webDiplomacy API** (`api.php`) — enable in `config.php`:
   - `Config::$apiConfig['enabled'] = true;`
   - Issue API keys (admin) and, for AI/orchestrator, explicit submit permission.
   - Restrict to research games via `Config::$apiConfig['restrictToGameIDs']`.
2. **LLM API** — Ollama (`http://localhost:11434`) or hosted (OpenAI-compatible).
3. **Empirica** — runs its own server; needs the board launch URL.

## .env (orchestrator + AI runner — never commit real values)

```env
# webDiplomacy
WEBDIP_BASE_URL=http://localhost:80
WEBDIP_API_KEY=your_api_key_here
WEBDIP_RESTRICT_GAME_IDS=

# AI provider: "ollama" or "api"
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
LLM_API_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=
LLM_MODEL=gpt-4o-mini

# Empirica
EMPIRICA_BOARD_URL=http://localhost:80/board.php
RESEARCH_EXPORT_DIR=./research-data
```

## Steps

1. Start webDiplomacy + MySQL; enable API and create API key(s).
2. Configure teams: copy `config/empirica.sample.json` → set each country's seats/roles/AI mode.
3. Start AI runner (per AI seat) pointed at `WEBDIP_API_KEY`, choosing Ollama or API.
4. Run Empirica app; participants fill the form, get assigned, redirect to `EMPIRICA_BOARD_URL`.
5. Export research data: orders (`wD_Orders`) + messages (`wD_GameMessages`) + Empirica surveys.

## Notes / things to know

- API key permission: country control vs CD submission differs (`SetOrders` in `api.php`); AI runner
  needs explicit permission.
- 2-player team + single decision maker is enforced by the orchestrator, not the adjudicator.
- All moves and dialog are already stored — no core schema change needed for capture.
- Keep keys/LLM keys in `.env` only; do not commit. Order/error logs must stay out of web root.
