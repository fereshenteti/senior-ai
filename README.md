# senior-ai

One set of general-purpose AI coding rules, skills and agents, installed for **Mistral Vibe**, **Claude Code**, or both.

Built for pixel-perfect frontend work (Angular, SCSS, design tokens, Storybook) with code-review and accessibility standards that apply to every project. Projects only add a short `AGENTS.md` with their own facts.

## Install

```bash
git clone https://github.com/fereshenteti/senior-ai.git ~/senior-ai && cd ~/senior-ai
./install.sh                    # asks: both (default), Vibe or Claude Code
./install.sh --tool vibe        # or: --tool claude | --tool both
./install.sh --dry-run          # preview, change nothing
./install.sh --link             # use this folder directly instead of a copy
./install.sh --uninstall        # remove everything and restore backups
```

| Tool | What the installer does | Updates |
|---|---|---|
| Claude Code | Installs the `senior-ai@feres` plugin from GitHub (with `--link`: from this folder). Rules are injected at session start; skills and agents are `senior-ai:<name>`. | `claude plugin update senior-ai@feres` |
| Mistral Vibe | Copies skills, prompts, agents and rules into `~/.vibe` (with `--link`: symlinks to this folder). Existing files are moved to `~/.senior-ai/backups/` and restored on `--uninstall`; your own `~/.vibe/AGENTS.md` gets a marked block instead of being replaced. | `git pull`, then re-run `./install.sh --tool vibe` |

Updates are never installed automatically. While GitHub has a newer version, each new session tells you and shows the command to run:
Claude Code when the session starts, Vibe after its first answer. GitHub is checked at most once a day.

Claude Code only, without cloning:
```bash
claude plugin marketplace add fereshenteti/senior-ai
claude plugin install senior-ai@feres
```

Then:
1. **MCP servers:** Vibe: merge `adapters/vibe/config.example.toml` into `~/.vibe/config.toml`. Claude Code: run the commands in `adapters/claude/mcp.md`.
2. **Vision model (Vibe):** set a vision-capable `active_model` in `ui-builder.toml` and `visual-reviewer.toml` (or globally) so reference screenshots can be read.

## Integrate into a project

From the project root, run `/senior-ai:setup-project` in Claude Code, or ask Vibe to use the `setup-project` skill. It asks which tools the team uses, then:
- creates a project `AGENTS.md` (project facts and exceptions only; it overrides the global rules) and fills in the detected stack, commands and design source;
- adds `.visual-check/` to `.gitignore`;
- for Claude Code: adds a `CLAUDE.md` that imports `AGENTS.md`, and enables `senior-ai@feres` in `.claude/settings.json`, so every teammate who opens the project is prompted to install the plugin.

Commit those files. Vibe users install senior-ai once per machine with `./install.sh --tool vibe`.

## Use

```bash
vibe --agent ui-builder                # Mistral Vibe
claude --agent senior-ai:ui-builder    # Claude Code
```
Example prompt: `Implement the Button component. Reference: @design/screens/button.png`

The `ui-builder` agent implements the component with tokens, writes its Storybook stories including an `AllStates` story that mirrors the reference sheet, runs the visual check, and delegates reviews to the read-only `visual-reviewer`, `a11y-auditor` and `code-auditor` subagents.

## What's inside

| Path | Shared? | Content |
|---|---|---|
| `AGENTS.md` | both tools | Global rules; a project `AGENTS.md` overrides them |
| `skills/` | both tools | Agent Skills (`SKILL.md` + `references/` loaded on demand + `scripts/`), including `setup-project` and its `AGENTS.project.md` template |
| `prompts/` | both tools | System prompts of the four agents |
| `adapters/vibe/` | Vibe | Agent profiles (`.toml`), MCP config example |
| `adapters/claude/` | Claude Code | Agent frontmatter, MCP commands |
| `.claude-plugin/`, `hooks/`, `agents/` | Claude Code | Plugin and `feres` marketplace manifests, the hook that injects `AGENTS.md`, and the agents built by `scripts/build-claude-agents.sh` |

### Skills
| Skill | Purpose |
|---|---|
| `angular` | Latest Angular best practices for the detected version (signals, control flow, OnPush, `inject()`, typed forms, testing with the project's runner) |
| `scss-styling` | SCSS only, no CSS frameworks, tokens instead of hard-coded values, states, theming |
| `design-fidelity` | Find and strictly follow the design source; extract tokens from DESIGN.md; report missing tokens |
| `storybook` | CSF3 stories, autodocs, `AllStates` story mirroring the reference sheet |
| `visual-check` | Pixel-compare a story with its reference image (`scripts/visual-check.mjs`) and fix in a loop |
| `code-review-standards` | Review method, severity scale, report format + Angular/TS/SCSS/security checklists |
| `a11y` | WCAG 2.2 AA build rules and audit method |
| `clean-code` | Language-agnostic coding standards |
| `setup-project` | Integrate senior-ai into a project (user-invoked) |

### Agents
| Agent | Role |
|---|---|
| `ui-builder` | Main agent: implement, document, verify |
| `visual-reviewer` | Read-only: rendered vs. reference differences, with causes |
| `a11y-auditor` | Read-only: WCAG 2.2 AA audit |
| `code-auditor` | Read-only: code review |

## Writing or changing skills
- Keep skills **tool-neutral**: say "read the file" or "run the command", never a tool-specific tool name, and don't set `allowed-tools` (Vibe and Claude Code name their tools differently).
- Keep `SKILL.md` short and move detail into `references/*.md`, loaded only when relevant.
- One skill per folder directly under `skills/`; Vibe does not discover nested skill folders.
- Add a new agent: write `prompts/<name>.md`, then `adapters/vibe/agents/<name>.toml` and `adapters/claude/agents/<name>.md` (frontmatter only).
- After changing `prompts/` or `adapters/claude/agents/`, run `scripts/build-claude-agents.sh` and commit the generated `agents/`.
- Releasing for Claude Code: `scripts/release.sh <version>` (e.g. `1.2.0`) sets the version in both `.claude-plugin/` manifests, rebuilds `agents/` and validates the plugin; then commit and push. Every machine is told about the new version and how to update. Test unpushed changes with `claude --plugin-dir .`.
