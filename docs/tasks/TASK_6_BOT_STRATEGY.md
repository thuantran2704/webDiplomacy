# TASK 6 — Bot Strategy

> **Goal:** Route each country seat to the correct bot system based on team config:
> native webDiplomacy bot for single-bot seats, Ollama runner for multi-bot seats,
> and bot-as-advisor mode when humans are present.
>
> **Contracts:** [`UNIVERSAL_CONTRACT.md §6`](../contracts/UNIVERSAL_CONTRACT.md#6-ai-output-contract), [`EVENT_SCHEMA.md — ai.decision, ai.throttled`](../contracts/EVENT_SCHEMA.md)
>
> **Depends on:** TASK 1 (Data API for logging), TASK 2 (team config, `bots` field)
>
> **Testable in isolation:** Yes — strategy selection logic is pure (no I/O). Integration tests require TASK 1+2.

---

## Bot modes

| Humans | Bots | Mode | Description |
|---|---|---|---|
| 0 | 1 | **Native** | webDiplomacy gunboat bot handles the seat; no custom runner spawned |
| 0 | N > 1 | **Coordinator** | One Ollama runner per bot; a designated "lead bot" submits orders; others post suggestions to intra-team chat |
| N > 0 | 0 | **Human only** | No bot; team config as normal |
| N > 0 | 1 | **Advisor** | Ollama runner runs but does NOT submit orders; posts suggested orders to intra-team chat as "Bot Advisor" |
| N > 0 | N > 1 | **Multi-advisor** | Multiple Ollama runners; all post suggestions to intra-team chat; human controller decides |

---

## What to build

### 6A — Strategy selector

`tools/empirica/src/botStrategy.js` — pure function, no I/O:

```js
// selectBotMode({ humans, bots }) → "native" | "coordinator" | "advisor" | "multi-advisor" | "none"
export function selectBotMode({ humans, bots }) {
  if (bots === 0)          return "none";
  if (humans === 0 && bots === 1) return "native";
  if (humans === 0 && bots > 1)  return "coordinator";
  if (humans > 0 && bots === 1)  return "advisor";
  if (humans > 0 && bots > 1)   return "multi-advisor";
}
```

### 6B — Native mode (webDiplomacy gunboat bot)

No custom runner spawned. The seat is flagged in `config/empirica.json` as `"bots": 1, "maxHumans": 0`.

The Empirica server callback (`onGameStart`) detects `mode === "native"` and calls the webDiplomacy bot registration API (or sets the seat to AI in the game creation params). No changes to the existing PHP adjudicator bot system.

> Implementation note: webDiplomacy has a `wD_BotGameQueue` table and `botgamecreate.php`. The orchestrator should set the country as bot-controlled at game creation time (via `gamecreate.php` or `api.php`) rather than trying to register the bot post-creation.

### 6C — Coordinator mode (multi-bot, no humans)

`start.js` spawns N Ollama runners. One is the "lead" (designated by `config.teams.X.leadBotIndex`, default 0). Only the lead calls `setOrders`. All bots post their reasoning to intra-team chat (scope: `intra`) via `POST api.php?route=team/message`.

Lead bot runner detects it is lead via `LEAD_BOT=true` env var set by `start.js`.

### 6D — Advisor mode (bot + humans)

Ollama runner spawned with `BOT_ADVISOR=true` env var. In this mode:
- Runner calls Ollama as normal, builds suggested orders
- Does NOT call `setOrders`
- Formats suggestions as human-readable text and calls `POST api.php?route=team/message` with sender label "🤖 Bot Advisor"
- Format:
  ```
  🤖 Bot Advisor suggests:
  • Munich → Berlin (Move)
  • Paris Hold
  • Brest → MAO (Move)
  "France looks weak in the south. Consider the convoy."
  ```
- Rate limits still apply (no spam)

### 6E — AI runner update

`tools/empirica/src/runner.js` changes:
- Accept `BOT_ADVISOR` env var — skip `setOrders`, call `sendAdvisorMessage` instead
- Accept `LEAD_BOT` env var — always call `setOrders` (existing behaviour)
- Both modes still log to Data API via `POST /api/v1/events { type: "ai.decision", ... }`
- Add `advisorMode: true` field to `ai.decision` payload when in advisor mode

### 6F — `start.js` spawner update

`tools/empirica/start.js` reads team config and spawns runners with correct env vars:

```js
for (const [countryName, team] of Object.entries(cfg.teams)) {
  const mode = selectBotMode({ humans: team.maxHumans, bots: team.bots ?? 0 });

  if (mode === "native") continue; // webDiplomacy handles it

  for (let i = 0; i < (team.bots ?? 0); i++) {
    const env = {
      ...process.env,
      GAME_ID:     gameID,
      COUNTRY_ID:  String(team.countryID),
      BOT_ADVISOR: (mode === "advisor" || mode === "multi-advisor") ? "true" : "false",
      LEAD_BOT:    (mode === "coordinator" && i === (team.leadBotIndex ?? 0)) ? "true" : "false",
    };
    spawn("node", ["src/runner.js"], { cwd: runnerDir, env, stdio: "inherit" });
  }
}
```

---

## Files to create / modify

| File | Change |
|---|---|
| `tools/empirica/src/botStrategy.js` | **NEW** — pure strategy selector |
| `tools/empirica/src/runner.js` | Add `BOT_ADVISOR` + `LEAD_BOT` mode handling |
| `tools/empirica/start.js` | Import `selectBotMode`, spawn runners per mode |
| `tools/empirica-app/server/callbacks.js` | Register native bot seat at game creation (mode = "native") |
| `config/empirica.sample.json` | Add `bots`, `leadBotIndex` fields |

---

## Test plan

### T6.1 — Strategy selector (unit, no I/O)
```js
import { selectBotMode } from "./botStrategy.js"
assert(selectBotMode({ humans: 0, bots: 1 }) === "native")
assert(selectBotMode({ humans: 0, bots: 2 }) === "coordinator")
assert(selectBotMode({ humans: 2, bots: 0 }) === "none")
assert(selectBotMode({ humans: 2, bots: 1 }) === "advisor")
assert(selectBotMode({ humans: 2, bots: 2 }) === "multi-advisor")
```

### T6.2 — Advisor mode does not submit orders
```js
// Mock webdip.js setOrders
// Run runner.js with BOT_ADVISOR=true
// After one tick: expect setOrders NOT called
// Expect team/message called with "🤖 Bot Advisor" text
// Expect /api/v1/events called with type: "ai.decision", payload.advisorMode: true
```

### T6.3 — Lead bot in coordinator mode submits orders
```js
// Run runner.js with LEAD_BOT=true, BOT_ADVISOR=false
// After one tick: expect setOrders called
// Expect team/message called with bot reasoning
// Expect /api/v1/events type: "ai.decision", payload.advisorMode: false
```

### T6.4 — Non-lead bot in coordinator mode does not submit orders
```js
// Run runner.js with LEAD_BOT=false, BOT_ADVISOR=false
// After one tick: expect setOrders NOT called
// Expect team/message called with suggestion text
```

### T6.5 — Native mode: no runner spawned
```js
// start.js with config: { England: { maxHumans: 0, bots: 1 } }
// Expect: no child process spawned for England
// (native bot registered via webDiplomacy at game creation)
```

### T6.6 — Integration: advisor suggestions appear in intra-team chat
```
Start game with England: { maxHumans: 1, bots: 1 }
Human joins as controller
Bot runner starts in advisor mode
After one poll cycle: intra-team chat shows "🤖 Bot Advisor suggests..."
rs_messages has row with from_country_id = England, to_team_id = England team
```

---

## Done criteria

- [ ] T6.1–T6.6 pass
- [ ] `selectBotMode` returns correct mode for all 5 input combinations
- [ ] Advisor mode never calls `setOrders`
- [ ] Lead bot in coordinator mode is the only one calling `setOrders`
- [ ] All bot actions (including advisor) log to Data API as `ai.decision`
- [ ] Native bot mode: no runner spawned, seat handed to webDiplomacy bot system
- [ ] Bot advisor messages appear in intra-team chat with "🤖 Bot Advisor" label
