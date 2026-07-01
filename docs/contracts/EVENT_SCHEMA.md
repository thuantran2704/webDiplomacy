# Event Schema

> All event types logged to `POST /api/v1/events` (Data API).
> Every row in `rs_events` has a `type` matching one of the values below,
> and a `payload` matching the shape defined here.
> Last updated: 2026-07-01.

---

## Envelope (all events)

Sent as the request body to `POST /api/v1/events`:

```jsonc
{
  "type":          string,        // one of the types below
  "gameId":        int | null,
  "participantId": string | null, // UUID
  "teamId":        int | null,
  "countryId":     int | null,
  "sessionId":     string | null, // UUID
  "payload":       object         // type-specific fields below
}
```

The Data API sets `ts` (timestamp) server-side — clients do not send it.

---

## Event types

### `participant.joined`
Fired when the Intro form is submitted and the participant is registered.

```jsonc
{
  "type": "participant.joined",
  "participantId": "uuid",
  "gameId": null,
  "payload": {
    "empiricaPlayerId": "string",
    "demographics": {
      "age":        int,
      "gender":     "string",
      "experience": int           // years of Diplomacy experience
    },
    "consentVersion": "1.0"
  }
}
```

---

### `participant.consent`
Fired when consent is recorded (may be same moment as `participant.joined` or separate step).

```jsonc
{
  "type": "participant.consent",
  "participantId": "uuid",
  "payload": {
    "formVersion": "1.0",
    "checkboxes": {
      "dataCollection": true,
      "publications":   true,
      "withdrawal":     true,
      "ageVerified":    true
    },
    "ipHash": "sha256hex" | null
  }
}
```

---

### `session.start`
Fired when participant's browser loads the Empirica Stage (game begins).

```jsonc
{
  "type": "session.start",
  "participantId": "uuid",
  "gameId": int,
  "sessionId": "uuid",
  "payload": {
    "userAgent": "string"
  }
}
```

---

### `session.end`
Fired when participant's browser disconnects (tab close, timeout, or explicit exit).

```jsonc
{
  "type": "session.end",
  "participantId": "uuid",
  "gameId": int,
  "sessionId": "uuid",
  "payload": {
    "durationMs": int
  }
}
```

---

### `team.assigned`
Fired when a participant is assigned to a team seat.

```jsonc
{
  "type": "team.assigned",
  "participantId": "uuid",
  "gameId": int,
  "teamId": int,
  "countryId": int,
  "payload": {
    "countryName": "England",
    "role": "controller" | "spectator"
  }
}
```

---

### `role.changed`
Fired when the controller role is transferred within a team.

```jsonc
{
  "type": "role.changed",
  "gameId": int,
  "teamId": int,
  "payload": {
    "previousControllerId": "uuid",
    "newControllerId":      "uuid",
    "changedBy":            "admin" | "auto"   // "auto" = first-join logic
  }
}
```

---

### `order.submitted`
Fired when the controller submits orders in the webDiplomacy board.
Captured by the AI runner polling `game/status` and detecting a phase + order change,
OR by a new PHP hook in `api.php` on order submission.

```jsonc
{
  "type": "order.submitted",
  "gameId": int,
  "participantId": "uuid",
  "teamId": int,
  "countryId": int,
  "payload": {
    "turn":  int,
    "phase": "Diplomacy" | "Retreats" | "Builds",
    "orders": [ /* Order[] — see UNIVERSAL_CONTRACT §2.2 */ ],
    "readyStatus": "Yes" | "No"
  }
}
```

---

### `order.modified`
Fired when the controller changes orders before the phase ends.

```jsonc
{
  "type": "order.modified",
  "gameId": int,
  "participantId": "uuid",
  "teamId": int,
  "countryId": int,
  "payload": {
    "turn":           int,
    "phase":          "Diplomacy" | "Retreats" | "Builds",
    "previousOrders": [ /* Order[] */ ],
    "newOrders":      [ /* Order[] */ ]
  }
}
```

---

### `message.sent`
Fired for every message: intra-team (Empirica chat) or inter-team (webDiplomacy press).

```jsonc
{
  "type": "message.sent",
  "gameId": int,
  "participantId": "uuid" | null,   // null for bot
  "teamId": int,
  "countryId": int,
  "payload": {
    "scope":            "intra" | "inter",
    "toTeamId":         int | null,     // when scope = "intra"
    "toCountryId":      int | null,     // when scope = "inter"
    "text":             "string",
    "turn":             int | null,
    "webdipMessageId":  int | null      // wD_GameMessages.id when scope = "inter"
  }
}
```

---

### `phase.transition`
Fired when the webDiplomacy game moves to a new phase.
Detected by the AI runner's polling loop.

```jsonc
{
  "type": "phase.transition",
  "gameId": int,
  "payload": {
    "webdipGameId": int,
    "fromPhase":    "Diplomacy" | "Retreats" | "Builds" | "Pre-game",
    "toPhase":      "Diplomacy" | "Retreats" | "Builds" | "Finished",
    "fromTurn":     int,
    "toTurn":       int
  }
}
```

---

### `ai.decision`
Fired every time the AI runner completes a LLM call and submits orders/messages.

```jsonc
{
  "type": "ai.decision",
  "gameId": int,
  "teamId": int,
  "countryId": int,
  "payload": {
    "provider":         "ollama" | "api",
    "model":            "llama3",
    "turn":             int,
    "phase":            "Diplomacy" | "Retreats" | "Builds",
    "orders":           [ /* Order[] — validated, submitted */ ],
    "messages":         [{ "to": int, "text": "string" }],
    "validationErrors": [ "string" ],
    "llmMs":            int               // LLM round-trip time in ms
  }
}
```

---

### `ai.throttled`
Fired when the AI runner skips a turn due to rate limiting.

```jsonc
{
  "type": "ai.throttled",
  "gameId": int,
  "teamId": int,
  "countryId": int,
  "payload": {
    "turn":   int,
    "phase":  "string",
    "reason": "LLM cooldown 4500ms remaining" | "3 message(s) dropped (per-turn cap)"
  }
}
```

---

### `game.created`
Fired by the Empirica server when a new game is registered.

```jsonc
{
  "type": "game.created",
  "gameId": int,
  "payload": {
    "empiricaGameId": "string",
    "webdipGameId":   int,
    "variantId":      int,
    "configSnapshot": object
  }
}
```

---

### `game.ended`
Fired when webDiplomacy reports `phase = "Finished"`.

```jsonc
{
  "type": "game.ended",
  "gameId": int,
  "payload": {
    "webdipGameId": int,
    "turn":         int,
    "reason":       "completion" | "abandoned" | "cancelled",
    "winner":       int | null    // countryID, or null for draw/abandoned
  }
}
```

---

### `ai.advisor`
Fired when a bot in advisor mode posts a suggestion to intra-team chat.
This is in addition to (not instead of) the `message.sent` event for the same action.

```jsonc
{
  "type": "ai.advisor",
  "gameId": int,
  "teamId": int,
  "countryId": int,
  "payload": {
    "provider": "ollama" | "api",
    "model":    "llama3",
    "turn":     int,
    "phase":    "Diplomacy" | "Retreats" | "Builds",
    "suggestedOrders": [ /* Order[] — NOT submitted to webDiplomacy */ ],
    "reasoning": "string",   // brief LLM explanation (1-3 sentences)
    "llmMs":     int
  }
}
```

---

## Event ordering guarantees

- Events within a single service are ordered (append-only to `rs_events`).
- Cross-service ordering is best-effort; `ts` (millisecond precision) is the authoritative sort key.
- For research analysis, sort by `ts` then `id` within the same millisecond.

---

## Adding a new event type

1. Define the `type` string and `payload` shape in this file.
2. Update `UNIVERSAL_CONTRACT.md` changelog.
3. Add a test case in `TASK_1_DATA_API.md` test plan (POST the new event, verify it's stored).
4. If it triggers an SSE push, add the SSE shape to `UNIVERSAL_CONTRACT.md §5`.
