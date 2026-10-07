---
name: init
description: Integrate senior-ai into the current project - enable the plugin in the shared .claude/settings.json so every teammate gets it, and write a project AGENTS.md with the detected stack, commands and design source. Use when the user asks to set up, install or integrate senior-ai in a project.
user-invocable: true
disable-model-invocation: true
---

# Integrate senior-ai into this project

## 1. Run the setup script
From the project root, run the script in this skill's plugin folder (two levels above this file):
```bash
node <plugin-root>/scripts/init-project.mjs
```
It is safe to re-run. It merges into existing files and never overwrites them:
- `.claude/settings.json`: registers the `senior-ai` marketplace and enables `senior-ai@senior-ai`, so teammates are prompted to install it when they trust the folder.
- `AGENTS.md`: created from the template only if missing.
- `CLAUDE.md`: imports `AGENTS.md` (Claude Code reads `CLAUDE.md`, other agents read `AGENTS.md`).
- `.gitignore`: ignores `.visual-check/`.

## 2. Fill in the project AGENTS.md
Replace every `TODO` with facts you verify in the project, and leave nothing guessed:
- **Stack:** `package.json` (framework and its major version, test runner, Storybook version), `angular.json` / `project.json` (style language, prefix).
- **Commands:** the `scripts` in `package.json`.
- **Design source:** look for the files listed in the `design-fidelity` skill (DESIGN.md, token files, design-system packages, screenshot folders).
- **Conventions:** read 2-3 existing components.

If `AGENTS.md` already existed, do not rewrite it: add only the missing sections, and show the user what you added.
If something cannot be determined, write `unknown` and list it for the user. Keep the file short: facts and exceptions only, not the global rules.

## 3. Report
List the files changed, the facts filled in, the open questions, and remind the user to commit `.claude/settings.json`, `AGENTS.md` and `CLAUDE.md`.
