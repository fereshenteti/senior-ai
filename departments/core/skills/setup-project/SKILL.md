---
name: setup-project
description: Integrate senior-ai into the current project for Claude Code, Mistral Vibe or both - installs its agents, skills, rules and hooks in the tools' own project folders (.claude/, .vibe/) so the team can edit and commit them, writes a project AGENTS.md with the detected stack, commands and design source, creates the .senior-ai/ project memory, and optionally makes the orchestrator the default agent. Use when the user asks to set up, install or integrate senior-ai in a project.
user-invocable: true
---

# Integrate senior-ai into this project

## 1. Ask, in one message
Look at the project first (package files, folders) so you can propose answers, then ask:
1. **AI tools** the team uses here: Claude Code, Mistral Vibe or both. Propose the one you are running in.
2. **Departments** the project needs: frontend, backend, devops. Propose what the code shows.
3. **Project memory:** senior-ai keeps stories, decisions and status in a `.senior-ai/` folder. Should it be **shared with the team in git** (recommended for teams) or **kept on this machine** (added to `.gitignore`)?
4. **Orchestrator by default** (Claude Code): should your sessions in this project start as the orchestrator, the product manager that plans and delegates? Default **no**; it stays one mention away (`@agent-orchestrator`) or a command away (`/orchestrate <goal>`).

## 2. Run the setup script
From the project root, run the script in this skill's folder with the answers:
```
node <this-skill-folder>/scripts/setup-project.mjs --tool claude|vibe|both --ignore-memory yes|no --orchestrator-default yes|no
```
It installs senior-ai in each tool's own project folders, where the team edits and commits it. Re-running it keeps every existing file (they are the team's):
- **Vibe:** agents in `.vibe/agents/` with their prompts in `.vibe/prompts/`, skills in `.vibe/skills/`, hook scripts in `.vibe/hooks/` and their entries in `.vibe/hooks.toml`. Vibe uses them once the folder is trusted.
- **Claude Code:** agents in `.claude/agents/`, skills in `.claude/skills/`, hook scripts in `.claude/hooks/` and their entries in `.claude/settings.json`, where the machine-wide `senior-ai@feres` plugin is turned off so nothing runs twice. `CLAUDE.md` imports `AGENTS.md`; `.claude/settings.local.json` (personal, git-ignored) holds the orchestrator default when chosen.
- **Both tools:** skills and hook scripts exist once, in `.claude/`; `.vibe/config.toml` points Vibe at `.claude/skills`. Only the agents exist in each tool's format.
- `AGENTS.md`: created from `AGENTS.project.md` only if missing, plus a block with the team rules. Both tools read it.
- `.senior-ai/status.md`: the project memory board (see the `project-memory` skill).
- `.gitignore`: `.visual-check/`, and `.senior-ai/` when the memory stays on this machine.
- `senior-ai.lock.json` in the hooks folder: the installed version and what senior-ai wrote, for updates.

To take a newer senior-ai later, run the script again with `--update`: files the team did not change are replaced, and a file both changed keeps the team's version with the new one next to it as `<file>.senior-ai-new`.

The script finds senior-ai's sources on this machine (the Claude Code marketplace copy or the Vibe install). If it cannot, ask the user for their senior-ai folder and add `--from <folder>`.

## 3. Fill in the project AGENTS.md
Replace every `<placeholder>` with facts you verify in the project, and delete the sections of departments the project doesn't use:
- **Departments:** the answer to question 2.
- **Commands:** the `scripts` in `package.json` (or the build tool's equivalent).
- **Frontend:** framework and major version, test runner, Storybook, package manager, state management; design source per the `design-fidelity` skill; structure from 2-3 existing components.
- **Backend:** framework, ORM, database and migration command, API style, module layout.
- **DevOps:** hosting, environments, CI, where secrets live (never their values).

If `AGENTS.md` already existed, don't rewrite it: add only the missing sections and show the user what you added. Write `unknown` for what you cannot determine and list it for the user. Keep it short: facts and exceptions, not the global rules.

## 4. Report
List the files changed, the facts filled in and the open questions. Remind the user to commit `.claude/` and `.vibe/` (except personal files such as `.claude/settings.local.json`), `AGENTS.md`, `.gitignore`, `CLAUDE.md`, and `.senior-ai/` if the memory is shared. Tell them the team improves senior-ai by editing those files directly, like any other code. Then suggest a first step, for example asking the architect to document the current architecture (`.senior-ai/architecture.md`).
