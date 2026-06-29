---
description: 'Quick reference: lists the available slash commands, skills, and guideline docs with a one-line description of each and when to use it. Read-only — does not change code.'
---

# /help — what you can use

A short menu of this project's AI tooling. **Read-only — this command just
explains; it changes nothing.**

## Slash commands
| Command | Use it to… |
|---|---|
| `/start` | Set up the governance system — interview about purpose, stack, and environment, then fill in the template placeholders. |
| `/doctor` | Run the whole system in one shot — build, run all tests, start the services, and health-check, collecting every failure into a single diagnosis report. |
| `/forge` | Author a new skill or agent the philosophy-first way — research existing conventions, interview for the rest, then scaffold the file. |
| `/vibecode` | Build a feature the right way — research, plan, build, sync the contract, run tests, hand off to review. |
| `/review` | Review the current diff against the contract, style, and security; run PR-split; open a PR per slice. |
| `/sync` | Reconcile the docs with the code — grep the real routes/schema/helpers and update whichever artifact has drifted. |
| `/help` | Show this menu. |

## Skills (auto-used by the agent, or ask for them by name)
| Skill | Use it to… |
|---|---|
| `unit-test-generator` | Generate and run fast unit tests (happy + error paths) with the boundaries mocked — never touches real secrets or live systems. |
| `pull-request-splitter` | Decide whether a change set ships as one PR or split/stacked slices; assigns every changed file to one slice and can open a PR per slice after you confirm. |

## Guideline docs (the rules everything follows)
| Doc | What it defines |
|---|---|
| [`.github/PHILOSOPHY.md`](../PHILOSOPHY.md) | The core principle every command reviews first — artifact-based, research-based, ask-when-unsure (not model judgement). |
| [`.github/Template.md`](../Template.md) | The API & data contract — endpoints, payloads, response/error shapes, schema, helper signatures. |
| [`.github/Style.md`](../Style.md) | The clean-code guide — naming, functions, error handling, async, security, PR checklist. |
| [`.github/copilot-instructions.md`](../copilot-instructions.md) | Global rules + hard security boundaries. |
| [`.github/instructions/`](../instructions/) | Path-scoped rules auto-applied to matching files (e.g. server, web). |
| [`.github/SECURITY.md`](../SECURITY.md) | Security policy — what to protect and how to report issues. |
| [`.github/CUSTOMIZING.md`](../CUSTOMIZING.md) | How to adapt this template to a specific codebase. |
