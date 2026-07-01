# TASK 5 — Intra-Team Chat

> **Goal:** Add real-time intra-team chat visible only to members of the same team.
> Messages are stored in the unified database and delivered via SSE.
> The feature is toggle-able per team by an admin.
>
> **Contracts:** [`UNIVERSAL_CONTRACT.md §4.6`](../contracts/UNIVERSAL_CONTRACT.md#46-messages), [`UNIVERSAL_CONTRACT.md §3`](../contracts/UNIVERSAL_CONTRACT.md#3-webdiplomacy-api--new-team-routes), [`EVENT_SCHEMA.md — message.sent`](../contracts/EVENT_SCHEMA.md)
>
> **Depends on:** TASK 1 (Data API), TASK 2 (team membership known), TASK 4 (TeamPanel chat slot)
>
> **Testable in isolation:** Chat component testable with mocked API. Integration test requires TASK 1+2.

---

## What to build

### Chat component (fills the slot left by TASK 4)

`tools/empirica-app/client/IntraTeamChat.jsx` — mounted inside `TeamPanel.jsx`.

Features:
- Message list (newest at bottom, auto-scroll)
- Text input + send button
- Sender label per message (anonymous ID or "You")
- Disabled state when `intraChatEnabled = false` (shows "Chat disabled by researcher")
- Disabled input for spectators who are observers only (configurable — see `chatForSpectators` flag below)

### Message flow

**Sending:**
```
User types message → click Send (or Enter)
  → POST api.php?route=team/message { gameID, fromCountryID, text }
  → PHP forwards to Data API: POST /api/v1/messages { scope: "intra", ... }
  → Data API publishes { event: "intra-message", data: {...} } to Redis
  → SSE server pushes to all subscribers on channel game:{gameId}
  → All team members' chat lists update in real-time
```

**Receiving:**
```
SSE event: intra-message
→ useSSE hook (TASK 4) fires onEvent callback
→ Stage.jsx routes to IntraTeamChat via prop/context
→ Message appended to list
```

**History on load:**
```
On Stage mount → GET /api/v1/messages?gameId={gameId}&scope=intra&teamId={teamId}
→ Pre-populate chat list with prior messages
```

### Privacy

- Intra-team messages are **never** sent to webDiplomacy — they go only to the Data API.
- Each team sees only their own messages (`toTeamId` filter on API call).
- Messages from other teams are never received by this SSE channel (channel is per-game, filter by teamId client-side after receiving).

### `chatForSpectators` flag

In `config/empirica.json` per team:
```jsonc
"chatForSpectators": true   // default: true — all team members can send
// false: only controller can send; spectators see messages but input is disabled
```

---

## Files to create / modify

| File | Change |
|---|---|
| `tools/empirica-app/client/IntraTeamChat.jsx` | **NEW** — chat UI component |
| `tools/empirica-app/client/TeamPanel.jsx` | Mount `IntraTeamChat` in the chat area slot |
| `tools/empirica-app/client/Stage.jsx` | Route SSE `intra-message` events to chat |
| `tools/empirica-app/client/useIntraChat.js` | **NEW** — hook: load history + send + receive |

---

## Component spec

### `IntraTeamChat.jsx`
```jsx
// Props:
//   messages: [{ id, fromParticipantId, text, ts, isSelf }]
//   onSend: (text) => Promise<void>
//   enabled: bool        // intraChatEnabled from team config
//   canSend: bool        // false for spectators if chatForSpectators=false
//   loading: bool        // true while history loads

// State:
//   input: string

// Behaviour:
//   - Auto-scrolls to bottom on new message
//   - Disables input + shows banner when enabled=false
//   - Shows "Sending..." while onSend is pending
//   - Clears input on successful send
//   - Max message length: 1000 chars (enforced client + server)
```

### `useIntraChat.js`
```js
// useIntraChat({ gameId, teamId, participantId, apiUrl, apiKey })
// Returns: { messages, send(text), loading, error }
// On mount: GET /api/v1/messages?gameId&scope=intra&teamId → set messages
// send(text): POST api.php?route=team/message
// SSE intra-message events appended to messages[]
```

---

## Test plan

### T5.1 — Chat history loads on mount
```js
mockFetch GET /api/v1/messages → [{ id: 1, text: "hello", ... }]
render(<IntraTeamChat ... />)
expect(screen.getByText("hello")).toBeInTheDocument()
```

### T5.2 — Send message calls team/message route
```js
render(<IntraTeamChat ... onSend={mockSend} />)
fireEvent.change(input, { target: { value: "Let's support Munich" } })
fireEvent.click(sendButton)
expect(mockSend).toHaveBeenCalledWith("Let's support Munich")
expect(input.value).toBe("")  // cleared after send
```

### T5.3 — Disabled state when intraChatEnabled = false
```js
render(<IntraTeamChat enabled={false} ... />)
expect(screen.getByText(/chat disabled/i)).toBeVisible()
expect(input).toBeDisabled()
```

### T5.4 — Spectator blocked when chatForSpectators = false
```js
render(<IntraTeamChat enabled={true} canSend={false} ... />)
expect(input).toBeDisabled()
expect(screen.getByText(/spectators cannot send/i)).toBeVisible()
```

### T5.5 — SSE intra-message appended in real-time
```js
const { rerender } = render(<Stage ... />)
// Simulate SSE event: { event: "intra-message", data: { teamId: 1, text: "New msg" } }
expect(screen.getByText("New msg")).toBeInTheDocument()
// No page reload
```

### T5.6 — Message only shows for correct team
```js
// SSE event has teamId: 2 (different team)
// Current player is on teamId: 1
// Expect: message NOT added to chat list
```

### T5.7 — Integration: send → stored in DB → received by second browser
```
(Manual / e2e test)
Open two browsers as team members of England
Browser A: type and send "Ready to move?"
Browser B: message appears without refresh
Check rs_messages: 1 row with scope='intra', to_team_id = England team ID
Check rs_events: 1 row with type='message.sent', payload.scope='intra'
```

### T5.8 — Max length enforced
```js
render(<IntraTeamChat ... />)
fireEvent.change(input, { target: { value: "a".repeat(1001) } })
// Expect: input shows character counter warning or truncates at 1000
fireEvent.click(sendButton)
// Expect: onSend called with text.slice(0, 1000) OR not called with error
```

---

## Done criteria

- [ ] T5.1–T5.8 pass
- [ ] Messages stored in `rs_messages` with `scope='intra'`
- [ ] Messages visible only to same-team members (correct teamId filter)
- [ ] Real-time delivery via SSE without page reload
- [ ] Chat disabled state works (both `intraChatEnabled=false` and `chatForSpectators=false`)
- [ ] History loads on page mount (no messages lost if joining mid-game)
- [ ] Admin toggle takes effect in real-time (SSE `intra-chat-toggled` event)
