# Troubleshooting

**"No supported AI tool found"**
Install Claude Code or Mistral Vibe ([README](../README.md#1-install-the-prerequisites)), open a new terminal so it is on your `PATH`, and run the installer again. Check with `claude --version` or `vibe --version`.

**"Node.js is required"**
Install Node.js 22 or later from [nodejs.org](https://nodejs.org) and open a new terminal.

**Windows: `install.cmd` is not recognized**
In PowerShell, run it as `.\install.cmd` from the `senior-ai` folder.

**An extra failed to install**
The summary shows the reason. senior-ai works without it; re-run the installer later to try again. For Claude Code you can also install it by hand: `/plugin` → Discover.

**Claude Code doesn't show the senior-ai agents or skills**
Restart Claude Code, or run `/reload-plugins`. Check that `claude plugin list` shows `senior-ai@feres` as enabled.

**I was told an update is available but `claude plugin update` says it's up to date**
GitHub can take a few minutes to serve a new release. Run `claude plugin marketplace update feres`, then `claude plugin update senior-ai@feres`.

**The safety guard refused a command I need**
It refuses only commands that can destroy data or systems, or that contain secrets. Run the command yourself if you really mean it. For secrets, use environment variables and a git-ignored `.env` file.

**Format and lint does nothing**
It only uses the project's own Prettier and ESLint (`node_modules/.bin`). Run `npm install` in the project first.

**Vibe: a run started with `vibe -p` never finishes**
Without a terminal, nobody can answer Vibe's approval prompts, so it waits. For unattended runs, add `--auto-approve` (senior-ai's safety guard still refuses destructive commands and secrets, but actions that would normally need your approval, such as commits, are no longer asked).

**Vibe is only installed as the VS Code extension**
That's supported: the installer finds the extension and installs into the same folder it reads (`%USERPROFILE%\.vibe` on Windows, `~/.vibe` elsewhere). Afterwards, reload the editor window and pick a senior-ai agent in the Vibe panel's agent selector. Safety hooks run with Node, so Node.js must be on the PATH the editor starts with: restart the editor after installing Node.

**Vibe: the orchestrator works alone or acts like plain Vibe**
Use Vibe 2.26.0 or newer: older versions ignore an agent's own instructions in Vibe's newer engine, so the agents lose their roles and cannot find their reviewers. Check with `vibe --version`; upgrade with `uv tool upgrade mistral-vibe`. The VS Code extension updates itself. Then re-run the installer with `--tool vibe`. To check that delegation works, ask the orchestrator for a review: Vibe should show `Starting …` for a reviewer such as `frontend-security`.

**Vibe agents don't appear**
Re-run the installer with `--tool vibe` and restart Vibe. Main agents are picked with `Shift+Tab`; reviewers are subagents that the main agent calls.
