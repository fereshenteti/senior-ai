---
name: setup-project
description: Integrate senior-ai into the current project for Claude Code, Mistral Vibe or both - copies the whole system (agents, skills, rules, hooks) into .senior-ai/system/ so the team can edit and commit it, generates the tool files from it, writes a project AGENTS.md with the detected stack, commands and design source, creates the .senior-ai/ project memory, and optionally makes the orchestrator the default agent. Use when the user asks to set up, install or integrate senior-ai in a project.
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
It copies senior-ai into the project and is safe to re-run (it never overwrites the team's copy or their files):
- `.senior-ai/system/`: the team's own copy of senior-ai (agents, skills, rules, hooks and the generators). It is committed with the project, so teammates can improve it.
- Generated from that copy: `.claude/agents/`, `.claude/skills/` and the hooks in `.claude/settings.json` (Claude Code; the machine-wide `senior-ai@feres` plugin is turned off in this project so nothing runs twice); `.vibe/agents/`, `.vibe/prompts/`, `.vibe/skills/` and `.vibe/hooks.toml` (Vibe uses them once the folder is trusted); and the team rules block in `AGENTS.md`.
- `AGENTS.md`: created from `AGENTS.project.md` only if missing. Both tools read it.
- `.senior-ai/status.md`: the project memory board (see the `project-memory` skill).
- `.gitignore`: `.visual-check/`, and the memory files (never `.senior-ai/system/`) when the memory stays on this machine.
- Claude Code: `CLAUDE.md` imports `AGENTS.md`; `.claude/settings.local.json` (personal, git-ignored) holds the orchestrator default when chosen.

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
List the files changed, the facts filled in and the open questions. Remind the user to commit `.senior-ai/system/`, the generated `.claude/` and `.vibe/` files, `AGENTS.md`, `.gitignore`, and for Claude Code `CLAUDE.md` (plus the rest of `.senior-ai/` if the memory is shared). Tell them how the team changes the system: edit `.senior-ai/system/`, run `node .senior-ai/system/build/project.mjs`, commit both; `--update` takes a newer senior-ai and keeps their edits. Then suggest a first step, for example asking the architect to document the current architecture (`.senior-ai/architecture.md`).
