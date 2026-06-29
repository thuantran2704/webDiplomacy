# tools/empirica — AI runner, orchestrator, exporter

Node services that connect Empirica/webDiplomacy research games to AI players and capture data.

## Quick start
```bash
cd tools/empirica
cp .env.example .env   # set WEBDIP_API_KEY + AI_PROVIDER
npm install
npm start              # boots everything (Docker + runners + Empirica app)
```

## Scripts
| Command | What it does |
|---|---|
| `npm start` | Full stack boot (Docker → wait → AI runners → Empirica app) |
| `npm run runner` | One AI seat — polls board, decides, submits orders + messages |
| `npm run orchestrate` | Print seat/role/AI plan from config |
| `npm run admin` | Manage AI seats (list / set / unset / run commands) |
| `npm run export` | Dump all moves + dialog to `research-data/` |

## Manage AI seats
```bash
node src/admin-ai.js list  <gameID>
node src/admin-ai.js set   <gameID> <countryID> ollama llama3
node src/admin-ai.js unset <gameID> <countryID>
node src/admin-ai.js run   <gameID>   # prints ready-to-paste runner commands
```

## AI provider
`AI_PROVIDER=ollama` → `OLLAMA_BASE_URL` / `OLLAMA_MODEL`
`AI_PROVIDER=api` → `LLM_API_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`

> If webDiplomacy runs in Docker and Ollama is on the host use `http://host.docker.internal:11434`.

## Key .env values
| Variable | Example | Notes |
|---|---|---|
| `WEBDIP_BASE_URL` | `http://localhost:43000` | Local Docker port |
| `WEBDIP_API_KEY` | `abc123...` | Generate from admincp.php → API Keys |
| `GAME_ID` | `1` | Overridden per runner by `admin-ai run` |
| `COUNTRY_ID` | `2` | Overridden per runner |
| `DB_PORT` | `43003` | Exposed MariaDB port from docker-compose |
| `DB_PASS` | `mypassword123` | Default from docker-compose.yml |

Never commit `.env`. See [docs/empirica-integration/API_CONTRACT.md](../../docs/empirica-integration/API_CONTRACT.md) for full API reference.

