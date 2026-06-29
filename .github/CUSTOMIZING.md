# Customizing this template for your codebase

This template ships generic. To make it actually enforce *your* project's rules,
fill in the project-specifics and decide how hard you want each rule enforced.

## 1. Fill the placeholders
Search the whole `.github/` folder for `TODO:` and resolve each one:

| File | What to fill in |
|---|---|
| `copilot-instructions.md` | Project one-liner ("the pitch"), stack, the one thing never to cut, security boundaries. |
| `Template.md` | The real contract: schema, endpoints, sample payloads, helper signatures, error conventions. |
| `Style.md` | Language/runtime-specific formatting and naming if they differ. |
| `prompts/start.prompt.md` | Prereqs, install/test/run commands, health check, URLs. |
| `prompts/vibecode.prompt.md` | Stack references and the boundary modules to mock. |
| `skills/unit-test-generator/SKILL.md` | Test runner + the exact boundary modules to mock. |
| `instructions/*.instructions.md` | `applyTo` globs for your server/web paths. |
| `workflows/contract-check.yml` | File globs for contract/schema; install + test commands. |

## 2. Tell the agent where things live
The prompts reference "the shared client module", "the data-access helper", "the
schema source" generically. Fill in the **Ground truth** concept→path map in
`copilot-instructions.md` so the prompts resolve to concrete files without editing
each one:

```
- Shared API client: src/web/api.ts
- Data-access helper: src/server/db.ts
- Schema source: db/schema.sql
- Routes: src/server/routes/**
- Tests: **/*.test.ts (Vitest)
```

This map loads automatically every turn, so every agent works from the same ground
truth. When a path moves, update it here first — and run `/sync` to catch docs that
have drifted from the code.

## 3. Decide how hard each rule is enforced (the ladder)
Agent prompts are **soft** (judgment). Push each rule down until it *fails the
build* instead of *reminding the agent*:

1. **Prompts/instructions** (this template) — soft.
2. **Linters/formatters** — e.g. ESLint `eslint-plugin-security`, a rule banning
   string-interpolated queries; Prettier for formatting.
3. **Unit/contract tests** — a test that introspects the schema/route table and
   fails on unexpected changes.
4. **Git hooks** — `husky` + `lint-staged`; secret scanning (`gitleaks`,
   `git-secrets`) pre-commit.
5. **CI** — `workflows/contract-check.yml` (drift + tests); add a secret-scan job.
6. **Branch protection / rulesets** — require those checks to pass before merge so
   they're unbypassable.

Rule of thumb: anything phrased as "the agent should verify…" is a candidate to
become a script that exits non-zero.

## 4. Make the contract machine-readable (optional, strong)
Promote `Template.md` to an `openapi.yaml` (or JSON Schema) and validate
requests/responses against it in tests. That turns the contract from prose the
agent reads into a gate the build enforces.

## 5. Reuse across many repos
- **Template repository** — mark your filled-in repo as a GitHub *template*.
- **Org `.github` repo** — a repo named `.github` in your org supplies default
  community files to every repo that doesn't override them.
- **Reusable workflows** — keep CI in one repo; call with
  `uses: <org>/<repo>/.github/workflows/<file>.yml@main`.

## 6. Verify it works
- Open a throwaway PR that intentionally drifts the contract → CI should fail.
- Run `/review` on a small diff → it should cite the contract and offer PR-split.
- Run `/vibecode` on a tiny feature → it should plan, test, and ask before shipping.

See [`SECURITY.md`](./SECURITY.md) for the security baseline this template assumes.
