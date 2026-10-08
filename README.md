# senior-ai

One set of general-purpose AI coding rules, skills and agents for **Claude Code** and **Mistral Vibe**.

Built for pixel-perfect frontend work (Angular, SCSS, design tokens, Storybook) with code-review and accessibility standards that apply to every project. Projects only add a short `AGENTS.md` with their own facts.

- [Requirements](#requirements)
- [Claude Code](#claude-code)
- [Mistral Vibe](#mistral-vibe)
- [Installer options](#installer-options)
- [What's inside](#whats-inside)
- [Maintaining senior-ai](#maintaining-senior-ai)

---

## Requirements

Works on **macOS, Linux and Windows**.

- **Node.js 18 or later**: the installer, the hooks and the `setup-project` and `visual-check` skills run on Node.
- **git**: to clone this repo (not needed for the Claude Code plugin commands).
- **Claude Code** and/or **Mistral Vibe**.

In the commands below, macOS and Linux use `./install.sh`; Windows uses `.\install.cmd` (PowerShell or Command Prompt). Both take the same options.

---

## Claude Code

senior-ai is a Claude Code plugin, `senior-ai@feres`: the plugin `senior-ai` from the marketplace `feres` (this repo).
The global rules are injected at the start of every session, and the skills and agents are available as `senior-ai:<name>`.

### Install

**Option 1: plugin commands** (no clone needed)

```bash
claude plugin marketplace add fereshenteti/senior-ai
```
```bash
claude plugin install senior-ai@feres
```

**Option 2: installer** (useful when you also install Vibe)

Open a terminal in your home folder (or wherever you want to keep senior-ai), then:

```bash
git clone https://github.com/fereshenteti/senior-ai.git
```
```bash
cd senior-ai
```

macOS / Linux:
```bash
./install.sh --tool claude
```
Windows:
```powershell
.\install.cmd --tool claude
```

Then add the MCP servers with the commands in [`adapters/claude/mcp.md`](adapters/claude/mcp.md).

### Update

Updates are never installed automatically. While GitHub has a newer version, Claude Code tells you at the start of every session. To update:

```bash
claude plugin update senior-ai@feres
```

Then restart Claude Code.

### Set up a project

From the project root, run:

```
/senior-ai:setup-project
```

It asks which tools the team uses, then creates a project `AGENTS.md` with the detected stack, commands and design source, a `CLAUDE.md` that imports it, adds `.visual-check/` to `.gitignore`, and enables `senior-ai@feres` in `.claude/settings.json`. Commit those files: every teammate who opens the project is prompted to install the plugin. If a teammate is not prompted, they can run `claude plugin install senior-ai@feres --scope project`.

### Use

**In a session you already have open**, mention the agent at the start of your prompt (type `@agent-` to pick it from the list):

```
@agent-senior-ai:ui-builder Implement the Button component. Reference: @design/screens/button.png
```

Plain words work too: `Use the ui-builder agent to implement the Button component.` The agent handles that task and reports back; your session stays the same. The same works for the reviewers, e.g. `@agent-senior-ai:code-auditor review my changes`.

**To start a new session as the agent**, so that every prompt goes to it:

```bash
claude --agent ui-builder
```

Then prompt as usual: `Implement the Button component. Reference: @design/screens/button.png`. The short name works as long as no other plugin has an agent called `ui-builder`; otherwise use `senior-ai:ui-builder`.

The `ui-builder` agent implements the component with tokens, writes its Storybook stories including an `AllStates` story that mirrors the reference sheet, runs the visual check, and delegates reviews to the read-only `visual-reviewer`, `a11y-auditor` and `code-auditor` subagents.

---

## Mistral Vibe

Vibe cannot install plugins from GitHub, so the installer copies the skills, agents, prompts and global rules into Vibe's folder: `~/.vibe` (`%USERPROFILE%\.vibe` on Windows, or `VIBE_HOME` if you set it).

### Install

Open a terminal in your home folder (or wherever you want to keep senior-ai), then:

```bash
git clone https://github.com/fereshenteti/senior-ai.git
```
```bash
cd senior-ai
```

macOS / Linux:
```bash
./install.sh --tool vibe
```
Windows:
```powershell
.\install.cmd --tool vibe
```

Keep the `senior-ai` folder: updates are pulled into it and installed from it.

Then:
1. **MCP servers:** merge [`adapters/vibe/config.example.toml`](adapters/vibe/config.example.toml) into `~/.vibe/config.toml`.
2. **Vision model:** set a vision-capable `active_model` in `~/.vibe/agents/ui-builder.toml` and `visual-reviewer.toml` (or globally) so reference screenshots can be read.

### Update

Updates are never installed automatically. While GitHub has a newer version, Vibe tells you after an answer, at most once a day, including the folder to update from. In a terminal in your `senior-ai` folder:

```bash
git pull
```

Then macOS / Linux:
```bash
./install.sh --tool vibe
```
Windows:
```powershell
.\install.cmd --tool vibe
```

### Set up a project

From the project root, ask Vibe to use the `setup-project` skill. It asks which tools the team uses, then creates a project `AGENTS.md` with the detected stack, commands and design source, and adds `.visual-check/` to `.gitignore`. Commit those files. Each Vibe user installs senior-ai once per machine, as above.

### Use

**In a session you already have open**, press `Shift+Tab` until the agent shown is `ui-builder` (it cycles through the built-in agents first), then prompt as usual:

```
Implement the Button component. Reference: @design/screens/button.png
```

The reviewers are subagents, so you don't switch to them: ask the current agent, e.g. `Use the code-auditor subagent to review my changes.`

**To start a new session as the agent:**

```bash
vibe --agent ui-builder
```

---

## Installer options

`./install.sh` (macOS/Linux) and `.\install.cmd` (Windows) both start `install.mjs` and take the same options. Without options, they ask which tool to install for.

| Option | Effect |
|---|---|
| `--tool claude` / `--tool vibe` / `--tool both` | Choose the tool without being asked |
| `--dry-run` | Show what would happen, change nothing |
| `--link` | Use this folder directly instead of a copy: Vibe gets links (on Windows, folders become junctions; files are copied unless Developer Mode allows symlinks), Claude Code reads the plugin from this folder. For working on senior-ai itself; the folder must stay in place |
| `--uninstall` | Remove everything senior-ai installed and restore backups |

The installer is safe to re-run. Files it replaces in Vibe's folder are moved to `~/.senior-ai/backups/` and restored on `--uninstall`; your own `~/.vibe/AGENTS.md` and `~/.vibe/hooks.toml` get a marked block instead of being replaced.

---

## What's inside

| Path | Used by | Content |
|---|---|---|
| `AGENTS.md` | both tools | Global rules; a project `AGENTS.md` overrides them |
| `skills/` | both tools | Agent Skills (`SKILL.md` + `references/` loaded on demand + `scripts/`), including `setup-project` and its `AGENTS.project.md` template |
| `prompts/` | both tools | System prompts of the four agents |
| `install.mjs`, `install.sh`, `install.cmd` | both tools | The installer (Node), and its launchers for macOS/Linux and Windows |
| `hooks/check-update.mjs` | both tools | Update notice: compares the installed version with GitHub (at most once a day) |
| `adapters/vibe/` | Vibe | Agent profiles (`.toml`), MCP config example |
| `adapters/claude/` | Claude Code | Agent frontmatter, MCP commands |
| `.claude-plugin/`, `hooks/`, `agents/` | Claude Code | Plugin and `feres` marketplace manifests, the hook that injects `AGENTS.md` (`hooks/inject-rules.mjs`), and the agents built by `scripts/build-claude-agents.mjs` |

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
| `setup-project` | Integrate senior-ai into a project |

### Agents
| Agent | Role |
|---|---|
| `ui-builder` | Main agent: implement, document, verify |
| `visual-reviewer` | Read-only: rendered vs. reference differences, with causes |
| `a11y-auditor` | Read-only: WCAG 2.2 AA audit |
| `code-auditor` | Read-only: code review |

---

## Maintaining senior-ai

### Writing or changing skills and agents
- Keep skills **tool-neutral**: say "read the file" or "run the command", never a tool-specific tool name, and don't set `allowed-tools` (Vibe and Claude Code name their tools differently).
- Keep `SKILL.md` short and move detail into `references/*.md`, loaded only when relevant.
- One skill per folder directly under `skills/`; Vibe does not discover nested skill folders.
- Add a new agent: write `prompts/<name>.md`, then `adapters/vibe/agents/<name>.toml` and `adapters/claude/agents/<name>.md` (frontmatter only).
- After changing `prompts/` or `adapters/claude/agents/`, run `node scripts/build-claude-agents.mjs` and commit the generated `agents/`.
- Test unpushed changes in Claude Code with `claude --plugin-dir .`, and in Vibe by re-running the installer with `--tool vibe`.
- Write scripts in Node, not bash or PowerShell, so they run on every OS. Hooks are started as `node <script>`.

### Releasing

```bash
node scripts/release.mjs 1.3.0
```

It sets the version in both `.claude-plugin/` manifests, rebuilds `agents/` and validates the plugin. Then commit and push; every machine is told about the new version and how to update.
