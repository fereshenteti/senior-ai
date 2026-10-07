# senior-ai

Senior frontend engineering rules, skills and reviewer agents for Claude Code, packaged as a plugin.
Focus: Angular, SCSS, design-token fidelity, Storybook and WCAG 2.2 AA accessibility.

## Install on a machine
```bash
claude plugin marketplace add fereshenteti/senior-ai
claude plugin install senior-ai@senior-ai
```
That's all. The rules in `AGENTS.md` are injected into every session automatically, and the skills and agents
are available everywhere as `senior-ai:<name>`. Get new versions with `claude plugin marketplace update senior-ai`.

## Integrate into a project
In Claude Code, from the project root:
```
/senior-ai:init
```
It:
- enables the plugin in `.claude/settings.json`, so every teammate who opens the project is prompted to install it;
- writes a project `AGENTS.md` with the detected stack, commands and design source, imported from `CLAUDE.md`;
- adds `.visual-check/` to `.gitignore`.

Commit `.claude/settings.json`, `AGENTS.md` and `CLAUDE.md`. The project `AGENTS.md` holds project facts and
exceptions only; when it contradicts the global rules, the project wins.

Teammates without the plugin can run `claude plugin install senior-ai@senior-ai --scope project` after trusting the folder.

## Contents
| Path | What |
|---|---|
| `AGENTS.md` | Global rules, injected at session start by `hooks/inject-rules.sh` |
| `skills/` | `a11y`, `angular`, `clean-code`, `code-review-standards`, `design-fidelity`, `scss-styling`, `storybook`, `visual-check`, `init` |
| `agents/` | `code-auditor`, `a11y-auditor`, `visual-reviewer` (read-only reviewers), `ui-builder` (`claude --agent senior-ai:ui-builder`) |
| `scripts/init-project.mjs` | Project setup used by `/senior-ai:init`; also runnable directly with `node` |
| `templates/AGENTS.md` | Project `AGENTS.md` template |

## Develop
Test local changes without pushing: `claude --plugin-dir ~/path/to/senior-ai`. Run `claude plugin validate .` before committing,
and bump `version` in `.claude-plugin/plugin.json` and `marketplace.json` for each release.
