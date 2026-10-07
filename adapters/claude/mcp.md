# MCP servers for Claude Code

Run once (user scope = available in every project). Skip any you already have, e.g. the Playwright plugin.

```bash
claude mcp add --scope user playwright -- npx -y @playwright/mcp@latest
claude mcp add --scope user angular-cli -- npx -y @angular/cli mcp
```

Check with `claude mcp list`.
