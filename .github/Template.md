# Template.md — API & Data Contract

> The **what**: every endpoint, payload, response shape, and data schema.
> Companion to [`Style.md`](./Style.md). Update this file **first** when adding or
> changing any endpoint or schema. Enforced by CI (`workflows/contract-check.yml`).
> Also mirrored in detail at `docs/empirica-integration/API_CONTRACT.md`.

## 1. Conventions
- Base path: `http://localhost:43000/api.php?route=<route>`
- Content type: `application/json`
- Auth: `Authorization: Bearer <WEBDIP_API_KEY>` (key stored in `wD_ApiKeys`, generated via `admincp.php`)
- GET routes pass params as query strings; JSON routes (`'JSON'` type) pass body as JSON POST.

## 2. Data schema (key research tables)

| Table | Key fields | Notes |
|---|---|---|
| `wD_Orders` | `id, gameID, countryID, unitID, type, toTerrID, fromTerrID, viaConvoy` | Every move — primary research capture |
| `wD_GameMessages` | `id, gameID, fromCountryID, toCountryID, message, timeSent, turn` | Every dialog message |
| `wD_ApiKeys` | `apiKey varchar(80), userID` | Bearer tokens — never commit |
| `wD_ApiPermissions` | `userID, getStateOfAllGames, submitOrdersForUserInCD, listGamesWithPlayersInCD` | Per-key permission flags |
| `wD_Members` | `gameID, userID, countryID, status, orderStatus` | Seat assignments |

## 3. Endpoints

| Method | Route | Auth permission | Params | Response |
|---|---|---|---|---|
| GET | `game/status` | `getStateOfAllGames` | `gameID, countryID` | `{ phase, turn, ... }` |
| GET | `game/data` | `getStateOfAllGames` | `gameID, countryID` | `{ units, territoryStatuses, territories, currentOrders, contextVars, turn, phase, isSandboxMode }` |
| GET | `game/members` | `getStateOfAllGames` | `gameID` | `{ members: [...], user?: { member } }` |
| GET | `game/overview` | `getStateOfAllGames` | `gameID` | game config object |
| GET | `game/getmessages` | `getStateOfAllGames` | `gameID, countryID, sinceTime` | array of message objects |
| POST | `game/sendmessage` | none (must control country) | `{ gameID, countryID, toCountryID, message }` | `{ messages: [] }` |
| POST | `game/orders` | `submitOrdersForUserInCD` (if not owner) | `{ gameID, turn, phase, countryID, orders[], ready }` | array of current orders |

### Order object (sent in `orders[]`)
```jsonc
{
  "terrID":     42,       // int — unit's current territory
  "type":       "Move",   // Diplomacy: Hold|Move|Support hold|Support move|Convoy; Retreats: Retreat|Disband; Builds: Build Army|Build Fleet|Destroy|Wait
  "toTerrID":   17,       // required for Move, Support hold, Support move, Convoy, Retreat
  "fromTerrID": null,     // required for Support move, Convoy
  "viaConvoy":  null,     // bool|null
  "countryID":  3,
  "convoyPath": []        // optional
}
```

### AI output contract (runner → webDip)
```jsonc
{ "orders": [ /* order objects */ ], "messages": [{ "to": 2, "text": "..." }] }
```
Validated by `tools/empirica/src/orders.js::validateOrders()` before submission.

## 4. Rate limits (enforced in `ratelimit.js`)
| Limit | Default | Env override |
|---|---|---|
| Min interval between LLM calls per seat | 5 000 ms | `RATE_MIN_LLM_INTERVAL_MS` |
| Max messages per turn per seat | 3 | `RATE_MAX_MESSAGES_PER_TURN` |

## 5. Research data output (`logger.js`)
All events appended to `research-data/events.jsonl` (one JSON object per line):
```jsonc
{ "ts": "ISO8601", "type": "decision|throttled|error", "gameID": 1, "countryID": 2,
  "turn": 3, "phase": "Diplomacy", "provider": "ollama", "model": "llama3",
  "orders": [], "messages": [], "validationErrors": [], "llmMs": 420 }
```

## 6. Error conventions
- All API errors return `{ "error": "message", "code": "ERR-CODE" }` (from PHP `JSONResponse()`).
- Status codes: `400` bad input, `401` no key, `403` forbidden, `404` unknown route, `500` internal.
- AI runner errors are caught, logged via `logger.js`, and never crash the process.
