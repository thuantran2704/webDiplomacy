# TASK 7 — Admin Controls & Researcher Dashboard

> **Goal:** Give researchers real-time control over a running game session and a persistent
> configuration interface for game setup.
>
> **Contracts:** [`UNIVERSAL_CONTRACT.md §3, §4.4, §4.5`](../contracts/UNIVERSAL_CONTRACT.md),
> [`EVENT_SCHEMA.md — role.changed`](../contracts/EVENT_SCHEMA.md)
>
> **Depends on:** TASK 1 (Data API), TASK 2 (team system), TASK 4 (UI layout, SSE hook)
>
> **Testable in isolation:**
> - `admincp.php` tab: testable with webDiplomacy + Data API running
> - Researcher panel component: testable with mocked API + SSE

---

## Two surfaces

Admin control is split across two surfaces with distinct purposes:

| Surface | Location | Used by | When |
|---|---|---|---|
| **Game config tab** | `admincp.php` (PHP) | Researcher, before game | Set team sizes, bot counts, intra-chat defaults per game |
| **Live researcher panel** | Empirica app (React, researcher route) | Researcher, during game | Reassign controller, toggle chat, monitor live events |

---

## 7A — `admincp.php` Game Config Tab

### What it shows

A new **"Research Games"** tab in the existing `admincp.php` admin control panel. This is a PHP page rendered server-side.

### Fields (per game)

| Field | Type | Maps to |
|---|---|---|
| `variantID` | select (from `wD_Variants`) | `config/empirica.json > variantID` |
| `consentFormVersion` | text | `config/empirica.json > consentFormVersion` |
| `globalIntraTeamChat` | checkbox | `config/empirica.json > globalIntraTeamChat` |
| Per-country `maxHumans` | number 0–10 | `config/empirica.json > teams.<country>.maxHumans` |
| Per-country `bots` | number 0–5 | `config/empirica.json > teams.<country>.bots` |
| Per-country `intraTeamChat` | checkbox | `config/empirica.json > teams.<country>.intraTeamChat` |
| Per-country `chatForSpectators` | checkbox | `config/empirica.json > teams.<country>.chatForSpectators` |

On save: writes/overwrites `config/empirica.json` on the server.
Requires: admin session (existing webDiplomacy `wD_Users.type = 'Admin'` check).

### File to modify

`admin/adminActionsTD.php` — add a new action block following the existing pattern.
Or create `admin/adminActionsResearch.php` if scope is large enough to warrant a separate file.

---

## 7B — Live Researcher Panel (Empirica React)

A separate route in the Empirica app accessible only to researchers (not participants).
Route: `/researcher` — protected by a researcher token (`RESEARCHER_TOKEN` env var checked against URL param or localStorage).

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  RESEARCHER DASHBOARD                            Game ID: 1     │
├─────────────────────────┬───────────────────────────────────────┤
│  TEAM ROSTER            │  LIVE EVENT FEED                      │
│                         │                                        │
│  England ────────────── │  14:23:01  order.submitted England    │
│  ● Alice  [Controller]  │  14:22:58  message.sent  intra Eng    │
│    [Make controller ▼]  │  14:22:45  ai.decision   France       │
│  ○ Bob    [Spectator]   │  14:22:31  phase.transition D→R       │
│                         │  14:22:10  team.assigned  Germany     │
│  France ─────────────── │  ...                                  │
│  🤖 Bot   [controller]  │                          [Pause feed] │
│  ○ Carol  [Spectator]   │                                        │
│                         ├───────────────────────────────────────┤
│  [Toggle chat: ON/OFF]  │  INTRA-CHAT TOGGLE                    │
│                         │                                        │
│  Germany ────────────── │  England   [Chat ON  ●]  [Toggle]     │
│  ● Dave   [Controller]  │  France    [Chat OFF ○]  [Toggle]     │
│  ○ Eve    [Spectator]   │  Germany   [Chat ON  ●]  [Toggle]     │
│                         │                                        │
└─────────────────────────┴───────────────────────────────────────┘
```

### Actions

#### Reassign controller
- Dropdown next to each spectator: "Make controller"
- Calls: `PATCH api.php?route=team/controller { gameID, countryID, participantID }`
- On success: roster updates, SSE `role-changed` propagates to participant browsers

#### Toggle intra-team chat
- Toggle button per team
- Calls: `PATCH DATA_API_URL/api/v1/teams/:teamId/intra-chat { enabled: bool }`
- On success: SSE `intra-chat-toggled` propagates; participant chat area shows/hides

#### Live event feed
- On mount: `GET DATA_API_URL/api/v1/events?gameId={id}&limit=50` → seed the list
- Ongoing: SSE subscription to `game:{gameId}` — append new events as they arrive
- Each row shows: timestamp, event type (colour-coded), participant/country if set, payload summary
- "Pause feed" freezes auto-scroll without disconnecting SSE

---

## Files to create / modify

| File | Change |
|---|---|
| `admin/adminActionsResearch.php` | **NEW** — game config form (PHP) |
| `admincp.php` | Register the new Research tab |
| `tools/empirica-app/client/Researcher.jsx` | **NEW** — live dashboard React component |
| `tools/empirica-app/client/ResearcherTeamRoster.jsx` | **NEW** — team roster with controller reassignment |
| `tools/empirica-app/client/ResearcherEventFeed.jsx` | **NEW** — live event stream |
| `tools/empirica-app/client/ResearcherChatToggle.jsx` | **NEW** — per-team chat toggle |
| `tools/empirica-app/client/App.jsx` | Add `/researcher` route, protect with token check |
| `tools/empirica-app/.env.example` | Add `REACT_APP_RESEARCHER_TOKEN` |

---

## Auth

### `admincp.php` tab
- Standard webDiplomacy admin session (existing `$_SESSION['userID']` + `wD_Users.type = 'Admin'` check)
- No new auth logic needed — follows existing `admincp.php` gate

### Researcher panel (`/researcher`)
- `REACT_APP_RESEARCHER_TOKEN` is a shared secret set at build time (or via env)
- On load, panel checks `?token=` URL param or localStorage for the token
- If missing/wrong: redirect to `/` with an error message
- The panel's API calls use `DATA_API_KEY` (already in Empirica server env) — calls proxy through
  the Empirica server, not the browser directly, to avoid exposing `DATA_API_KEY` to the client

---

## Component specs

### `Researcher.jsx`
```jsx
// Route: /researcher?token=<RESEARCHER_TOKEN>
// On mount: validate token, fetch initial data (roster + events), open SSE
// Renders: ResearcherTeamRoster + ResearcherEventFeed + ResearcherChatToggle
// No player/stage Empirica context — standalone component
```

### `ResearcherTeamRoster.jsx`
```jsx
// Props: teams (TeamRoster from team/roster), onReassign(countryID, participantID), gameID
// Renders: per-team list with role badges and "Make controller" dropdowns
// Disabled for bot-only teams (no humans to reassign)
```

### `ResearcherEventFeed.jsx`
```jsx
// Props: initialEvents, gameId
// State: events[], paused
// On SSE event: if !paused, prepend to list
// Colour coding: participant.* = blue, order.* = green, message.* = purple, ai.* = orange, error = red
// Max 500 rows in DOM — older rows removed when limit hit
```

### `ResearcherChatToggle.jsx`
```jsx
// Props: teams, onToggle(teamId, enabled)
// Renders: toggle per team; shows current intraChatEnabled state
// Optimistic update: flip immediately, revert on API error
```

---

## Test plan

### T7.1 — Researcher panel requires token
```
GET /researcher (no token param)
→ Redirect to / with error banner "Access requires researcher token"
```

### T7.2 — Researcher panel loads with valid token
```
GET /researcher?token=<RESEARCHER_TOKEN>
→ Renders; fetches GET /api/v1/events?gameId=1&limit=50 → event list populated
→ Fetches GET api.php?route=team/roster&gameID=1 → team list populated
```

### T7.3 — Controller reassignment from researcher panel
```
Click "Make controller" → select Bob
→ PATCH api.php?route=team/controller { gameID:1, countryID:1, participantID: <Bob> }
→ 200 { previous: <Alice>, next: <Bob> }
→ Roster updates immediately (optimistic)
→ SSE role-changed fires → Alice's browser gets spectator overlay
→ Bob's browser removes spectator overlay
```

### T7.4 — Intra-chat toggle from researcher panel
```
Click [Toggle] on France (currently ON → OFF)
→ PATCH /api/v1/teams/2/intra-chat { enabled: false }
→ 200 { teamId: 2, intraChatEnabled: false }
→ ResearcherChatToggle shows France as OFF
→ SSE intra-chat-toggled fires → France team members see "Chat disabled" banner
```

### T7.5 — Live event feed appends on SSE
```
Researcher panel open, paused = false
AI runner submits orders → ai.decision event logged
→ SSE pushes event to game:1 channel
→ ResearcherEventFeed prepends row within 1s
```

### T7.6 — Pause feed stops auto-scroll, does not disconnect SSE
```
Click [Pause feed]
→ New events arrive (confirmed by checking rs_events)
→ Feed list does NOT update
Click [Resume]
→ Missing events are fetched (GET /api/v1/events?since=<lastTs>)
→ Feed catches up
```

### T7.7 — `admincp.php` Research tab saves config
```
Log in as admin → admincp.php → Research tab
Set England maxHumans = 4, France intraTeamChat = false
Click Save
→ config/empirica.json updated on server
→ Reload page: fields show saved values
```

### T7.8 — Non-admin cannot access Research tab
```
Log in as regular user → GET admincp.php
→ Research tab not shown in navigation
→ Direct POST to Research tab action → 403
```

---

## Done criteria

- [ ] T7.1–T7.8 pass
- [ ] Controller reassignment propagates to participant browsers via SSE within 2s
- [ ] Intra-chat toggle propagates to participant browsers via SSE within 2s
- [ ] Event feed shows all `rs_events` types with correct colour coding
- [ ] `admincp.php` Research tab only accessible to admin users
- [ ] Researcher panel only accessible with valid `RESEARCHER_TOKEN`
- [ ] No `DATA_API_KEY` or `WEBDIP_API_KEY` exposed to browser (`window`, `localStorage`, network responses)
