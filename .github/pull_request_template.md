# What & why
<!-- One or two sentences: what this PR does and which task it serves. -->


## Contract & style checklist
<!-- Tick what applies. See .github/Template.md and .github/Style.md. -->
- [ ] Matches `Template.md` (routes, payloads, every response shape incl. errors)
- [ ] New/changed endpoint documented in `Template.md` **before** coding
- [ ] Parameterized queries only; no string-interpolated user input
- [ ] System-managed fields never written by hand
- [ ] Input validated at the boundary; structured error JSON, no unhandled 500s
- [ ] Only the files this task needs are changed (no unrelated refactors)
- [ ] Frontend: loading / empty / error states handled; calls go through the client module

## Security
- [ ] No secrets committed or logged (env files, `*.key`, connection strings)
- [ ] Explicit credentials only; nothing hardcoded

## Tests
- [ ] Unit test added for new/changed logic (unit-test-generator skill)
- [ ] Test suite passes in affected package(s)

## How I verified
<!-- The curl / UI steps you ran. -->

```
```
