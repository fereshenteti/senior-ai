---
name: project-memory
description: The project's shared memory in the .senior-ai/ folder - status board, user stories with their tasks, architecture decision records and the architecture overview. Use when starting work in a project, when planning or reporting, and whenever a story, task or decision changes.
user-invocable: false
---

# Project memory

Agents start every session without memory. The `.senior-ai/` folder at the project root is where the team (people and agents) keeps what must survive between sessions and tools.

```
.senior-ai/
  status.md                 the board: every open story and task, one line each
  stories/S-001-<slug>.md   one story: goal, acceptance criteria, tasks, review results
  decisions/ADR-001-<slug>.md   one architecture decision record (written by the architect)
  architecture.md           the current stack and structure (maintained by the architect)
```

## Rules
- **Read before planning:** `status.md` and `architecture.md` first; open a story or ADR only when needed.
- **Write after acting:** update the task row and `status.md` after each task, not at the end of the session.
- **Short and factual:** decisions, states, links to files. No transcripts, no long code, no repetition of what git already records.
- **Never secrets:** no tokens, passwords, keys, personal data or internal URLs that should not be shared.
- **Numbering:** next free number, three digits (`S-007`, `ADR-012`); slugs in kebab-case.
- Create the folder and `status.md` when missing. Whether `.senior-ai/` is committed is the team's choice (made in `setup-project`); work the same either way.

## Templates
- Status board: `templates/status.md`
- Story: `templates/story.md`
- Decision record: `templates/adr.md`
- Architecture overview: `templates/architecture.md`
