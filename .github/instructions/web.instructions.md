---
applyTo: "{beta-src/**,tools/empirica-app/**}"
---

# Web / client instructions

> Applies to: React board UI (`beta-src/`) and Empirica participant app (`tools/empirica-app/`).

Rules for frontend code in this project. These extend
[`.github/copilot-instructions.md`](../copilot-instructions.md) and
[`.github/Style.md`](../Style.md).

- Route all network calls through one shared client module; never inline `fetch`.
- Handle the three states explicitly: **loading, empty, error**. A blank screen on
  error is a bug.
- Keep components small and presentational; lift shared logic into a hook or the
  client module.
- Reuse existing styles before adding new ones.
- Match request/response shapes to [`Template.md`](../Template.md); update the client
  wrapper when a payload changes.
