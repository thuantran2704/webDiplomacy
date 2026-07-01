# TASK 3 — Consent & Demographics Form

> **Goal:** Replace the single-checkbox consent with a legally sufficient multi-step form.
> Capture consent record and demographics in the unified database before the participant enters the game.
>
> **Contracts:** [`UNIVERSAL_CONTRACT.md §4.1, §4.2`](../contracts/UNIVERSAL_CONTRACT.md#41-participants), [`EVENT_SCHEMA.md — participant.joined, participant.consent`](../contracts/EVENT_SCHEMA.md)
>
> **Depends on:** TASK 1 (Data API — to save participant + consent records)
>
> **Testable in isolation:** Yes — React component testable with React Testing Library. Data API calls can be mocked.

---

## What to build

Rewrite `tools/empirica-app/client/Intro.jsx` as a 3-step form.

---

## Form steps

### Step 1 — Study information sheet (read-only)
- Displays full study description, data collection practices, withdrawal rights
- "Next" button only enabled after user scrolls to bottom (intersection observer on last paragraph)
- No data collected here

### Step 2 — Legal consent checkboxes
All four must be checked to proceed. Each is a separate checkbox:

| Checkbox name | Label |
|---|---|
| `dataCollection` | I understand my game moves and in-game messages will be recorded for research |
| `publications` | I consent to my anonymised data being used in published research |
| `withdrawal` | I understand I can withdraw at any time; data collected up to that point will be retained |
| `ageVerified` | I am 18 years of age or older (or have obtained parental/guardian consent) |

On submit:
1. `POST DATA_API_URL/api/v1/participants { empiricaPlayerId }`  → get participant UUID
2. `POST DATA_API_URL/api/v1/consents { participantId, formVersion, checkboxes, ipHash? }`
3. `POST DATA_API_URL/api/v1/events { type: "participant.consent", ... }`

`formVersion` is read from `window.CONSENT_FORM_VERSION` (injected at build time from env).

### Step 3 — Demographics
Fields:

| Field | Type | Validation |
|---|---|---|
| `age` | number | integer, 18–120 (soft warning if < 18 since age verified in step 2) |
| `gender` | text | max 60 chars, free text |
| `experience` | number | integer, 0–80 (years of Diplomacy experience) |
| `occupation` | text | optional, max 100 chars |

On submit:
1. `POST DATA_API_URL/api/v1/events { type: "participant.joined", payload: { demographics, consentVersion } }`
2. `player.set("participantId", uuid)` — stored on Empirica player for downstream use
3. `player.set("demographics", form)`
4. `player.stage.set("ready", true)` — advances to Stage

---

## Error states

| Condition | UI response |
|---|---|
| Data API unreachable | Red banner: "Unable to connect to study server. Please contact the researcher." — blocks progress |
| Consent API returns 409 (already consented) | Allow through — participant returning to continue |
| Any checkbox unchecked on Step 2 submit | Inline error under the unchecked box: "This field is required to continue" |
| Age < 18 | Yellow warning: "Please confirm you have parental consent (checked above)" |

---

## Files to modify

| File | Change |
|---|---|
| `tools/empirica-app/client/Intro.jsx` | Full rewrite — multi-step |
| `tools/empirica-app/client/App.jsx` | Ensure Intro renders for new players only |
| `tools/empirica-app/.env.example` | Add `REACT_APP_DATA_API_URL`, `REACT_APP_CONSENT_FORM_VERSION` |

---

## Consent form version management

`REACT_APP_CONSENT_FORM_VERSION=1.0` in `.env`.

When the study protocol changes (new data types collected, updated withdrawal policy), bump this string. Returning participants who consented under an older version will see the form again — their old consent row in `rs_consents` is not deleted.

---

## Test plan

React Testing Library tests in `tools/empirica-app/src/__tests__/Intro.test.jsx`.
Mock `fetch` to stub Data API calls.

### T3.1 — Step 1 renders, Next disabled until scrolled
```js
render(<Intro />)
// Step 1 visible, Next button disabled
// Simulate scrollIntoView / intersection observer firing
// Next button enabled
```

### T3.2 — Step 2: cannot proceed with unchecked boxes
```js
// On Step 2, click "I agree" without checking any box
// Expect: inline errors on all 4 checkboxes
// Expect: no fetch calls made
```

### T3.3 — Step 2: all checked → calls Data API
```js
// Check all 4 boxes, click "I agree"
// Expect: fetch POST /api/v1/participants called
// Expect: fetch POST /api/v1/consents called with all checkboxes: true
// Expect: fetch POST /api/v1/events called with type: "participant.consent"
// Expect: advances to Step 3
```

### T3.4 — Step 3: age validation
```js
// Enter age = 16, submit
// Expect: yellow warning visible
// Form still submittable (warning, not error — age is verified by checkbox in Step 2)
```

### T3.5 — Step 3: submit sends participant.joined event
```js
// Fill all demographics, submit
// Expect: fetch POST /api/v1/events with type: "participant.joined"
// Expect: payload.demographics.age, gender, experience present
// Expect: player.stage.set("ready", true) called
```

### T3.6 — Data API unreachable
```js
// Mock fetch to reject
// Expect: red error banner visible
// Expect: form is blocked (no way to advance)
```

### T3.7 — Returning participant (409 on consent) is allowed through
```js
// Mock POST /api/v1/consents to return 409
// Expect: no error shown to user; form continues to Step 3
```

---

## Done criteria

- [ ] T3.1–T3.7 pass
- [ ] All 4 consent checkboxes required (form blocked without all checked)
- [ ] Consent record saved to `rs_consents` via Data API with correct `formVersion`
- [ ] Demographics saved to `rs_events` as `participant.joined`
- [ ] `participantId` stored on Empirica player object for downstream use
- [ ] Form version bump (env change) causes returning participants to re-consent
- [ ] No PII (raw IP, full name) stored — IP is hashed
