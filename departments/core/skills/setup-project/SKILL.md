---
name: setup-project
description: Integrate senior-ai into the current project for Claude Code, Mistral Vibe or both - a project AGENTS.md with the detected stack, commands and design source, the .senior-ai/ project memory, team settings so every teammate gets senior-ai, and optionally the orchestrator as default agent. Use when the user asks to set up, install or integrate senior-ai in a project.
user-invocable: true
---

# Integrate senior-ai into this project

## 1. Ask, in one message
Look at the project first (package files, folders) so you can propose answers, then ask:
1. **AI tools** the team uses here: Claude Code, Mistral Vibe or both. Propose the one you are running in.
2. **Departments** the project needs: frontend, backend, devops. Propose what the code shows.
3. **Project memory:** senior-ai keeps stories, decisions and status in a `.senior-ai/` folder. Should it be **shared with the team in git** (recommended for teams) or **kept on this machine** (added to `.gitignore`)?
4. **Orchestrator by default** (Claude Code): should your sessions in this project start as the orchestrator, the product manager that plans and delegates? Default **no**; it stays one mention away (`@agent-senior-ai:orchestrator`) or a command away (`/senior-ai:orchestrate <goal>`).

## 2. Run the setup script
From the project root, run the script in this skill's folder with the answers:
```
node <this-skill-folder>/scripts/setup-project.mjs --tool claude|vibe|both --ignore-memory yes|no --orchestrator-default yes|no
```
It is safe to re-run and never overwrites existing files:
- `AGENTS.md`: created from `AGENTS.project.md` only if missing. Both tools read it.
- `.senior-ai/status.md`: the project memory board (see the `project-memory` skill).
- `.gitignore`: `.visual-check/`, and `.senior-ai/` when the memory stays on this machine.
- Claude Code: `.claude/settings.json` enables `senior-ai@feres` for everyone who trusts the folder; `CLAUDE.md` imports `AGENTS.md`; `.claude/settings.local.json` (personal, git-ignored) holds the orchestrator default when chosen.

Vibe has no per-project install: each Vibe user installs senior-ai once per machine with the installer from the senior-ai repo.

## 3. Fill in the project AGENTS.md
Replace every `<placeholder>` with facts you verify in the project, and delete the sections of departments the project doesn't use:
- **Departments:** the answer to question 2.
- **Commands:** the `scripts` in `package.json` (or the build tool's equivalent).
- **Frontend:** framework and major version, test runner, Storybook, package manager, state management; design source per the `design-fidelity` skill; structure from 2-3 existing components.
- **Backend:** framework, ORM, database and migration command, API style, module layout.
- **DevOps:** hosting, environments, CI, where secrets live (never their values).

If `AGENTS.md` already existed, don't rewrite it: add only the missing sections and show the user what you added. Write `unknown` for what you cannot determine and list it for the user. Keep it short: facts and exceptions, not the global rules.

## 4. Report
List the files changed, the facts filled in and the open questions. Remind the user to commit `AGENTS.md`, `.gitignore`, and for Claude Code `CLAUDE.md` and `.claude/settings.json` (plus `.senior-ai/` if the memory is shared). Then suggest a first step, for example asking the architect to document the current architecture (`.senior-ai/architecture.md`).
