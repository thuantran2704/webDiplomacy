# tools/empirica — AI runner, orchestrator, exporter

Node services that connect Empirica/webDiplomacy research games to AI players and capture data.

## Setup
```bash
cd tools/empirica
cp .env.example .env   # fill WEBDIP_API_KEY, choose AI_PROVIDER, set GAME_ID/COUNTRY_ID
npm install
```

## Run
- `npm run runner` — one AI seat: polls `game/status`, decides via Ollama/API, submits `game/orders` + `game/sendmessage`. Run one per AI country.
- `npm run orchestrate` — reads `config/empirica.sample.json`, prints seat/role/AI plan (decision-maker = only DM seat gets orders key).
- `npm run export` — dumps `wD_Orders` + `wD_GameMessages` to `research-data/` (every move + dialog).

## Provider
`AI_PROVIDER=ollama` (default, `OLLAMA_BASE_URL`/`OLLAMA_MODEL`) or `api` (`LLM_API_*`). Docker→host Ollama: use `http://host.docker.internal:11434`. Keep `.env` uncommitted.
