# TASK 1 — Data API Service

> **Goal:** Build the standalone data collection microservice that all other services post events to.
> This is the foundation — all other tasks depend on it being available.
>
> **Contracts:** [`UNIVERSAL_CONTRACT.md §4`](../contracts/UNIVERSAL_CONTRACT.md#4-data-api), [`DATA_SCHEMA.md`](../contracts/DATA_SCHEMA.md), [`EVENT_SCHEMA.md`](../contracts/EVENT_SCHEMA.md)
>
> **Depends on:** Nothing. This task is self-contained.
>
> **Testable in isolation:** Yes — run Data API + DB only, verify with curl.

---

## What to build

A small Express (or Fastify) HTTP server at `data-service/`.
It is the **only** service that writes to `rs_*` tables.
All other services (PHP, AI runner, Empirica) call it over HTTP.

---

## Files to create

```
data-service/
  package.json
  src/
    index.js              ← Express app + startup
    routes/
      participants.js     ← POST /api/v1/participants, GET /api/v1/participants/:id
      consents.js         ← POST /api/v1/consents
      games.js            ← POST /api/v1/games
      teams.js            ← POST/GET /api/v1/teams, PATCH controller + intra-chat, POST members
      events.js           ← POST /api/v1/events, GET /api/v1/events
      messages.js         ← POST /api/v1/messages, GET /api/v1/messages
    data/
      IRepository.js      ← JSDoc interface (method signatures only)
      index.js            ← reads DATA_PROVIDER, exports active adapter
      adapters/
        MySQLAdapter.js   ← implements IRepository using mysql2
        PostgresAdapter.js← stub — throws NotImplementedError
        SupabaseAdapter.js← stub — throws NotImplementedError
    auth.js               ← Bearer token middleware
    redis.js              ← publish helper for SSE events
    errors.js             ← standard error classes + envelope formatter
  .env.example
install/
  research/
    rs_schema.sql         ← CREATE TABLE statements for all rs_* tables (see DATA_SCHEMA.md)
```

---

## IRepository interface

`data/IRepository.js` must define (JSDoc) these methods:

```js
// Participants
createParticipant(empiricaId)          → { id }
getParticipant(id)                     → Participant | null

// Consents
recordConsent({ participantId, formVersion, checkboxes, ipHash })  → { id }

// Games
createGame({ empiricaGameId, webdipGameId, variantId, config })   → { id }

// Teams
createTeam({ gameId, countryId, countryName, maxHumans, intraChatEnabled }) → { id }
getTeam(teamId)                        → Team | null   (includes members[])
addTeamMember({ teamId, participantId, role })         → { id }
setController(teamId, participantId)   → { previousControllerId, newControllerId }
setIntraChat(teamId, enabled)          → void

// Events
logEvent({ type, gameId, participantId, teamId, countryId, sessionId, payload }) → { id }
queryEvents({ gameId, participantId, type, since, until, limit, offset })         → { events, total }

// Messages
saveMessage({ gameId, scope, fromParticipantId, fromCountryId, toTeamId, toCountryId, text, webdipMessageId, turn }) → { id }
queryMessages({ gameId, scope, teamId, since, limit, offset })  → { messages, total }
```

---

## Auth middleware

`auth.js` — validates `Authorization: Bearer <DATA_API_KEY>` on every request.
`DATA_API_KEY` is set in `.env`. Return `401` if missing or wrong, `403` never used here (all tokens have equal access to the Data API).

---

## Redis publish

After any state-changing operation that warrants real-time notification, publish to Redis channel `game:{gameId}`:

| Trigger | Redis payload `event` field |
|---|---|
| `setController` | `role-changed` |
| `saveMessage` where `scope=intra` | `intra-message` |
| `setIntraChat` | `intra-chat-toggled` |
| `addTeamMember` | `participant-joined` |

Publish format: `JSON.stringify({ event: "role-changed", data: { ... } })`.

---

## docker-compose addition

```yaml
data-api:
  build: ./data-service
  ports:
    - "4000:4000"
  environment:
    DATA_API_KEY: ${DATA_API_KEY}
    DATA_PROVIDER: ${DATA_PROVIDER:-mysql}
    DB_HOST: db
    DB_PORT: 3306
    DB_USER: ${DB_USER:-webdiplomacy}
    DB_PASS: ${DB_PASS}
    DB_NAME: ${DB_NAME:-webdiplomacy}
    REDIS_URL: redis://redis:6379
  depends_on:
    - db
    - redis
  profiles: ["core"]
```

---

## `.env` additions

```
DATA_API_KEY=changeme-internal-token
DATA_API_URL=http://localhost:4000
DATA_API_PORT=4000
DATA_PROVIDER=mysql
```

---

## Test plan

All tests runnable with only `data-api` and `db` containers up (`docker compose up data-api db`).

### T1.1 — Health check
```bash
curl http://localhost:4000/health
# Expect: 200 { "ok": true }
```

### T1.2 — Auth rejected without token
```bash
curl -X POST http://localhost:4000/api/v1/participants \
  -H "Content-Type: application/json" \
  -d '{"empiricaPlayerId": "test-001"}'
# Expect: 401 { "error": "...", "code": "UNAUTHORIZED" }
```

### T1.3 — Create participant
```bash
curl -X POST http://localhost:4000/api/v1/participants \
  -H "Authorization: Bearer changeme-internal-token" \
  -H "Content-Type: application/json" \
  -d '{"empiricaPlayerId": "emp-abc123"}'
# Expect: 201 { "id": "<uuid>" }
# Verify: SELECT * FROM rs_participants WHERE empirica_id = 'emp-abc123'; → 1 row
```

### T1.4 — Duplicate participant returns 409
```bash
# Run T1.3 twice with same empiricaPlayerId
# Expect second call: 409 { "error": "...", "code": "DUPLICATE_PARTICIPANT" }
```

### T1.5 — Record consent
```bash
curl -X POST http://localhost:4000/api/v1/consents \
  -H "Authorization: Bearer changeme-internal-token" \
  -H "Content-Type: application/json" \
  -d '{
    "participantId": "<uuid from T1.3>",
    "formVersion": "1.0",
    "checkboxes": { "dataCollection": true, "publications": true, "withdrawal": true, "ageVerified": true }
  }'
# Expect: 201 { "id": 1 }
# Verify: SELECT * FROM rs_consents; → 1 row, withdrawn_at IS NULL
```

### T1.6 — Log an event
```bash
curl -X POST http://localhost:4000/api/v1/events \
  -H "Authorization: Bearer changeme-internal-token" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "participant.joined",
    "participantId": "<uuid>",
    "payload": { "empiricaPlayerId": "emp-abc123", "demographics": { "age": 25, "gender": "M", "experience": 2 }, "consentVersion": "1.0" }
  }'
# Expect: 201 { "id": 1 }
# Verify: SELECT type, payload FROM rs_events WHERE id = 1; → "participant.joined"
```

### T1.7 — Query events
```bash
curl "http://localhost:4000/api/v1/events?participantId=<uuid>&limit=10" \
  -H "Authorization: Bearer changeme-internal-token"
# Expect: 200 { "events": [...], "total": 1 }
```

### T1.8 — Team lifecycle
```bash
# Create game, team, add member, get team
# Verify: rs_games, rs_teams, rs_team_members rows exist
# Verify: GET /api/v1/teams/:id returns members[]
```

### T1.9 — Controller reassignment
```bash
# Add two members (controller + spectator)
# PATCH /api/v1/teams/:id/controller with second participant's ID
# Expect 200 { previousControllerId, newControllerId }
# Verify: rs_team_members role column updated correctly
```

### T1.10 — Intra-team message saved + Redis published
```bash
# POST /api/v1/messages { scope: "intra", ... }
# Expect: 201 { "id": 1 }
# Verify: rs_messages has 1 row with scope = 'intra'
# Verify: Redis SUBSCRIBE game:1 received intra-message event (use redis-cli)
```

### T1.11 — Unknown event type accepted (open schema)
```bash
# POST /api/v1/events with type: "custom.research.note"
# Expect: 201 — event is stored as-is (no whitelist enforcement)
```

### T1.12 — DB provider switch (MySQLAdapter → stub)
```bash
# Set DATA_PROVIDER=postgres, restart data-api
# POST /api/v1/participants
# Expect: 500 with body containing "NotImplemented" (stub adapter)
# Confirms adapter switching works; postgres adapter is a stub for now
```

---

## Done criteria

- [ ] All T1.x tests pass
- [ ] `rs_schema.sql` creates all tables without error on a fresh DB
- [ ] `docker compose up data-api` starts the service and health check returns 200
- [ ] `DATA_PROVIDER=mysql` (default) writes all resource types to MariaDB
- [ ] `DATA_PROVIDER=postgres` returns NotImplemented (stub ready for later)
- [ ] Auth rejects requests without correct Bearer token
- [ ] No secrets appear in logs or error responses
