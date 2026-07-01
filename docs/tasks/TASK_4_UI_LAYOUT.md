# TASK 4 — UI Layout (Board + Team Panel)

> **Goal:** Restructure the Empirica Stage into a split layout: webDiplomacy board iframe on the left,
> team panel (role indicator, intra-team chat area) on the right. Apply spectator overlay to block
> board interaction for non-controllers.
>
> **Contracts:** None (pure UI, no new API calls in this task). Uses `player.get("role")` set by TASK 2.
>
> **Depends on:** TASK 2 (role assigned to player object). Can be built in parallel with TASK 2 using a mock role.
>
> **Testable in isolation:** Yes — render with mocked player role, no backend needed.

---

## What to build

### Layout

```
┌────────────────────────────────────────────────────────────────┐
│  EMPIRICA SHELL  (full viewport)                               │
│                                                                 │
│  ┌────────────────────────────────┐  ┌──────────────────────┐ │
│  │                                │  │  YOUR TEAM           │ │
│  │  webDiplomacy board            │  │  England             │ │
│  │  (iframe — 70% width)          │  │  ──────────────────  │ │
│  │                                │  │  Role: Controller ●  │ │
│  │  [Spectator overlay if not     │  │  or: Spectator ○     │ │
│  │   controller — see below]      │  │                      │ │
│  │                                │  │  [Intra-team chat    │ │
│  │                                │  │   area — TASK 5]     │ │
│  │                                │  │                      │ │
│  └────────────────────────────────┘  └──────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

Responsive breakpoints:
- ≥ 1024px: side-by-side (board 70%, panel 30%)
- < 1024px: stacked (board full width, panel below)

### Spectator overlay

When `player.get("role") === "spectator"`:
- A `<div>` covers the entire iframe with `position: absolute; inset: 0; z-index: 10`
- Semi-transparent grey tint: `background: rgba(0,0,0,0.15)`
- Centered label: "Spectator mode — watching [Controller name]"
- The overlay intercepts all pointer events (`pointer-events: all`) so clicks don't reach the iframe
- The overlay does NOT cover the Team Panel

When role is `"controller"`:
- No overlay
- Iframe is fully interactive

### Role indicator (Team Panel header)

Displays:
- Country name and flag (from game config)
- Role badge: green "Controller" pill or grey "Spectator" pill
- If spectator: name/ID of current controller

### Real-time role updates

Subscribe to SSE channel `game:{gameId}` (existing SSE server).
On `role-changed` event:
- Update `player.get("role")` locally
- Show a toast notification: "Control transferred to [new controller]" or "You are now the controller"
- Overlay appears/disappears without page reload

---

## Files to modify / create

| File | Change |
|---|---|
| `tools/empirica-app/client/Stage.jsx` | Full rewrite — add layout, board iframe, team panel skeleton |
| `tools/empirica-app/client/TeamPanel.jsx` | **NEW** — role display, chat area placeholder (filled by TASK 5) |
| `tools/empirica-app/client/SpectatorOverlay.jsx` | **NEW** — overlay component |
| `tools/empirica-app/client/useSSE.js` | **NEW** — React hook for SSE subscription |
| `tools/empirica-app/client/App.jsx` | Pass gameId + boardUrl to Stage |

---

## Component specs

### `Stage.jsx`
```jsx
// Props from Empirica: player, stage, game
// Reads: player.get("role"), player.get("teamId"), stage.get("boardUrl"), game.get("webdipGameId")
// Renders: split layout — BoardArea + TeamPanel
// Handles: SSE role-changed events via useSSE
```

### `SpectatorOverlay.jsx`
```jsx
// Props: visible (bool), controllerName (string)
// position: absolute, covers parent fully
// Shows message when visible=true
```

### `TeamPanel.jsx`
```jsx
// Props: role, teamId, countryName, members[]
// Shows: role badge, controller name (if spectator), chat area slot
// Chat area slot is empty in this task — filled by TASK 5
```

### `useSSE.js`
```js
// useSSE(gameId, onEvent)
// Connects to SSE_URL/subscribe?gameId={gameId}
// Parses JSON events, calls onEvent({ event, data })
// Reconnects on disconnect (exponential backoff, max 30s)
// Cleanup on unmount
```

---

## Test plan

React Testing Library tests. Mock `player.get()` return values. No backend needed.

### T4.1 — Controller sees no overlay
```js
mockPlayer({ role: "controller" })
render(<Stage player={mockPlayer} stage={mockStage} game={mockGame} />)
expect(screen.queryByText(/spectator mode/i)).not.toBeInTheDocument()
// iframe is rendered and accessible
```

### T4.2 — Spectator sees overlay
```js
mockPlayer({ role: "spectator" })
render(<Stage ... />)
expect(screen.getByText(/spectator mode/i)).toBeVisible()
// Overlay div has pointer-events: all (intercepting clicks)
```

### T4.3 — Role badge shows correct label
```js
mockPlayer({ role: "controller" })
render(<TeamPanel role="controller" countryName="England" members={[...]} />)
expect(screen.getByText(/controller/i)).toHaveStyle({ color: expect.stringContaining("green") })
```

### T4.4 — SSE role-changed removes overlay
```js
mockPlayer({ role: "spectator" })
// render, overlay visible
// Simulate SSE message: { event: "role-changed", data: { newControllerId: currentParticipantId } }
// overlay disappears without remount
```

### T4.5 — SSE role-changed adds overlay
```js
mockPlayer({ role: "controller" })
// render, no overlay
// Simulate SSE message: { event: "role-changed", data: { previousControllerId: currentParticipantId } }
// overlay appears
```

### T4.6 — Responsive layout (< 1024px stacks)
```js
// Set viewport width to 800px
render(<Stage ... />)
// Board and panel should be stacked (CSS class or style check)
```

### T4.7 — SSE reconnects on disconnect
```js
// Mock EventSource to fire onerror
// Expect: new EventSource created after backoff
// (test useSSE hook in isolation)
```

---

## Done criteria

- [ ] T4.1–T4.7 pass
- [ ] Controller can interact with board; spectator cannot (overlay blocks)
- [ ] Role badge updates in real-time from SSE without page reload
- [ ] TeamPanel renders correctly with both roles
- [ ] Layout is responsive (stacks on narrow viewports)
- [ ] Chat area placeholder visible in TeamPanel (will be filled by TASK 5)
