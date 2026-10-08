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
    cliRequired: true, // the plugin is installed with `claude plugin …`
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
    cliRequired: false, // installing only copies files into Vibe's folder
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

// Where a command would be found on PATH, without running it (Windows tries PATHEXT: .exe, .cmd…).
export function findOnPath(command) {
  const exts = IS_WINDOWS ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean) : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    for (const ext of exts) {
      const candidate = path.join(dir, command + ext.toLowerCase());
      if (fs.existsSync(candidate)) return candidate;
      if (ext && fs.existsSync(path.join(dir, command + ext))) return path.join(dir, command + ext);
    }
  }
  return null;
}

// A first start can be slow (Python tools, antivirus scanning on Windows): wait generously.
const PROBE_TIMEOUT = 90_000;

// Returns one entry per known tool: { ...tool, installed, version, configDir, hasConfig, note }.
// A tool whose command isn't needed to install (Vibe) also counts as installed when its folder exists.
export function detectTools() {
  return TOOLS.map(tool => {
    const probe = runCommand(tool.command, ['--version'], { timeout: PROBE_TIMEOUT });
    const configDir = tool.configDir();
    const hasConfig = fs.existsSync(configDir);
    const installed = probe.ok || (!tool.cliRequired && hasConfig);
    let note = '';
    if (!probe.ok) {
      const where = findOnPath(tool.command);
      const why = probe.timedOut
        ? `the \`${tool.command}\` command didn't answer within ${PROBE_TIMEOUT / 1000} s`
        : where
          ? `\`${tool.command} --version\` failed (exit code ${probe.status})`
          : `the \`${tool.command}\` command isn't on this terminal's PATH`;
      note = installed ? `found its folder at ${configDir}; ${why}, which senior-ai doesn't need` : why;
    }
    return { ...tool, installed, version: probe.ok ? parseVersion(probe.stdout + probe.stderr) : '', configDir, hasConfig, note };
  });
}

export const installCommand = tool => (IS_WINDOWS ? tool.install.windows : tool.install.unix);
