#!/usr/bin/env node
// Builds every tool package from the neutral sources.
//   node build/index.mjs           regenerate dist/ and .claude-plugin/marketplace.json
//   node build/index.mjs --check   fail if the committed output is out of date (used by CI)

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildClaude } from './claude.mjs';
import { REPO } from './lib.mjs';
import { buildVibe } from './vibe.mjs';

const GENERATED = ['dist', '.claude-plugin'];

function build(root) {
  buildClaude(root);
  buildVibe(root);
}

if (process.argv.includes('--check')) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'senior-ai-build-'));
  try {
    build(tmp);
    const stale = GENERATED.filter(dir => {
      const diff = spawnSync('git', ['diff', '--no-index', '--quiet', path.join(tmp, dir), path.join(REPO, dir)]);
      return diff.status !== 0;
    });
    if (stale.length) {
      console.error(`Out of date: ${stale.join(', ')}. Run: node build/index.mjs`);
      process.exit(1);
    }
    console.log('Generated files are up to date.');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
} else {
  build(REPO);
  console.log('Built dist/claude, dist/vibe and .claude-plugin/marketplace.json');
}
