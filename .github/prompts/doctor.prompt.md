---
description: 'Run the whole system end-to-end and collect every failure into one diagnosis report: build front and back, run all test suites, start the services, and health-check them. Read-only by default — diagnoses and reports; only fixes when the user asks. Never prints or commits secrets.'
---

# /doctor — build, run, and health-check the whole system

Bring the entire project up in one shot and surface **every** problem at once,
rather than stopping at the first error. The output is a single diagnosis report
grouped by severity, so the user can triage quickly.

## Step 0 — Review the philosophy first
Read [`.github/PHILOSOPHY.md`](../PHILOSOPHY.md) and apply it the whole time:
- **Artifact-based** — use the real build/test/run commands from
  [`.github/prompts/start.prompt.md`](./start.prompt.md) and the Ground truth map
  in [`.github/copilot-instructions.md`](../copilot-instructions.md). Don't invent
  scripts or ports.
- **Research-based** — when a step fails, read the actual error and the relevant
  file before concluding a cause. Cite the file + line.
- **Ask when unsure** — if a command, port, or env var isn't documented, ask
  rather than guessing.
- **Never read, print, echo, or commit secrets.** Confirm an env file exists by
  name only; never echo its contents.

## Step 1 — Discover the commands (don't assume)
From the Ground truth map and `start.prompt.md`, resolve the project's real:
- **Build** command(s) — backend and frontend (e.g. compile, bundle).
- **Test** command(s) — every suite.
- **Run** command(s) — how each service starts, and the port/URL each serves on.
- **Health check** — the endpoint or signal that means "up" for each service.

If any of these are undocumented, ask the user before proceeding.

## Step 2 — Run the gauntlet (collect, don't stop)
Run each phase and **capture the result of every one even if an earlier phase
fails** — the goal is a complete picture:

1. **Install / restore** — ensure dependencies are present (don't upgrade).
2. **Build** — backend, then frontend. Record compile/type/bundle errors.
3. **Test** — run all suites. Record failures (suite, test, message).
4. **Start** — bring up each service in the background; capture startup logs.
5. **Health-check** — hit each service's health endpoint/URL; record status.

Scrub any secret-looking values out of logs before showing them.

## Step 3 — Diagnose
For each failure, give a short, evidence-backed diagnosis: the phase, the artifact
(file + line or command), the likely cause, and the smallest fix. Don't speculate
beyond what the error supports — if the cause is unclear, say so and propose the
next diagnostic step.

## Step 4 — Report (one consolidated output)
Group findings by severity and cite file/command + line:
- **🔴 Blocking** — build broken, tests failing, a service won't start or is
  unhealthy.
- **🟡 Should fix** — flaky tests, warnings, degraded health, slow startup.
- **🟢 Nit** — optional cleanups.

End with a one-line verdict: **healthy** / **needs attention**, and list which
services are up and on which URLs.

## Step 5 — Offer to fix (only if asked)
`/doctor` is **read-only by default**. If the user asks you to fix the findings,
apply the smallest in-style change per the contract and `Style.md`, then re-run the
affected phase to confirm green. Stop services you started if the user is done, and
never push or merge as part of this command.
