// The AI tools senior-ai can be installed for, and how to find them on this machine.
// To support a new tool, add an entry here and an install module for it.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { IS_WINDOWS, runCommand } from './run.mjs';

const home = os.homedir();

export const TOOLS = [
  {
    id: 'claude',
    name: 'Claude Code',
    command: 'claude',
    configDir: () => process.env.CLAUDE_CONFIG_DIR || path.join(home, '.claude'),
    install: {
      unix: 'curl -fsSL https://claude.ai/install.sh | bash',
      windows: 'irm https://claude.ai/install.ps1 | iex',
    },
    docs: 'https://code.claude.com/docs/en/setup',
  },
  {
    id: 'vibe',
    name: 'Mistral Vibe',
    command: 'vibe',
    configDir: () => process.env.SENIOR_AI_VIBE_DIR || process.env.VIBE_HOME || path.join(home, '.vibe'),
    install: {
      unix: 'curl -LsSf https://mistral.ai/vibe/install.sh | bash',
      windows:
        'powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"; uv tool install mistral-vibe',
    },
    docs: 'https://github.com/mistralai/mistral-vibe',
  },
];

// The first line of `<command> --version` that contains a version number.
function parseVersion(output) {
  return /\d+\.\d+(\.\d+)?/.exec(output)?.[0] ?? '';
}

// Returns one entry per known tool: { ...tool, installed, version, configDir }.
export function detectTools() {
  return TOOLS.map(tool => {
    const probe = runCommand(tool.command, ['--version'], { timeout: 20_000 });
    const configDir = tool.configDir();
    return {
      ...tool,
      installed: probe.ok,
      version: probe.ok ? parseVersion(probe.stdout + probe.stderr) : '',
      configDir,
      hasConfig: fs.existsSync(configDir),
    };
  });
}

export const installCommand = tool => (IS_WINDOWS ? tool.install.windows : tool.install.unix);
