---
name: setup-project
description: Integrate senior-ai into the current project for Claude Code, Mistral Vibe or both - a project AGENTS.md with the detected stack, commands and design source, plus (for Claude Code) the shared plugin settings so every teammate gets senior-ai. Use when the user asks to set up, install or integrate senior-ai in a project.
user-invocable: true
---

# Integrate senior-ai into this project

## 1. Choose the tools
Ask which AI tools the team uses in this project: Claude Code, Mistral Vibe or both. Default to the tool you are running in.

## 2. Run the setup script
From the project root, run the script in this skill's folder:
```bash
node <this-skill-folder>/scripts/setup-project.mjs --tool claude|vibe|both
```
It is safe to re-run. It merges into existing files and never overwrites them:
- `AGENTS.md`: created from `AGENTS.project.md` only if missing. Both tools read it.
- `.gitignore`: ignores `.visual-check/`.
- Claude Code only: `.claude/settings.json` enables `senior-ai@feres` for everyone who trusts the folder, and `CLAUDE.md` imports `AGENTS.md`.

Vibe has no per-project install: each Vibe user installs senior-ai once from the senior-ai repo with `./install.sh --tool vibe` (macOS/Linux) or `install.cmd --tool vibe` (Windows).

## 3. Fill in the project AGENTS.md
Replace every `<placeholder>` with facts you verify in the project, and leave nothing guessed:
- **Stack:** `package.json` (framework and its major version, test runner, Storybook version, package manager), `angular.json` / `project.json` (style language, prefix).
- **Commands:** the `scripts` in `package.json`.
- **Design source:** look for the files listed in the `design-fidelity` skill (DESIGN.md, token files, design-system packages, screenshot folders).
- **Structure:** read 2-3 existing components.

If `AGENTS.md` already existed, do not rewrite it: add only the missing sections, and show the user what you added.
If something cannot be determined, write `unknown` and list it for the user. Keep the file short: facts and exceptions only, not the global rules.

## 4. Report
List the files changed, the facts filled in and the open questions, and remind the user to commit `AGENTS.md`, `.gitignore` and, for Claude Code, `CLAUDE.md` and `.claude/settings.json`.
