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
| `orders.js` | validateOrders, buildPrompt | validates/sanitizes AI output; builds structured board prompt |
| `admin-ai.js` | (CLI) | list/set/unset AI seats; print runner commands |
| `export.js` | (script) | dumps wD_Orders + wD_GameMessages |

## Exact order object (`game/orders` → `orders[]`)
Verified from `api.php SetOrders` + `api/responses/order.php`.
```jsonc
{
  "terrID":     42,          // int — territory where the unit stands
  "type":       "Move",      // see valid types per phase below
  "toTerrID":   17,          // int|null — required for Move/Support hold/Support move/Convoy/Retreat
  "fromTerrID": null,        // int|null — required for Support move/Convoy
  "viaConvoy":  null,        // bool|null
  "countryID":  3,           // int — the submitting country
  "convoyPath": []           // optional array of terrIDs
}
```
Valid types per phase:
- **Diplomacy**: Hold | Move | Support hold | Support move | Convoy
- **Retreats**: Retreat | Disband
- **Builds**: Build Army | Build Fleet | Destroy | Wait

## `game/data` response shape (verified from `api.php GetGameData`)
```jsonc
{
  "units": [{ "unitType": "Army|Fleet", "terrID": int, "countryID": int, "retreating": "Yes|No" }],
  "territoryStatuses": [{ "terrID": int, "countryID": int }],
  "territories": [...],
  "currentOrders": [ /* same shape as order object above */ ],
  "contextVars": { "context": {}, "contextKey": "" },
  "turn": int, "phase": "Diplomacy|Retreats|Builds|Pre-game|Finished",
  "isSandboxMode": bool
}
```

## `game/status` response — delegates to `GameState::toJson()`
Key fields used by runner: `phase`, `turn`.

## AI JSON output contract
```jsonc
{
  "orders":   [ /* order objects */ ],
  "messages": [{ "to": 2, "text": "Let's work together." }]
}
```
`orders.js::validateOrders()` strips invalid orders before submission.

## Empirica app surfaces (`tools/empirica-app/`)
| File | Purpose |
|---|---|
| `server/callbacks.js` | Assigns seats on round/stage start; sets `boardUrl` per player |
| `client/Intro.jsx` | Consent + demographics form; sets `player.demographics` |
| `client/Stage.jsx` | Embeds webDiplomacy board in iframe |
| `client/App.jsx` | Wires intro + stage + exit |

## Changelog
- 2026-06-28: initial — documented 7 webDip routes + tool surfaces.
- 2026-06-28: added exact order schema (verified from PHP source); added orders.js, admin-ai.js, empirica-app surfaces.
