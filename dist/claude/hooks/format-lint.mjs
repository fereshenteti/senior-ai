#!/usr/bin/env node
// senior-ai :: format and lint (after every file write or edit)
// Formats the changed file with the project's own Prettier and lints it with the project's own
// ESLint, when the project has them. Lint errors go back to the agent so it fixes them now.
//   Claude Code: PostToolUse  · Vibe: post_tool

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { readEvent, runHook, toolArg } from './lib.mjs';

const LINTED = /\.(?:[cm]?[jt]sx?|vue|svelte)$/i;
const SKIPPED_DIRS = /[\\/](?:node_modules|dist|build|coverage|\.git|\.senior-ai)[\\/]/;
const MAX_LINES = 30;

// The nearest folder above the file that has a package.json.
function projectRoot(file) {
  for (let dir = path.dirname(file); ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    if (path.dirname(dir) === dir) return null;
  }
}

function localBin(root, name) {
  const bin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name);
  return fs.existsSync(bin) ? bin : null;
}

function run(bin, args, cwd) {
  const quoted = process.platform === 'win32' ? args.map(arg => `"${arg}"`) : args;
  return spawnSync(process.platform === 'win32' ? `"${bin}"` : bin, quoted, {
    cwd,
    encoding: 'utf8',
    timeout: 30_000,
    shell: process.platform === 'win32',
  });
}

await runHook(() => {
  const event = readEvent();
  const file = event.tool_input?.file_path;
  if (!file || SKIPPED_DIRS.test(file) || !fs.existsSync(file)) return null;
  const root = projectRoot(path.resolve(file));
  if (!root) return null;

  const prettier = localBin(root, 'prettier');
  if (prettier) run(prettier, ['--write', '--log-level', 'warn', file], root);

  const eslint = LINTED.test(file) ? localBin(root, 'eslint') : null;
  if (!eslint) return null;
  const lint = run(eslint, ['--no-warn-ignored', file], root);
  if (lint.status !== 1) return null; // 0: clean · 2: ESLint itself failed (config), not the agent's code
  const report = lint.stdout.trim().split(/\r?\n/).slice(0, MAX_LINES).join('\n');
  const context = `senior-ai: ESLint reports problems in ${path.relative(root, file)}. Fix them before moving on:\n${report}`;

  return toolArg() === 'vibe'
    ? { hook_specific_output: { additional_context: context } }
    : { hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: context } };
});
