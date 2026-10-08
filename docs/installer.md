# Installer

`./install.sh` (macOS, Linux) and `.\install.cmd` (Windows) both start `install.mjs` with Node, and take the same options.

| Option | Effect |
|---|---|
| `--tool claude` / `--tool vibe` / `--tool both` | Choose the tools without being asked |
| `--yes` | Accept every default: all tools found, all missing extras |
| `--no-extras` | Don't offer or install extras |
| `--dry-run` | Show what would happen, change nothing |
| `--link` | Use this folder directly instead of a copy (for working on senior-ai itself) |
| `--uninstall` | Remove senior-ai and restore what it replaced |
| `--help` | List the options |

Without a terminal (CI, scripts) and without `--yes`, it installs for every tool found and skips the extras.

## How tools are found

- **Claude Code:** the `claude` command answers `claude --version`.
- **Mistral Vibe:** the `vibe` command answers `vibe --version`, **or** the Mistral Vibe VS Code extension (`mistralai.mistral-vibe-code`) is installed in VS Code, VS Code Insiders, Cursor, Windsurf, VSCodium or VS Code's remote server. The extension bundles its own Vibe and reads the same folder (`~/.vibe`, or `VIBE_HOME`), so senior-ai installs the same way for both.

## What it changes

**Claude Code:** the `feres` marketplace (this repository) and the `senior-ai@feres` plugin; the extras you chose.

**Mistral Vibe** (`~/.vibe`, or `VIBE_HOME`):
- `skills/`, `agents/`, `prompts/`: one entry per senior-ai skill and agent;
- `AGENTS.md`: the global rules, or a marked block appended to your own `AGENTS.md`;
- `senior-ai/`: the hook scripts, the installed version and the source folder;
- `hooks.toml`: a marked block with senior-ai's hooks;
- `config.toml`: a marked block with the extras' MCP servers, if you chose any.

## Safety

- Anything it replaces is moved to `~/.senior-ai/backups/<date>/` and restored by `--uninstall`.
- Files you own (`AGENTS.md`, `hooks.toml`, `config.toml`) only get a marked block, never a rewrite.
- A record per tool in `~/.senior-ai/` makes reinstalls and `--uninstall` exact.
- It never asks for, stores or prints secrets.
