#!/usr/bin/env node
// senior-ai :: update notice
// Tells the user when GitHub has a newer senior-ai version, with the command to update.
// It never updates anything. GitHub is checked at most once a day; any failure stays silent.
//   node check-update.mjs --tool claude   Claude Code SessionStart hook
//   node check-update.mjs --tool vibe     Vibe post_agent hook (runs after every answer; shows the notice at most once a day)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The GitHub API serves the current file; raw.githubusercontent.com can lag a push by several minutes.
const LATEST_URL = 'https://api.github.com/repos/fereshenteti/senior-ai/contents/.claude-plugin/plugin.json';
const DAY_MS = 24 * 60 * 60 * 1000;
const STATE_DIR = process.env.SENIOR_AI_STATE_DIR || path.join(os.homedir(), '.senior-ai');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const IS_WINDOWS = process.platform === 'win32';

const readText = file => fs.readFileSync(file, 'utf8').trim();
const isFresh = file => {
  try {
    return Date.now() - fs.statSync(file).mtimeMs < DAY_MS;
  } catch {
    return false;
  }
};

// Vibe installs record the version in VERSION; the Claude plugin reads its own manifest.
function installedVersion() {
  const versionFile = path.join(HERE, 'VERSION');
  if (fs.existsSync(versionFile)) return readText(versionFile);
  return JSON.parse(fs.readFileSync(path.join(HERE, '..', '.claude-plugin', 'plugin.json'), 'utf8')).version;
}

async function latestVersion() {
  const cache = path.join(STATE_DIR, 'latest-version');
  if (isFresh(cache)) return readText(cache);
  try {
    const response = await fetch(LATEST_URL, {
      headers: { Accept: 'application/vnd.github.raw+json', 'User-Agent': 'senior-ai-update-check' },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { version } = await response.json();
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(cache, `${version}\n`);
    return version;
  } catch {
    return fs.existsSync(cache) ? readText(cache) : '';
  }
}

// True when a is a higher major.minor.patch than b.
function isNewer(a, b) {
  const [x, y] = [a, b].map(v => v.split('.').map(n => Number.parseInt(n, 10) || 0));
  for (let i = 0; i < 3; i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  }
  return false;
}

function vibeUpdateCommand() {
  let source = '<your senior-ai clone>';
  try {
    source = readText(path.join(HERE, 'SOURCE'));
  } catch {}
  return IS_WINDOWS
    ? `in "${source}" run: git pull, then .\\install.cmd --tool vibe`
    : `run: cd "${source}" && git pull && ./install.sh --tool vibe`;
}

async function main() {
  const tool = process.argv[2] === '--tool' ? process.argv[3] : '';
  if (tool !== 'claude' && tool !== 'vibe') return;

  // Vibe has no session-start hook and does not always send a session id, so it is throttled by time.
  const vibeNotified = path.join(STATE_DIR, 'vibe-notified');
  if (tool === 'vibe' && isFresh(vibeNotified)) return;

  const installed = installedVersion();
  const latest = await latestVersion();
  if (!installed || !latest || !isNewer(latest, installed)) return;

  const notice = `senior-ai ${latest} is available (you have ${installed}).`;
  if (tool === 'claude') {
    const systemMessage = `${notice} To update, run in a terminal: claude plugin update senior-ai@feres, then restart Claude Code.`;
    console.log(JSON.stringify({ systemMessage }));
  } else {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(vibeNotified, '');
    console.log(JSON.stringify({ system_message: `${notice} To update, ${vibeUpdateCommand()}` }));
  }
}

try {
  await main();
} catch {
  // Never disturb the session.
}
