#!/usr/bin/env node
// senior-ai :: session context (Claude Code, at session start, resume, /clear and compaction)
// Injects the global senior-ai rules (AGENTS.md at the plugin root) and the project's status
// board (.senior-ai/status.md), so every session starts with the rules and the current state.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runHook } from './lib.mjs';

const MAX_STATUS_CHARS = 4000;
const SETUP_HINT =
  'This project has no AGENTS.md or CLAUDE.md yet. Mention once that /senior-ai:setup-project integrates ' +
  'senior-ai into the project (project facts, team settings and the .senior-ai/ memory folder). Do not run it unasked.';

const readIfExists = file => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : '');

await runHook(() => {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const rules = readIfExists(path.join(pluginRoot, 'AGENTS.md'));
  if (!rules) return null;
  const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const parts = [rules];

  const status = readIfExists(path.join(projectRoot, '.senior-ai', 'status.md'));
  if (status) {
    const shown = status.length > MAX_STATUS_CHARS ? `${status.slice(0, MAX_STATUS_CHARS)}\n[…truncated: read .senior-ai/status.md for the rest]` : status;
    parts.push(`# Project status (.senior-ai/status.md)\n\n${shown}`);
  }
  if (!['AGENTS.md', 'CLAUDE.md'].some(name => fs.existsSync(path.join(projectRoot, name)))) parts.push(SETUP_HINT);

  return { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: parts.join('\n\n') } };
});
