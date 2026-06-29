# API Contract — Empirica × webDiplomacy

Single source of truth for every API the integration touches or adds. **Rule: review this file
before adding/changing any API; update it in the same commit whenever an endpoint is added,
changed, or removed.** Last verified: 2026-06-28.

## webDiplomacy API (`api.php`, Bearer token)

| Route | Method | Args | Use |
|---|---|---|---|
| `game/status` | GET | gameID, countryID | turn/phase/state poll |
| `game/data` | GET | gameID, countryID | board + units for decision |
| `game/members` | GET | gameID | seat/country list |
| `game/overview` | GET | gameID | game config |
| `game/getmessages` | GET | gameID, countryID, sinceTime | read dialog |
| `game/sendmessage` | JSON | gameID, countryID, toCountryID, message | send dialog |
| `game/orders` | JSON | gameID, turn, phase, countryID, orders, ready | submit moves |

Auth: `Authorization: Bearer <WEBDIP_API_KEY>`. Submitting for a country you don't control needs
explicit `wD_ApiPermissions`. Capture tables: `wD_Orders`, `wD_GameMessages`.

## Internal tool surfaces (`tools/empirica/`)

| Module | Exports | Contract |
|---|---|---|
| `webdip.js` | getStatus, getData, getMessages, sendMessage, setOrders | thin wrappers over routes above |
| `ai.js` | decide(prompt) | returns `{ orders:[], messages:[{to,text}] }`; provider ollama\|api |
| export.js | (script) | dumps wD_Orders + wD_GameMessages |

## AI JSON output contract
`{ "orders": [...], "messages": [{ "to": <countryID>, "text": "..." }] }`

## Changelog
- 2026-06-28: initial — documented 7 webDip routes + tool surfaces.
