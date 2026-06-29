# Style.md — Clean Code Guide

> How we write code in this project. Small, readable, modular, secure. Companion to
> [`Template.md`](./Template.md) (the *what* — APIs and data); this file is the
> *how*. Both are enforced in review.

---

## 1. Guiding principles

1. **Small and modular.** A function should do one thing; if you can't name it
   clearly, split it.
2. **Readable beats clever.** Optimize for the next person reading it.
3. **Only change what the task needs.** Don't refactor, rename, or "improve"
   unrelated code. Don't add features, comments, or types to code you didn't touch.
4. **No premature abstraction.** Don't build a helper or config layer for a
   one-time operation. Wait for the second use.
5. **Fail at the boundary.** Validate external input (HTTP body, file upload, env)
   once, at the edge. Trust it inward.

---

## 2. Naming

- **Constants** at the top of the file, `SCREAMING_SNAKE_CASE`.
- **Functions / variables**: `camelCase` (or the language idiom); verbs for
  functions, nouns for values.
- **Components**: `PascalCase`, one per file, file named after it.
- Avoid abbreviations that aren't already in the codebase.

---

## 3. Comments

- Comments are **≤ 3 lines**, only where they add clarity (the *why*, not the *what*).
- A comment that restates the code is noise — delete it.
- Don't leave commented-out code. Git remembers it.

---

## 4. Functions & structure

- Keep functions short. If a handler grows past ~30 lines, extract a helper.
- One level of abstraction per function: a handler validates + delegates; the
  helper does the work.
- Return early to avoid deep nesting (guard clauses).

---

## 5. Error handling

- Throw or return clear, typed errors at the boundary; let shared middleware catch
  the rest.
- Error responses follow one structured convention (e.g. `{ error: "message" }`).
  Never leak a stack trace to the client.
- Don't `try/catch` just to re-log and re-throw. Catch only where you can add
  context or recover.
- Don't add error handling for things that can't happen. Validate real boundaries.

---

## 6. Async

- Prefer `async/await` over raw promise chains.
- Ensure rejections reach a central error handler.
- Don't fire-and-forget promises that matter; `await` them.

---

## 7. Frontend

- Components are presentational + a thin data layer; route all network calls
  through one shared client module, never inline `fetch`.
- Handle the three states explicitly: **loading, empty, error**. A blank screen on
  error is a bug.
- Reuse existing styles before adding new ones.
- Keep components small; lift shared logic into a hook or the client module.

---

## 8. Security (always on)

Hard rules, not suggestions. See also [`copilot-instructions.md`](./copilot-instructions.md).

- **Never commit secrets.** Env files, `*.key`, `node_modules/`, `dist/` stay
  gitignored. Credentials are read from env, never hardcoded or pasted into source,
  comments, tests, or logs.
- **Parameterized queries only** (OWASP A03). Never string-interpolate user input.
- **Validate & bound all external input** (OWASP A04): non-empty where required,
  correct type, size limits, numeric ranges clamped, dates real.
- **Don't log secrets or full request bodies** that may contain sensitive data.

---

## 9. Formatting

- Match the existing files: indentation, semicolons, quote style.
- Use the project's module system consistently.
- Trailing commas in multiline literals if that's the house style.

---

## 10. Before you open a PR

- [ ] Code matches `Template.md` (routes, payloads, usage standard).
- [ ] No secrets, no hardcoded credentials, parameterized queries.
- [ ] New/changed logic has a unit test (use the `unit-test-generator` skill).
- [ ] Only the files the task needed are changed.
- [ ] Loading / empty / error states handled (frontend).
- [ ] The app still builds and runs clean.
