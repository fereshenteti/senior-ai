// The AI tools senior-ai can be installed for, and how to find them on this machine.
// To support a new tool, add an entry here and an install module for it.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { IS_WINDOWS, runCommand } from './run.mjs';

// Read at call time so tests (and unusual setups) can point HOME / USERPROFILE elsewhere.
const home = () => os.homedir();

export const TOOLS = [
  {
    id: 'claude',
    name: 'Claude Code',
    command: 'claude',
    configDir: () => process.env.CLAUDE_CONFIG_DIR || path.join(home(), '.claude'),
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
    configDir: () => process.env.SENIOR_AI_VIBE_DIR || process.env.VIBE_HOME || path.join(home(), '.vibe'),
    // The VS Code extension bundles its own Vibe and reads the same folder (VIBE_HOME or ~/.vibe).
    editorExtension: 'mistralai.mistral-vibe-code',
    // Older Vibe commands ignore an agent's own prompt in Vibe's newer engine, so the agents lose their roles.
    minVersion: '2.26.0',
    upgrade: 'uv tool upgrade mistral-vibe',
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

// Extension folders of VS Code and the editors built on it (local and remote server).
const EDITORS = {
  '.vscode': 'VS Code',
  '.vscode-insiders': 'VS Code Insiders',
  '.cursor': 'Cursor',
  '.windsurf': 'Windsurf',
  '.vscode-oss': 'VSCodium',
  '.vscode-server': 'VS Code (remote)',
};

// The newest installed copy of an editor extension: { editor, version } or null.
// Folders are named <publisher>.<name>-<version>[-<platform>].
export function findEditorExtension(id) {
  let best = null;
  for (const [editorDir, editor] of Object.entries(EDITORS)) {
    const dir = path.join(home(), editorDir, 'extensions');
    let names;
    try {
      names = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      const match = new RegExp(`^${id.replace(/\./g, '\\.')}-(\\d+\\.\\d+\\.\\d+)`, 'i').exec(name);
      if (!match) continue;
      const version = match[1];
      const newer = !best || version.localeCompare(best.version, undefined, { numeric: true }) > 0;
      if (newer) best = { editor, version };
    }
  }
  return best;
}

const olderThan = (version, min) => Boolean(version && min) && version.localeCompare(min, undefined, { numeric: true }) < 0;

// Returns one entry per known tool: { ...tool, installed, version, via, outdated, configDir, hasConfig }.
// `via` says how it was found: its command, or an editor extension (which needs no command).
export function detectTools() {
  return TOOLS.map(tool => {
    const probe = runCommand(tool.command, ['--version'], { timeout: 20_000 });
    const extension = !probe.ok && tool.editorExtension ? findEditorExtension(tool.editorExtension) : null;
    const configDir = tool.configDir();
    const version = probe.ok ? parseVersion(probe.stdout + probe.stderr) : (extension?.version ?? '');
    return {
      ...tool,
      installed: probe.ok || Boolean(extension),
      version,
      via: probe.ok ? 'command' : extension ? `${extension.editor} extension` : '',
      // An extension's version is its own, not the Vibe it bundles, so only a command is compared.
      outdated: probe.ok && olderThan(version, tool.minVersion),
      configDir,
      hasConfig: fs.existsSync(configDir),
    };
  });
}

export const installCommand = tool => (IS_WINDOWS ? tool.install.windows : tool.install.unix);
