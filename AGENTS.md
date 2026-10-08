# Global engineering rules (senior-ai)

These rules apply to every project. A project's own `AGENTS.md` (or `CLAUDE.md`) states
project facts and exceptions; **when it contradicts this file, the project file wins.**
In Claude Code, the skills and agents named below come from the `senior-ai` plugin as `senior-ai:<name>`.

## Working style
- Read before writing: check how the codebase already solves a problem before adding a new pattern, helper or dependency.
- Do exactly what was asked. No unrequested refactors, features or files.
- If a requirement is ambiguous and the answer changes the result, ask. Otherwise pick the conventional default and say so.
- Finish the job: update every file affected by a change (imports, callers, tests, stories).
- Verify before saying "done": build, lint, tests, and for UI work the visual check. Report failures honestly with the output.

## Frontend defaults
- **Framework:** use the latest stable best practices of the framework version the project is on (detect it from `package.json`). Load the `angular` skill for Angular work.
- **Styling:** SCSS only. Never add Tailwind, Bootstrap, or any other CSS framework/utility library unless the project already uses one. Load the `scss-styling` skill.
- **Design fidelity:** if a design source exists (DESIGN.md, token files, a design-system package, reference screenshots), follow it strictly. Never hard-code a color, spacing, radius, shadow, font or z-index value that a token covers. Load the `design-fidelity` skill.
- **Documentation:** every reusable UI component gets Storybook stories when the project has Storybook. Load the `storybook` skill.
- **Accessibility:** WCAG 2.2 AA is the minimum bar. Load the `a11y` skill.
- **Code quality:** load the `clean-code` skill when writing code and `code-review-standards` when reviewing it.

## Subagents
When delegation is available, use the read-only subagents instead of reviewing your own work:
- `code-auditor`: code review against `code-review-standards`.
- `a11y-auditor`: accessibility audit against `a11y`.
- `visual-reviewer`: compares rendered components with reference designs.
If delegation is not available, apply the same skills yourself and say that the review was self-performed.

**Model choice when delegating:** pick the cheapest model that can do the task well, for every delegation (to these subagents or any other):
- **Small, fast model** (e.g. Haiku): searching, listing, reading or summarizing files, mechanical checks.
- **Mid-tier model** (e.g. Sonnet): code reviews, accessibility and visual audits, standard implementation.
- **Top model** (e.g. Opus): complex reasoning, architecture decisions, hard debugging, or a retry after a cheaper model's result was not good enough.

In Claude Code, set the model on the delegation itself. Where the tool cannot choose a model per delegation (Mistral Vibe), the subagent runs on the model configured for it.
