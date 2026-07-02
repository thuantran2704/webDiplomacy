# Universal Contract

> **Single source of truth** for every API, payload shape, auth scheme, and rate limit in the platform.
> Referenced by all task documents and all service implementations.
> **Rule:** any endpoint or schema change must be reflected here in the same commit.
> Last verified: 2026-07-01. Supersedes `docs/empirica-integration/API_CONTRACT.md` and `.github/Template.md` §3.

---

## Table of contents

1. [Auth model](#1-auth-model)
2. [webDiplomacy API — existing routes](#2-webdiplomacy-api--existing-routes)
3. [webDiplomacy API — new team routes](#3-webdiplomacy-api--new-team-routes)
4. [Data API](#4-data-api)
5. [SSE event shapes](#5-sse-event-shapes)
6. [AI output contract](#6-ai-output-contract)
7. [Rate limits](#7-rate-limits)
8. [Error envelope](#8-error-envelope)

---

## 1. Auth model

| Token | Name in `.env` | Used by | Scope |
|---|---|---|---|
| `WEBDIP_API_KEY` | webDiplomacy Bearer token | AI runner, Empirica server callbacks, Data API (for mirroring messages) | webDiplomacy `api.php` |
| `DATA_API_KEY` | Data API internal token | AI runner, Empirica app, Empirica server, PHP (new team routes) | Data API `:4000` |

Both tokens are passed as:
```
Authorization: Bearer <TOKEN>
```

Tokens are never logged, never committed, never returned in API responses.
Admin actions additionally require the webDiplomacy API key to belong to a user with admin status.

---

## 2. webDiplomacy API — existing routes

Base: `http://localhost:43000/api.php?route=<route>`
Auth: `Authorization: Bearer <WEBDIP_API_KEY>`
GET params are query strings. POST/JSON params are JSON body.

| Route | Method | Required params | Response shape | Notes |
|---|---|---|---|---|
| `game/status` | GET | `gameID`, `countryID` | `{ gameID, countryID, phase, turn, ... }` | Flat — no envelope. `phase` ∈ `Diplomacy\|Retreats\|Builds\|Pre-game\|Finished` |
| `game/data` | GET | `gameID`, `countryID` | `{ msg, success, referenceCode, data: {…} }` | Wrapped — `webdip.js::getData()` unwraps to `.data`; see §2.1 |
| `game/members` | GET | `gameID` | `{ msg, success, referenceCode, data: { members: Member[] } }` | Wrapped — `data.members` has the seat list |
| `game/overview` | GET | `gameID` | `{ msg, success, referenceCode, data: { phase, turn, name, … } }` | Wrapped — game config + member list in `data` |
| `game/getmessages` | GET | `gameID`, `countryID`, `sinceTime` | `{ msg, success, referenceCode, data: { messages: Message[], time: int, newMessagesFrom: int[] } }` | Wrapped — `webdip.js::getMessages()` unwraps to `data.messages` array |
| `game/sendmessage` | JSON POST | `gameID`, `countryID`, `toCountryID`, `message` | `{ messages: [{ fromCountryID, message, timeSent, toCountryID, turn }] }` | Flat — returns the just-sent message |
| `game/orders` | JSON POST | `gameID`, `turn`, `phase`, `countryID`, `orders[]`, `ready` | `Order[]` | Flat — returns current orders after save |
| `game/join` | POST | `gameID` | `{ msg, success, referenceCode }` | Flat — joins authenticated user to a game seat; used by TASK 2 |
| `sse/authentication` | JSON POST | `gameID`, `channel_name` | `{ msg, success, referenceCode, data: { auth: "md5_timestamp" } }` | Token for SSE server; pass as `auth` param when subscribing |

DB tables written: `wD_Orders`, `wD_GameMessages`. These are **not** modified by this project.

### 2.1 `game/data` response
Route uses `JSONResponse()` — full wire format:
```jsonc
{
  "msg": "Successfully retrieved game data.",
  "success": true,
  "referenceCode": "GGD-s-001",
  "data": {
    "units":             [{ "unitType": "Army|Fleet", "terrID": int, "countryID": int, "retreating": "Yes|No" }],
    "territoryStatuses": [{ "terrID": int, "countryID": int }],
    "territories":       [...],
    "currentOrders":     [ /* Order[] */ ],
    "contextVars":       { "context": {}, "contextKey": "" },
    "turn":              int,
    "phase":             "Diplomacy|Retreats|Builds|Pre-game|Finished",
    "isSandboxMode":     bool
  }
}
```
`webdip.js::getData()` unwraps to `.data` before returning — callers see the inner object directly.

### 2.2 Order object
Sent in `game/orders` → `orders[]`. Validated by `tools/empirica/src/orders.js::validateOrders()`.
```jsonc
{
  "terrID":     42,           // int — unit's current territory
  "type":       "Move",       // see valid types per phase below
  "toTerrID":   17,           // int|null — required for Move, Support hold, Support move, Convoy, Retreat
  "fromTerrID": null,         // int|null — required for Support move, Convoy
  "viaConvoy":  null,         // bool|null
  "countryID":  3,            // int
  "convoyPath": []            // optional array of terrIDs
}
```
Valid `type` values per phase:
- **Diplomacy**: `Hold`, `Move`, `Support hold`, `Support move`, `Convoy`
- **Retreats**: `Retreat`, `Disband`
- **Builds**: `Build Army`, `Build Fleet`, `Destroy`, `Wait`

---

## 3. webDiplomacy API — new team routes

These are **additive** routes registered in `api.php`. Same base URL and auth as §2.
All require `Authorization: Bearer <WEBDIP_API_KEY>`.

| Route | Method | Required params | Response | Notes |
|---|---|---|---|---|
| `team/roster` | GET | `gameID` | `TeamRoster` | All teams + members + roles for a game |
| `team/message` | JSON POST | `gameID`, `fromCountryID`, `text` | `{ id: int }` | Saves intra-team message; forwards to Data API |
| `team/controller` | JSON PATCH | `gameID`, `countryID`, `participantID` | `{ previous, next }` | Admin reassigns controller; forwards to Data API |

### 3.1 `TeamRoster` response
```jsonc
{
  "gameID": 1,
  "teams": [
    {
      "countryID": 1,
      "countryName": "England",
      "intraChatEnabled": true,
      "members": [
        {
          "participantId": "uuid",
          "role": "controller",    // "controller" | "spectator" | "bot"
          "joinedAt": "ISO8601"
        }
      ]
    }
  ]
}
```

---

## 4. Data API

Base: `http://localhost:4000` (set by `DATA_API_URL` env var)
Auth: `Authorization: Bearer <DATA_API_KEY>`
Content-Type: `application/json` for all requests.
All responses are JSON. Errors use the envelope in §8.

### 4.1 Participants

#### `POST /api/v1/participants`
Register a new participant (called when Empirica player is created).
```jsonc
// Request body
{ "empiricaPlayerId": "string" }

// Response 201
{ "id": "uuid" }
```

#### `GET /api/v1/participants/:id`
```jsonc
// Response 200
{
  "id": "uuid",
  "empiricaPlayerId": "string",
  "webdipUserId": int | null,
  "createdAt": "ISO8601"
}
```

### 4.2 Consents

#### `POST /api/v1/consents`
Record legal consent. Called immediately after Intro form submission.
```jsonc
// Request body
{
  "participantId": "uuid",
  "formVersion": "1.0",          // must match CONSENT_FORM_VERSION env var
  "checkboxes": {
    "dataCollection": true,       // all checkbox states, all required true
    "publications":   true,
    "withdrawal":     true,
    "ageVerified":    true
  },
  "ipHash": "sha256hex"          // optional — SHA-256 of request IP
}

// Response 201
{ "id": int }
```

### 4.3 Games

#### `POST /api/v1/games`
```jsonc
// Request body
{
  "empiricaGameId": "string",
  "webdipGameId":   int,
  "variantId":      int,
  "config":         object        // snapshot of empirica.json at game creation
}

// Response 201
{ "id": int }
```

### 4.4 Teams

#### `POST /api/v1/teams`
```jsonc
// Request body
{
  "gameId":           int,
  "countryId":        int,
  "countryName":      "England",
  "maxHumans":        3,
  "intraChatEnabled": true
}

// Response 201
{ "id": int }
```

#### `GET /api/v1/teams`
Returns all teams (with members) for a game. Used by the `team/roster` PHP route.
```jsonc
// Query params
// gameId  int  (required)

// Response 200
{
  "gameId": int,
  "teams": [ /* Team[] — same shape as GET /api/v1/teams/:teamId */ ]
}
```

#### `GET /api/v1/teams/:teamId`
```jsonc
// Response 200
{
  "id": int,
  "gameId": int,
  "countryId": int,
  "countryName": "England",
  "maxHumans": 3,
  "intraChatEnabled": true,
  "members": [
    {
      "id": int,
      "participantId": "uuid",
      "role": "controller",       // "controller" | "spectator" | "bot"
      "joinedAt": "ISO8601",
      "leftAt": "ISO8601" | null
    }
  ]
}
```

#### `POST /api/v1/teams/:teamId/members`
```jsonc
// Request body
{
  "participantId": "uuid",
  "role": "controller"            // "controller" | "spectator" | "bot"
}

// Response 201
{ "id": int }
```

#### `PATCH /api/v1/teams/:teamId/controller`
Admin only. Demotes current controller to spectator; promotes target to controller.
```jsonc
// Request body
{ "participantId": "uuid" }      // the new controller

// Response 200
{
  "previousControllerId": "uuid",
  "newControllerId": "uuid"
}
```
Side effects: emits `role.changed` event; publishes `role-changed` SSE via Redis.

#### `PATCH /api/v1/teams/:teamId/intra-chat`
Toggle intra-team chat (admin only).
```jsonc
// Request body
{ "enabled": bool }

// Response 200
{ "teamId": int, "intraChatEnabled": bool }
```

### 4.5 Events

#### `POST /api/v1/events`
Log any research event. See [`EVENT_SCHEMA.md`](./EVENT_SCHEMA.md) for all valid `type` values and their `payload` shapes.
```jsonc
// Request body
{
  "type":          "order.submitted",     // string — see EVENT_SCHEMA.md
  "gameId":        int | null,
  "participantId": "uuid" | null,
  "teamId":        int | null,
  "countryId":     int | null,
  "sessionId":     "uuid" | null,
  "payload":       object                 // event-specific fields — see EVENT_SCHEMA.md
}

// Response 201
{ "id": bigint }
```

#### `GET /api/v1/events`
```
Query params:
  gameId?        int
  participantId? string
  teamId?        int
  type?          string (exact match)
  since?         ISO8601
  until?         ISO8601
  limit?         int (default 100, max 1000)
  offset?        int (default 0)

Response 200:
{
  "events": [
    {
      "id": bigint,
      "ts": "ISO8601",
      "type": "...",
      "gameId": int | null,
      "participantId": "uuid" | null,
      "teamId": int | null,
      "countryId": int | null,
      "sessionId": "uuid" | null,
      "payload": object
    }
  ],
  "total": int
}
```

### 4.6 Messages

#### `POST /api/v1/messages`
```jsonc
// Request body
{
  "gameId":            int,
  "scope":             "intra" | "inter",
  "fromParticipantId": "uuid" | null,     // null for bot messages
  "fromCountryId":     int | null,
  "toTeamId":          int | null,        // required when scope = "intra"
  "toCountryId":       int | null,        // required when scope = "inter"
  "text":              "string",
  "webdipMessageId":   int | null,        // wD_GameMessages.id if inter-team
  "turn":              int | null
}

// Response 201
{ "id": bigint }
```

#### `GET /api/v1/messages`
```
Query params:
  gameId?   int (required)
  scope?    "intra" | "inter"
  teamId?   int
  since?    ISO8601
  limit?    int (default 100)
  offset?   int (default 0)

Response 200:
{ "messages": [...], "total": int }
```

---

## 5. SSE event shapes

Delivered by the SSE server (`http://localhost:43006`) via `text/event-stream`.
Published to Redis by Data API, consumed by SSE server, pushed to subscribed browsers.

Channel per game: `game:{gameId}` — participants subscribe on load.

### `role-changed`
```jsonc
{ "teamId": int, "previousControllerId": "uuid", "newControllerId": "uuid" }
```

### `phase-changed`
```jsonc
{ "gameId": int, "webdipGameId": int, "fromPhase": string, "toPhase": string, "turn": int }
```

### `intra-message`
```jsonc
{ "teamId": int, "messageId": bigint, "fromParticipantId": "uuid", "text": string, "ts": "ISO8601" }
```

### `participant-joined`
```jsonc
{ "teamId": int, "participantId": "uuid", "role": "controller" | "spectator" }
```

### `intra-chat-toggled`
```jsonc
{ "teamId": int, "enabled": bool }
```

---

## 6. AI output contract

LLM response parsed by `tools/empirica/src/ai.js` and validated by `orders.js::validateOrders()`.

```jsonc
{
  "orders": [ /* Order[] — see §2.2 */ ],
  "messages": [
    { "to": 2, "text": "Let's work together." }   // "to" = countryID
  ]
}
```

Invalid orders are stripped (logged to Data API as `ai.throttled` with validation errors).
Messages are subject to per-turn cap (§7).

---

## 7. Rate limits

| Limit | Default | Env var |
|---|---|---|
| Min interval between LLM calls per seat | 5 000 ms | `RATE_MIN_LLM_INTERVAL_MS` |
| Max messages per turn per AI seat | 3 | `RATE_MAX_MESSAGES_PER_TURN` |
| Data API request body size | 1 MB | hardcoded in Express config |
| `GET /api/v1/events` max limit | 1 000 | hardcoded |

---

## 8. Error envelope

All Data API and team route errors return:
```jsonc
{
  "error": "Human-readable description",
  "code":  "PARTICIPANT_NOT_FOUND"      // machine-readable, SCREAMING_SNAKE_CASE
}
```

Standard HTTP status codes:
- `400` — bad input (missing required field, invalid type)
- `401` — missing or invalid Bearer token
- `403` — valid token but insufficient permission (e.g. non-admin calling `PATCH controller`)
- `404` — resource not found
- `409` — conflict (e.g. duplicate participant, seat full)
- `500` — internal error (never leak stack traces in response)

---

## Changelog

| Date | Change |
|---|---|
| 2026-07-01 | Initial unified contract — supersedes `docs/empirica-integration/API_CONTRACT.md` |
| 2026-07-01 | Added Data API (§4), team routes (§3), SSE shapes (§5), event schema reference |
| 2026-07-01 | Added `ai.advisor` event type to EVENT_SCHEMA (bot advisor mode suggestion) |
| 2026-07-01 | self-heal: fixed §3.1 `participantID`→`participantId`; added `GET /api/v1/teams` to §4.4 |
| 2026-07-01 | audit: fixed §2 response shapes (JSONResponse wrapper on game/data, game/getmessages); added sse/authentication, game/join; fixed webdip.js to unwrap .data |
