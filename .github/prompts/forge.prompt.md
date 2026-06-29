---
description: 'Author a new skill or custom agent for this repo, the philosophy-first way: review PHILOSOPHY.md, research how existing skills/agents are structured, interview the user for anything unknown, then scaffold the file with correct frontmatter. Asks questions before writing; never invents capabilities or tools. Never prints or commits secrets.'
---

# /forge — create a new skill or agent

Scaffold a new **skill** (`.github/skills/<name>/SKILL.md`) or **agent**
(`.github/agents/<name>.agent.md`) that fits this repo's conventions. The point is
to encode reusable knowledge as a **durable artifact**, not to lean on the model to
remember it next time.

## Step 0 — Review the philosophy first (mandatory)
Read [`.github/PHILOSOPHY.md`](../PHILOSOPHY.md) and hold it for the whole task. It
is the reason this command exists, so the new artifact must embody it:
- **Artifact-based** — the skill/agent should point decisions at files and checks
  (the contract, tests, lint, CI), not at "the agent should remember…".
- **Research-based** — before writing, study how existing skills/agents are built
  and how this project actually works; cite what you find.
- **Ask when unsure** — never invent a capability, tool, command, or workflow. If
  you don't know, ask.
- **Never read, print, echo, or commit secrets.**

The skill/agent you produce must itself instruct its future user to review the
philosophy before running.

## Step 1 — Research existing conventions (don't guess)
Inspect what's already here so the new file matches:
- Existing skills: [`.github/skills/`](../skills/) — read at least one `SKILL.md`
  for structure, tone, and frontmatter.
- Existing agents (if any): [`.github/agents/`](../agents/).
- Existing prompts: [`.github/prompts/`](../prompts/) for the house style.
- The contract and rules: [`.github/Template.md`](../Template.md),
  [`.github/Style.md`](../Style.md),
  [`.github/copilot-instructions.md`](../copilot-instructions.md).

## Step 2 — Interview the user
Decide **skill vs. agent**, then gather what you can't verify yourself:

**Skill vs. agent**
- A **skill** packages a focused, reusable procedure the agent invokes mid-task
  (e.g. "generate tests"). Use when the need is a *capability*.
- An **agent** is a persona/mode with its own scope and tool boundaries for a class
  of work. Use when the need is a *role*.

**Questions to ask (don't assume answers)**
- What is the one job this does? When should it trigger, and when should it *not*?
- What inputs/context does it need, and where does that live in this repo?
- Which tools/commands may it use? Any it must **never** use?
- What artifacts does it read or produce? What must it never touch (secrets,
  system-managed fields, the default branch)?
- For an agent: its scope, tone, and any tool restrictions.

If an answer is missing or ambiguous, ask a follow-up before writing anything.

## Step 3 — Scaffold the artifact
Create the file with valid frontmatter and a clear body:

**Skill** → `.github/skills/<kebab-name>/SKILL.md`
```markdown
---
name: <kebab-name>
description: '<one line: what it does + when to use it + when NOT to>'
---

# <name>
## Step 0 — Review the philosophy (link PHILOSOPHY.md)
## When to use / when not to
## Steps (research → act, citing artifacts)
## Guardrails (secrets, boundaries, ask-when-unsure)
```

**Agent** → `.github/agents/<kebab-name>.agent.md`
```markdown
---
description: '<role + when to invoke>'
tools: [<only the tools it truly needs>]
---

# <name>
## Step 0 — Review the philosophy (link PHILOSOPHY.md)
## Mission & scope
## Allowed / forbidden actions
## Guardrails
```

Keep it small and focused. Match the wording and structure of existing files.

## Step 4 — Wire it in and verify
- Add the new skill/agent to the menu in
  [`.github/prompts/help.prompt.md`](./help.prompt.md) so the docs don't drift.
- Confirm the frontmatter is valid YAML and required fields are present.
- Confirm every internal link resolves.
- Summarize what you created and how to invoke it. Don't commit or push unless the
  user asks.
