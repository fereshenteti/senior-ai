# Optional extras

Extras are MCP servers and companion plugins that give agents more abilities. **None is required.** The installer lists the ones each AI tool is missing and asks which to install; skipping one, or a failed install, never stops the installation, and senior-ai works without it.

| Extra | Gives the agents | Account | Claude Code | Vibe |
|---|---|---|---|---|
| Playwright | A real browser: end-to-end tests, screenshots | none | official plugin | MCP server |
| Context7 | Up-to-date library documentation | none | official plugin | MCP server |
| GitHub | Issues, pull requests, repository data | token | official plugin | MCP server |
| Chrome DevTools | Performance traces, console, network | none | official plugin | MCP server |
| Angular CLI | Official Angular best practices and docs | none | MCP server | MCP server |
| Figma | Designs, components and variables | login | official plugin | MCP server |
| Vercel | Deployments, logs, domains, environment variables | login | official plugin | MCP server |

For Claude Code, the official plugin from Anthropic's catalog is used when one exists; otherwise the MCP server is added for your user. For Vibe, the servers go into one marked block of `~/.vibe/config.toml`.

## Accounts

- **Figma, Vercel:** log in the first time an agent uses them (a browser window opens).
- **GitHub:** create a fine-grained personal access token at [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens) and set it in the `GITHUB_PERSONAL_ACCESS_TOKEN` environment variable (your shell profile on macOS/Linux, the environment variables settings on Windows). senior-ai never asks for, stores or prints your tokens.

## Without an extra

Each agent falls back to what it can do without it: the architect reads the official documentation instead of Context7; QA asks before installing Playwright as a project dependency, or checks manually; Vercel work goes through the `vercel` CLI, guided by senior-ai's own `vercel` skill. Nothing breaks.

## Later

Re-run the installer to add extras you skipped. `--no-extras` skips them entirely. Extras installed by senior-ai are kept when you reinstall, and only removed by `--uninstall` if you say so.
