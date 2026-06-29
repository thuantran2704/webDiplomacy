---
name: unit-test-generator
description: Generate and run unit tests for new or changed logic. Use when adding or changing route/handler logic, validation, data-access wrappers, or client/components, and you need fast, isolated tests. Covers happy path plus validation/error cases, mocks the data layer and network, and never touches real secrets or live systems. Adapt the runner and mock targets to your stack.
---

# unit-test-generator — unit tests

Generate and run fast, isolated unit tests for new or changed logic. Tests must not
hit the real database, external services, or read secret/env files. Mock the
boundaries instead.

**Test runner:** `npm test` in `tools/empirica/` — runs `node src/test.js` (Node
built-in `node:assert/strict`, no extra framework needed).

**Boundary modules to mock:**
- `tools/empirica/src/webdip.js` — HTTP client for all webDiplomacy API calls. Mock
  `getStatus`, `getData`, `getMessages`, `sendMessage`, `setOrders`.
- `tools/empirica/src/ai.js` — LLM provider (`decide(prompt)`). Mock to return a
  fixed `{ orders: [...], messages: [...] }` JSON object.
- `mysql2/promise` — DB connection used by `export.js`. Mock `query` responses.

## Rules
- **Cover everything you touched.** Every new/changed route, branch, validation
  rule, and client method gets a test. For each, include the **happy path** AND
  **every error/edge path** (empty/missing input, out-of-range params, not-found,
  bad type/size, upstream failure). If a branch exists, it has a test.
- **Mock the boundaries** — the data-access layer and network. Never hit the live
  DB/services, and never read real secrets or env files in a test.
- **Run the suite and make it green.** A failing or skipped suite blocks completion.
- Keep tests small and readable; one behavior per test, descriptive names.
- Don't assert on incidental implementation details — assert on the contract
  (status codes, response shape, error shape from `Template.md`).

## Suggested structure
1. Arrange: build the request/input and stub the mocked boundary's return.
2. Act: call the handler/function under test.
3. Assert: response/return value matches the contract; the boundary was called with
   the expected (parameterized) arguments.

## Output
- Place tests next to the code or in the project's test folder per its convention.
- After writing, **run the suite** and report pass/fail and the paths you covered.
