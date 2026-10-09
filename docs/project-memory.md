# Project memory

Agents start every session without memory. The `.senior-ai/` folder at the root of each project keeps what must survive between sessions, tools and teammates.

```
.senior-ai/
  status.md                     the board: every open story and task, one line each
  stories/S-001-<slug>.md       a story: goal, acceptance criteria, tasks, review log, QA results
  decisions/ADR-001-<slug>.md   an architecture decision record
  architecture.md               the current stack and structure
```

- The **orchestrator** writes stories and keeps `status.md` up to date after every task.
- The **architect** writes decision records and keeps `architecture.md` current.
- The **QA engineer** records acceptance results in the story.
- In Claude Code, `status.md` is loaded at the start of every session, so work resumes where it stopped.

## Shared or private

`setup-project` asks you once:
- **Shared in git** (recommended for teams): commit `.senior-ai/` so everyone, and every tool, sees the same stories and decisions.
- **Kept on your machine:** the memory files in `.senior-ai/` are added to `.gitignore`. The team's copy of senior-ai in `.senior-ai/system/` is always committed.

Change your mind later by editing `.gitignore`.

## Rules the agents follow

- Short and factual: decisions, states, links to files. No transcripts.
- Never secrets, tokens, passwords or personal data.
- Numbered files (`S-007`, `ADR-012`) with kebab-case names.

The templates are in the `project-memory` skill (`departments/core/skills/project-memory/templates/`).
