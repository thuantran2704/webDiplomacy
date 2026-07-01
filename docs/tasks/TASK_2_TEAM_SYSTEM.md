# TASK 2 — Team System

> **Goal:** Enable N participants per country seat with exactly one controller.
> Adds team management routes to `api.php` and integrates seat assignment into Empirica server callbacks.
>
> **Contracts:** [`UNIVERSAL_CONTRACT.md §3`](../contracts/UNIVERSAL_CONTRACT.md#3-webdiplomacy-api--new-team-routes), [`DATA_SCHEMA.md — rs_teams, rs_team_members`](../contracts/DATA_SCHEMA.md)
>
> **Depends on:** TASK 1 (Data API must be running to receive events)
>
> **Testable in isolation:** Yes — PHP team routes can be tested with curl against webDiplomacy + Data API. Assignment logic can be unit tested independently.

---

## What to build

### 2A — New PHP routes in `api.php`

Three new routes registered alongside existing `game/*` routes:

| Route | Class | File |
|---|---|---|
| `team/roster` | `GetTeamRoster` | `api/` |
| `team/message` | `SendIntraTeamMessage` | `api/` |
| `team/controller` | `AssignTeamController` | `api/` |

Each class follows the existing pattern in `api.php`: extends a base route class, validates auth, validates params, returns JSON.

**`team/roster` (GET)**
- Params: `gameID` (int, required)
- Calls Data API: `GET /api/v1/teams?gameId={gameID}` (or direct DB join — TBD based on performance)
- Returns: `TeamRoster` (see `UNIVERSAL_CONTRACT.md §3.1`)
- Auth: `WEBDIP_API_KEY` with `getStateOfAllGames` permission (existing check)

**`team/message` (JSON POST)**
- Params: `gameID`, `fromCountryID`, `text`
- Validates: `text` not empty, max 2000 chars; `fromCountryID` is valid country in game
- Calls Data API: `POST /api/v1/messages { scope: "intra", ... }`
- Calls Data API: `POST /api/v1/events { type: "message.sent", ... }`
- Returns: `{ "id": bigint }`
- Auth: `WEBDIP_API_KEY` (any valid key for this game)

**`team/controller` (JSON PATCH)**
- Params: `gameID`, `countryID`, `participantID`
- Validates: caller has admin-level key; `participantID` is a member of this team
- Calls Data API: `PATCH /api/v1/teams/:teamId/controller`
- Returns: `{ "previous": "uuid", "next": "uuid" }`
- Auth: `WEBDIP_API_KEY` with admin flag

### 2B — Empirica server callbacks (seat assignment)

Update `tools/empirica-app/server/callbacks.js`:

**`onPlayerStart`** — when a participant enters:
1. POST `DATA_API_URL/api/v1/participants` → get/create participant ID
2. Find which team has capacity (< `maxHumans`, based on `rs_team_members` count)
3. Determine role: if team has no controller → `controller`, else → `spectator`
4. POST `DATA_API_URL/api/v1/teams/:id/members`
5. POST `DATA_API_URL/api/v1/events { type: "team.assigned", ... }`
6. Set `player.set("teamId", ...)` and `player.set("role", ...)` for the UI

**`onGameStart`** — when the Empirica game starts:
1. POST `DATA_API_URL/api/v1/games` → register the game
2. For each country in config: POST `DATA_API_URL/api/v1/teams` → create team rows
3. POST `DATA_API_URL/api/v1/events { type: "game.created", ... }`

### 2C — Config schema update

`config/empirica.sample.json` updated to:
```jsonc
{
  "variantID": 1,
  "consentFormVersion": "1.0",
  "globalIntraTeamChat": true,
  "teams": {
    "England": {
      "maxHumans": 3,
      "bots": 0,
      "intraTeamChat": true,
      "controller": "auto"
    },
    "France": {
      "maxHumans": 2,
      "bots": 1,
      "intraTeamChat": false,
      "controller": "auto"
    }
  }
}
```

---

## Files to modify

| File | Change |
|---|---|
| `api.php` | Register `team/roster`, `team/message`, `team/controller` routes |
| `api/` | Add `GetTeamRoster.php`, `SendIntraTeamMessage.php`, `AssignTeamController.php` |
| `tools/empirica-app/server/callbacks.js` | Add `onPlayerStart`, update `onGameStart` |
| `config/empirica.sample.json` | Add `maxHumans`, `bots`, `intraTeamChat` fields |
| `tools/empirica/.env.example` | Add `DATA_API_URL`, `DATA_API_KEY` |

---

## Invariants (enforced by Data API, not DB)

1. **Exactly one controller per team at all times.** `setController` is a transaction: demote old controller → promote new one atomically.
2. **`maxHumans` respected.** `addTeamMember` returns `409 TEAM_FULL` if `COUNT(members WHERE left_at IS NULL) >= maxHumans`.
3. **One team per participant per game.** `addTeamMember` returns `409 ALREADY_ASSIGNED` if participant already has an active membership in any team for this game.

---

## Test plan

Requires: Data API (TASK 1) running + webDiplomacy + DB.

### T2.1 — `team/roster` returns empty team list for new game
```bash
curl "http://localhost:43000/api.php?route=team/roster&gameID=1" \
  -H "Authorization: Bearer <WEBDIP_API_KEY>"
# Expect: 200 { "gameID": 1, "teams": [] }
```

### T2.2 — Seat assignment: first player → controller
```
Simulate onPlayerStart callback for participant A, team England
Expect: rs_team_members row with role = 'controller'
Expect: rs_events row type = 'team.assigned', payload.role = 'controller'
```

### T2.3 — Second player on same team → spectator
```
Simulate onPlayerStart callback for participant B, team England
Expect: role = 'spectator'
Expect: rs_team_members has 2 rows for England team
```

### T2.4 — maxHumans enforced
```
Set maxHumans = 2 for England; add A, B, then attempt C
Expect: Data API returns 409 TEAM_FULL
Expect: no rs_team_members row created for C
```

### T2.5 — `team/controller` reassigns correctly
```bash
curl -X PATCH "http://localhost:43000/api.php?route=team/controller" \
  -H "Authorization: Bearer <WEBDIP_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"gameID": 1, "countryID": 1, "participantID": "<participant B uuid>"}'
# Expect: 200 { "previous": "<A uuid>", "next": "<B uuid>" }
# Verify: rs_team_members A.role = 'spectator', B.role = 'controller'
# Verify: rs_events row type = 'role.changed'
```

### T2.6 — `team/message` saves intra-team message
```bash
curl -X POST "http://localhost:43000/api.php?route=team/message" \
  -H "Authorization: Bearer <WEBDIP_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"gameID": 1, "fromCountryID": 1, "text": "What should we do?"}'
# Expect: 201 { "id": bigint }
# Verify: rs_messages row with scope = 'intra'
# Verify: rs_events row type = 'message.sent', payload.scope = 'intra'
```

### T2.7 — `team/roster` returns members after assignment
```bash
curl "http://localhost:43000/api.php?route=team/roster&gameID=1" \
  -H "Authorization: Bearer <WEBDIP_API_KEY>"
# Expect: members[] contains both A (spectator) and B (controller after T2.5)
```

### T2.8 — Unit test: controller-assignment logic
```js
// In tools/empirica/src/test.js or separate file
// Mock Data API, simulate 3 players joining England (maxHumans=2)
// Assert: first gets 'controller', second gets 'spectator', third throws TEAM_FULL
```

---

## Done criteria

- [ ] T2.1–T2.8 pass
- [ ] `team/roster`, `team/message`, `team/controller` routes return correct shapes per `UNIVERSAL_CONTRACT.md §3`
- [ ] Controller invariant holds (only one controller per team at any time)
- [ ] `maxHumans` enforced with correct 409 error
- [ ] Empirica `onPlayerStart` assigns roles correctly for first/subsequent joins
- [ ] All team actions produce `rs_events` rows with correct types
