// Shared plumbing for senior-ai hooks: read the event, answer in the calling tool's format.
// Hooks never break a session: any unexpected error ends silently with "no opinion".

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function readEvent() {
  try {
    const text = fs.readFileSync(0, 'utf8');
    return text.trim() ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export function toolArg() {
  const i = process.argv.indexOf('--tool');
  const tool = i === -1 ? 'claude' : process.argv[i + 1];
  return tool === 'vibe' ? 'vibe' : 'claude';
}

export function emit(output) {
  if (output) process.stdout.write(JSON.stringify(output) + '\n');
}

// Hooks of a project's own copy of senior-ai (.senior-ai/system) run with --project.
export const isProjectCopy = () => process.argv.includes('--project');

// Vibe loads the machine-wide hooks and a project's own hooks together. The machine-wide ones
// step aside where the project's copy runs: its hooks are in .vibe/hooks.toml and Vibe trusts the
// folder (Vibe ignores a project's .vibe/ folder otherwise). A folder trusted for one session only
// is not recorded, so there both run, which is harmless.
export function projectCopyRunsInstead(cwd = process.cwd()) {
  if (isProjectCopy() || toolArg() !== 'vibe') return false;
  const hooksToml = path.join(cwd, '.vibe', 'hooks.toml');
  if (!fs.existsSync(path.join(cwd, '.senior-ai', 'system', 'hooks')) || !fs.existsSync(hooksToml)) return false;
  if (!fs.readFileSync(hooksToml, 'utf8').includes('.senior-ai/system/hooks/')) return false;
  return vibeTrusts(cwd);
}

function vibeTrusts(dir) {
  try {
    const vibeHome = process.env.VIBE_HOME || path.join(os.homedir(), '.vibe');
    const toml = fs.readFileSync(path.join(vibeHome, 'trusted_folders.toml'), 'utf8');
    const list = key => {
      const match = new RegExp(`^${key}\\s*=\\s*(\\[[\\s\\S]*?\\])`, 'm').exec(toml);
      return new Set((match ? JSON.parse(match[1].replace(/,\s*\]$/, ']')) : []).map(entry => path.resolve(entry)));
    };
    const [trusted, untrusted] = [list('trusted'), list('untrusted')];
    for (let current = path.resolve(dir); ; current = path.dirname(current)) {
      if (trusted.has(current)) return true;
      if (untrusted.has(current) || path.dirname(current) === current) return false;
    }
  } catch {
    return false;
  }
}

export async function runHook(main) {
  try {
    if (projectCopyRunsInstead()) return;
    emit(await main());
  } catch {
    // Fail open: a broken hook must not block the user's work.
  }
}
