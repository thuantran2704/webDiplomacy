---
name: pull-request-splitter
description: Advisory PR split analyzer. Use during /review or before opening a PR to decide whether the current change set should ship as one PR or be split/stacked into smaller reviewable slices. Classifies every changed file into a slice (no file left unassigned), returns a JSON decision (APPROVE | SLICE_PLAN | SKIPPED), and then offers to open a new PR per slice (branch + commit + push + gh pr create) — only after the human confirms. Advisory by default; never branches, pushes, or opens a PR without explicit confirmation, and never pushes straight to the default branch.
---

# pull-request-splitter — advisory PR split analyzer

Decide whether the current change set should remain one PR or be split/stacked into
smaller reviewable slices. **Advisory only by default**: do not modify files, create
branches, post comments, merge, push, or open a PR *unless the human explicitly
confirms* the ship step at the end. Never push straight to the default branch.

## When to use
- Inside `/review`, after the diff has been reviewed.
- Before opening a PR, to plan reviewable slices.

## Inputs (read-only)
Inspect the change set with git — never assume:
- `git status --short` (staged, unstaged, untracked)
- `git diff HEAD --stat` and `git diff HEAD` for content
- `git ls-files --others --exclude-standard` for new files

## Core rule — approve only when the PR has
- One reviewer-facing purpose · one risk profile · one rollback boundary · roughly
  one reviewer/ownership boundary · no split that makes validation harder than review.

If any of these break, consider `SLICE_PLAN`.

## Analysis steps
1. **Identify change units** — prefer commits if clean; use files if commits are tangled.
2. **Classify each unit** — concern/purpose; directory/module; layer (infra,
   contract, backend, frontend, tests, docs, config, refactor, unknown); risk
   (low/medium/high); owner/reviewer group; dependency links.
3. **Compute affinity** between units:

   | Signal | Weight |
   |---|---:|
   | Semantic similarity | 0.30 |
   | File or symbol overlap | 0.20 |
   | Directory/module overlap | 0.15 |
   | Dependency proximity | 0.15 |
   | Owner/reviewer overlap | 0.10 |
   | Risk compatibility | 0.10 |

4. **Thresholds** (support, don't replace, an explainable decision):
   `>= 0.75` combine · `0.45–0.74` stack candidate · `< 0.45` split candidate.

## Split triggers (→ SLICE_PLAN)
Multiple unrelated concerns · mixed risk profiles · different owners · independent
rollback boundaries · weakly linked modules · large PR with low cohesion · refactor
mixed with behavior change · docs/config unrelated to the code change.

## Stack instead of split — when
One feature naturally layered; later slices depend on earlier; each slice is still
understandable; review order matters. Preferred stack order:
1. Infra / schema → 2. Contracts / interfaces → 3. Backend logic →
4. Frontend / integration → 5. Tests / docs.

## Anti-over-splitting guardrails — do NOT split when
Slice too small to review meaningfully · cannot compile/validate alone · feature
can't be E2E-validated until all parts land · docs explain the code change and
belong with it · split is artificial fragmentation · confidence `< 0.50` (downgrade
to `APPROVE`).

## Coverage rule (every file gets a slice)
**Each changed/untracked file must be assigned to exactly one slice.** Before
emitting the result, list the files from git and confirm none is left out and none
appears twice. If a file genuinely can't be placed, surface it under `concerns` and
put it in an explicit `misc` slice — never silently drop it.

## Required response format
Return JSON only (advisory result), then a short plain-text follow-up question.

```json
{
  "decision": "APPROVE | SLICE_PLAN | SKIPPED",
  "confidence": 0.0,
  "summary": "short reviewer-facing summary",
  "rationale": ["why this decision was made"],
  "concerns": ["main semantic concerns found"],
  "slices": [
    {
      "name": "slice name",
      "purpose": "what this slice does",
      "files": ["path/to/file"],
      "depends_on": ["previous slice name"],
      "validation_note": "how this slice can be tested or why it must be stacked"
    }
  ]
}
```

## After the analysis — offer to ship (confirm first)
Once the JSON is returned, **ask the human exactly one question**: whether they want
you to open a new PR (per slice) for them.

- If they decline → stop. Advisory only; change nothing.
- If they confirm → for each slice, in stack order:
  1. Branch off the default branch (or the previous slice's branch, if stacked):
     `git switch -c <slice-branch>`.
  2. Stage only that slice's files (`git add <slice files>`) and commit with a clear
     conventional-commit message. Keep contract docs in the SAME slice as the code
     they describe.
  3. Push the branch: `git push -u origin <slice-branch>`.
  4. Open the PR: `gh pr create` with a title + body summarizing the slice and its
     `validation_note`. Stacked slices target the previous slice's branch as base.
  - If `gh` isn't available, push the branch and give the user the compare URL.
- **Never** push straight to the default branch, force-push, rewrite published
  history, or merge the PR. Never stage secrets or gitignored files.
