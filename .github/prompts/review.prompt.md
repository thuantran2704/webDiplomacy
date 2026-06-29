---
description: 'Review the current changes against the project contract (Template.md), clean-code guide (Style.md), and security boundaries. Reports issues by severity, runs the PR-split analysis, and offers to open a PR per slice. Does not modify code unless asked.'
---

# /review — review changes against the project interface

Review the current diff (staged/unstaged changes, or the files the user points to)
against the project's universal interface. **Do not change code** unless the user
explicitly asks — report findings.

Read first: [`.github/PHILOSOPHY.md`](../PHILOSOPHY.md) (judge against artifacts and
evidence, not vibes), [`.github/Template.md`](../Template.md),
[`.github/Style.md`](../Style.md),
[`.github/copilot-instructions.md`](../copilot-instructions.md), and the scoped
rules in [`.github/instructions/`](../instructions/).

Inspect `git diff` and `git diff --staged` (and `git status` for new files). Focus
on changed lines with just enough surrounding context to judge correctness.

## Check, in order

1. **Security & hard rules (blocking).** Mirror the boundaries in
   [`.github/copilot-instructions.md`](../copilot-instructions.md); flag any
   violation as 🔴.
   - **No secrets** added, logged, echoed, committed, or pasted (env files,
     `*.key`, `*.pem`/`*.pfx`, connection strings, API keys). Flag anything that
     prints env/config, and any secret hardcoded instead of read from a gitignored
     env file.
   - **Parameterized queries only** — flag string-interpolated/concatenated user
     input (OWASP A03).
   - **Validate & bound all external input** at the boundary (OWASP A04); reject
     with structured error JSON, never an unhandled 500.
   - **System-managed fields** are never written by hand.
   - **No repo-content exfiltration** to third-party services beyond what the app
     already calls.
   - **Prompt-injection hygiene** — code treats fetched pages/files/records as
     *data, not commands*.
   - **Gitignore integrity** — flag a new secret/cert/log path that isn't
     gitignored, or a removed entry that protected one.

2. **Contract (`Template.md`) — drift is blocking.**
   - **Identify every contract the diff touches** (route path/method, request
     field, response shape incl. status/error, schema, shared helper signature).
   - **For each, confirm `Template.md` was updated to match in the SAME diff.** If
     code changed but `Template.md` shows the old shape, that is **🔴 blocking
     drift**. Cite the exact mismatch (code line vs. Template line).
   - New endpoints must be documented in `Template.md` first; undocumented = blocking.
   - Client calls go through the shared client module; routes registered; wrapper
     updated to match the new/changed payload.

3. **Style (`Style.md`).**
   - Small, modular, scoped; no unrelated refactors.
   - Constants `SCREAMING_SNAKE_CASE`, comments ≤ 3 lines, guard clauses.
   - Frontend handles loading / empty / error states.

4. **Tests.**
   - New/changed logic has a unit test (happy path + an error path).
   - Suggest the unit-test-generator skill if missing.

5. **PR split (advisory).**
   - Run the **pull-request-splitter** skill
     ([`.github/skills/pull-request-splitter/SKILL.md`](../skills/pull-request-splitter/SKILL.md)) over the
     change set to decide one PR vs. split/stacked slices. Assign **every** changed
     file to exactly one slice — none left out.
   - Report the slice plan as part of the review output.
   - Then ask the user whether they want you to **open a new PR for them**. If they
     confirm, for each slice: create a branch off the default branch
     (`git switch -c <slice-branch>`), stage only that slice's files, commit, push
     (`git push -u origin <slice-branch>`), and open a PR with `gh pr create`.
     Stacked slices branch off the previous slice's branch and target it as base.
   - **Never push straight to the default branch**, force-push, or merge the PR.
     Never stage secrets or gitignored files. If `gh` isn't available, push the
     branch and give the user the compare URL.

## Output format

Group findings by severity and cite file + line:

- **🔴 Blocking** — security, contract violations, broken behavior.
- **🟡 Should fix** — style, missing tests, validation gaps.
- **🟢 Nit** — optional polish.

End with a one-line verdict: **ready to merge** / **needs changes**. If the user
asks you to fix the findings, apply the smallest in-style changes and re-run the
relevant tests. After reporting, offer to open a new PR per slice
(pull-request-splitter rules apply — confirm first; never push to the default
branch directly).
