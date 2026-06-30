# webDiplomacy × Empirica Research Platform

A research platform that layers **Empirica** (participant recruitment + surveys) over the **webDiplomacy** game engine. Participants fill out a consent/demographics form, get assigned to a game, and play Diplomacy with configurable human/AI teammates — with every move and message captured for research.

**Key features:**
- Human/AI/mixed teams — up to 2 players per country seat, 1 decision maker
- AI powered by local Ollama models or any OpenAI-compatible API
- Full move + dialog capture to JSONL for research
- Configurable per-team, per-country seat via a single JSON file

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Install](#2-install)
3. [Configure](#3-configure)
4. [First-time Setup](#4-first-time-setup)
5. [Run Everything](#5-run-everything)
6. [Configure Game Teams & AI](#6-configure-game-teams--ai)
7. [Day-to-Day Commands](#7-day-to-day-commands)
8. [Export Research Data](#8-export-research-data)
9. [URLs & Ports](#9-urls--ports)
10. [Troubleshooting](#10-troubleshooting)
11. [Architecture](#11-architecture)

---

## 1. Prerequisites

Install all of these before starting.

| Tool | Min Version | Install |
|---|---|---|
| **Docker Desktop** | latest | https://www.docker.com/products/docker-desktop |
| **Node.js** | 18+ | https://nodejs.org |
| **PHP + Composer** | PHP 8.1+ | https://getcomposer.org |
| **Git** | any | https://git-scm.com |
| **Ollama** *(optional — only for local AI)* | latest | https://ollama.com/download |

> **Windows note:** Enable virtualization in BIOS and ensure Docker Desktop is set to WSL2 mode. If npm has symlink issues in WSL, enable Developer Mode in Windows Settings → System → For Developers.

---

## 2. Install

```bash
# Clone the repo
git clone https://github.com/thuantran2704/webDiplomacy.git
cd webDiplomacy

# PHP dependencies
composer update

# Node dependencies — AI runner
cd tools/empirica
npm install
cd ../..

# Node dependencies — Empirica participant app
cd tools/empirica-app
npm install
cd ../..
```

---

## 3. Configure

Three `.env` files need to be created. Copy from the examples:

```bash
# AI runner
cp tools/empirica/.env.example tools/empirica/.env

# Empirica participant app
cp tools/empirica-app/.env.example tools/empirica-app/.env

# SSE real-time server
cp sse-server/sample.env sse-server/.env
```

### `tools/empirica/.env` — key values to fill in

| Variable | Default | What to change |
|---|---|---|
| `WEBDIP_BASE_URL` | `http://localhost:43000` | Leave as-is for local dev |
| `WEBDIP_API_KEY` | *(empty)* | **Fill in after step 4.4** |
| `AI_PROVIDER` | `ollama` | `ollama` for local · `api` for OpenAI/etc |
| `OLLAMA_MODEL` | `llama3` | Any model you've pulled |
| `LLM_API_KEY` | *(empty)* | Only needed if `AI_PROVIDER=api` |
| `LLM_MODEL` | `gpt-4o-mini` | Only needed if `AI_PROVIDER=api` |
| `DB_PASS` | `mypassword123` | Must match `docker-compose.yml` |

> All other values work out-of-the-box for local Docker development.

### `sse-server/.env` — key values

| Variable | Default | What to change |
|---|---|---|
| `SSE_SECRET` | *(empty)* | Must match `SSE_SECRET` in `config.php` |
| `REDIS_HOST` | `redis` | Leave as-is (Docker service name) |

### PHP config

```bash
cp config.sample.php config.php
# config.php is gitignored — edit freely
```

The defaults in `config.sample.php` work for local Docker. The only value you must set is `SSE_SECRET` (copy it from `config.php` into `sse-server/.env`).

---

## 4. First-time Setup

> Do this **once** after the stack starts for the first time. Skip on subsequent runs.

### 4.1 Start the core stack

```powershell
# Windows
.\start.ps1

# Mac/Linux
./start.sh
```

Wait for the message: `webDiplomacy is up`. This may take 2–3 minutes on first boot while the database initialises.

### 4.2 Register an admin account

Open http://localhost:43001 (Mailhog) in one browser tab — this is your local email inbox.

Then register at: http://localhost:43000/register.php

Check Mailhog for the confirmation link and complete registration.

### 4.3 Grant yourself admin

Visit (using `config.sample.php` defaults):

```
http://localhost:43000/gamemaster.php?gameMasterSecret=
```

*(If you changed `gameMasterSecret` in `config.php`, append it after the `=`.)*

### 4.4 Generate an API key

1. Go to http://localhost:43000/admincp.php → **API Keys** tab
2. Click **Generate new key** for your admin user
3. Copy the key and paste it into `tools/empirica/.env`:
   ```
   WEBDIP_API_KEY=<your key here>
   ```

### 4.5 If using local AI (Ollama)

```bash
ollama pull llama3
```

Pull any other models you want — e.g. `ollama pull mistral`.

### 4.6 Restart

Stop the script (Ctrl+C) and run `.\start.ps1` again. The runner will now authenticate successfully.

---

## 5. Run Everything

### Full stack (recommended)

```powershell
# Windows — game ID 1 (default)
.\start.ps1

# Windows — specific game
.\start.ps1 -GameID 3

# Mac/Linux
./start.sh 1
```

This single command:
1. Starts Docker (webDiplomacy + MariaDB + Redis + SSE server)
2. Waits until http://localhost:43000 responds
3. Checks Ollama is reachable (if `AI_PROVIDER=ollama`)
4. Spawns one AI runner process per AI seat in `config/empirica.json`
5. Starts the Empirica participant app

Press **Ctrl+C** to shut down all processes cleanly.

### Start services individually

```powershell
# Core Docker stack only
docker compose --profile core up -d

# Add dev tools (Mailhog + phpMyAdmin)
docker compose --profile core --profile dev up -d

# Stop everything
docker compose down

# One AI runner for a specific seat
cd tools/empirica
$env:GAME_ID=1; $env:COUNTRY_ID=2; npm run runner

# Empirica participant app only
cd tools/empirica-app
npm start

# SSE server only
cd sse-server
node server.js
```

---

## 6. Configure Game Teams & AI

Edit **`config/empirica.json`** (copy from `config/empirica.sample.json`):

```bash
cp config/empirica.sample.json config/empirica.json
```

```jsonc
{
  "variantID": 1,
  "teams": {
    "England": {
      "seatA": "human",       // "human" or "ai"
      "seatB": "ai",          // second seat — omit or set "human" if unused
      "decisionMaker": "A",   // which seat submits orders: "A" or "B"
      "ai": {
        "provider": "ollama", // "ollama" or "api"
        "model": "llama3"
      }
    },
    "France": {
      "seatA": "ai",
      "seatB": "ai",
      "decisionMaker": "A",
      "ai": { "provider": "api", "model": "gpt-4o-mini" }
    },
    "Germany": {
      "seatA": "human",
      "seatB": "human",
      "decisionMaker": "A"
    }
  },
  "maxPlayersPerTeam": 2,
  "collectMoves": true,    // log all orders to research-data/events.jsonl
  "collectDialog": true    // log all messages to research-data/events.jsonl
}
```

**Seat patterns:**

| Pattern | seatA | seatB | decisionMaker |
|---|---|---|---|
| Solo human | `human` | *(omit)* | `A` |
| Human + AI observer | `human` | `ai` | `A` |
| AI + Human advisor | `ai` | `human` | `A` |
| Fully automated AI | `ai` | *(omit)* | `A` |
| Two humans, one decides | `human` | `human` | `A` |

### Assign AI seats at runtime

```bash
cd tools/empirica

# Show all country seats for a game
node src/admin-ai.js list <gameID>

# Assign an AI to a seat
node src/admin-ai.js set <gameID> <countryID> ollama llama3
node src/admin-ai.js set <gameID> <countryID> api gpt-4o-mini

# Remove an AI from a seat
node src/admin-ai.js unset <gameID> <countryID>

# Print ready-to-run runner commands for all AI seats
node src/admin-ai.js run <gameID>
```

---

## 7. Day-to-Day Commands

All from the `tools/empirica/` directory unless noted.

```bash
# Run all unit tests (13 tests)
npm test

# See seat/role plan from config
npm run orchestrate

# Manually trigger a research data export
npm run export
```

```bash
# Rebuild React frontend (from beta-src/)
cd beta-src
npm run build    # outputs to ../beta/

# Run frontend dev server with hot reload
npm start
```

---

## 8. Export Research Data

After a game session, dump all moves and messages to JSON:

```bash
cd tools/empirica
node src/export.js
```

**Output files:**

| File | Contents |
|---|---|
| `research-data/events.jsonl` | Live AI decision log (written during play) |
| `research-data/orders.json` | All orders from `wD_Orders` table |
| `research-data/messages.json` | All messages from `wD_GameMessages` table |

Each line of `events.jsonl` is a self-contained JSON object:

```jsonc
{
  "type": "decision",
  "gameID": 1, "countryID": 2, "turn": 3, "phase": "Diplomacy",
  "provider": "ollama", "model": "llama3",
  "orders": [{"type": "Hold", "terrID": 14}],
  "messages": [{"to": 3, "text": "Let's work together."}],
  "validationErrors": [],
  "llmMs": 1240
}
```

---

## 9. URLs & Ports

| Service | URL | Notes |
|---|---|---|
| **webDiplomacy** | http://localhost:43000 | Main game site |
| **Mailhog** (email) | http://localhost:43001 | Local email inbox for registration |
| **phpMyAdmin** | http://localhost:43002 | DB browser (dev profile only) |
| **MariaDB** | `localhost:43003` | Direct DB access |
| **Empirica app** | http://localhost:3000 | Participant intake form |
| **SSE server** | http://localhost:43006 | Real-time events |
| **Ollama** | http://localhost:11434 | Local LLM API |

---

## 10. Troubleshooting

### "webDiplomacy is not up after 120s"

- Check Docker Desktop is running
- Run `docker compose --profile core logs web` for PHP errors
- Visit http://localhost:43000/gamemaster-entrypoint.txt — shows DB init status

### "API key invalid / 401"

- Regenerate key at http://localhost:43000/admincp.php → API Keys
- Make sure `WEBDIP_API_KEY` in `tools/empirica/.env` matches exactly (no trailing whitespace)

### "Ollama connection refused"

- Confirm Ollama is running: `ollama list`
- If webDiplomacy is inside Docker and Ollama is on your host, set `OLLAMA_BASE_URL=http://host.docker.internal:11434` in `.env`

### Runner submits no orders

- Check `research-data/events.jsonl` for `"type":"error"` entries
- Verify the `COUNTRY_ID` matches a country that actually exists in that game
- Confirm the game phase is active (not waiting for players to join)

### npm symlink errors on Windows

Enable Developer Mode: **Settings → System → For Developers → On**

### DB connection refused on export

- MariaDB is exposed on port `43003` (not the standard 3306)
- Confirm `DB_PORT=43003` in `tools/empirica/.env`
- Confirm Docker is running: `docker ps | grep webdiplomacy-db`

---

## 11. Architecture

```
Participants
    │
    ▼
Empirica app (localhost:3000)
    │  consent form → demographic survey → seat assignment
    │
    ▼
webDiplomacy (localhost:43000)  ←──────────────────────┐
    │  PHP + MariaDB + Redis                            │
    │  REST API: api.php?route=game/*                   │
    │                                                   │
    ├── SSE server (localhost:43006)  [real-time push]  │
    │                                                   │
    └── AI runners (Node.js, one per AI seat) ──────────┘
            │
            ├── Ollama (localhost:11434)  [local models]
            └── OpenAI / any API         [hosted models]
                        │
                        ▼
            research-data/events.jsonl   [every decision logged]
```

**Key source files:**

| What | Where |
|---|---|
| API routes | `api.php` |
| AI runner pipeline | `tools/empirica/src/runner.js` |
| AI provider switch | `tools/empirica/src/ai.js` |
| Order validation | `tools/empirica/src/orders.js` |
| Rate limiting | `tools/empirica/src/ratelimit.js` |
| Research logger | `tools/empirica/src/logger.js` |
| webDip API client | `tools/empirica/src/webdip.js` |
| Unit tests | `tools/empirica/src/test.js` |
| Team/seat config | `config/empirica.json` |
| DB schema | `install/FullInstall/fullInstall.sql` |
| API contract docs | `docs/empirica-integration/API_CONTRACT.md` |

---

## Contributing

We welcome pull requests that are well-tested, scoped to one fix, and maintain the existing code style. See [`.github/PHILOSOPHY.md`](.github/PHILOSOPHY.md) for development principles.

## License

AGPL-3.0 — see [AGPL.txt](AGPL.txt).

If you get errors for files within /javascript/ it is because some default Apache configurations use this as a shared folder by default. Disable this alias to resolve.

---

http://webdiplomacy.net/ - The official webDiplomacy server.

https://github.com/kestasjk/webDiplomacy - The webDiplomacy github source repository.

---

To get Philippe Paquette's MILA bots working with the base webDip docker install do:
Ensure that the IP address is the IP of the machine hosting docker (there is probably some docker context/network wizardry to do this..)

docker pull public.ecr.aws/n4k3z7o3/webdiplomacy:latest
docker run -d --env API_WEBDIPLOMACY=http://172.21.16.1:43000/api.php --env API_KEY_USER_01=bot1 --env API_KEY_USER_02=bot2 --env API_KEY_USER_03=bot3 --env API_KEY_USER_04=bot4 --env API_KEY_USER_05=bot5 --env API_KEY_USER_06=bot6 public.ecr.aws/n4k3z7o3/webdiplomacy:latest




Kestas J. Kuliukas - kestas@kuliukas.com
