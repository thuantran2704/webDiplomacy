---
applyTo: "{api.php,objects/**,gamemaster/**,board/**,admin/**,tools/empirica/src/**}"
---

# Server instructions

> Applies to: PHP backend (`api.php`, `objects/`, `gamemaster/`, `board/`, `admin/`) and Node AI runner (`tools/empirica/src/`).

Rules for backend code in this project. These extend
[`.github/copilot-instructions.md`](../copilot-instructions.md) and
[`.github/Style.md`](../Style.md).

- Validate external input at the boundary; return the project's structured error
  shape, never an unhandled 500/stack.
- Use parameterized queries only — never string-interpolate user input.
- Route all data access through the shared helper/module; don't open ad-hoc
  connections.
- Keep handlers thin: validate + delegate. Extract helpers past ~30 lines.
- Never write system-managed fields by hand; never log secrets or full request
  bodies that may contain sensitive data.
- New/changed endpoints must match [`Template.md`](../Template.md) and be documented
  there first.
