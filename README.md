# senior-ai

Global engineering rules, skills and subagents for AI coding agents (Claude Code, Vibe and other tools that read `AGENTS.md`).
Focus: Angular, SCSS, design-token fidelity, Storybook and WCAG 2.2 AA accessibility.

## Contents
- `AGENTS.md`: global rules that apply to every project. A project's own `AGENTS.md`/`CLAUDE.md` overrides them.
- `skills/`: `a11y`, `angular`, `clean-code`, `code-review-standards`, `design-fidelity`, `scss-styling`, `storybook`, `visual-check`.
- `agents/`: `code-auditor`, `a11y-auditor`, `visual-reviewer` (read-only reviewers), and `ui-builder`.

## Install (Claude Code)
```bash
git clone https://github.com/fereshenteti/senior-ai.git ~/.claude/senior-ai
cp -R ~/.claude/senior-ai/skills/* ~/.claude/skills/
cp ~/.claude/senior-ai/agents/*.md ~/.claude/agents/
echo '@~/.claude/senior-ai/AGENTS.md' >> ~/.claude/CLAUDE.md
```
