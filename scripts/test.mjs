#!/usr/bin/env node
// Runs every test file under tests/ with Node's built-in test runner (listing the files
// explicitly, which works on every supported Node version).
//   node scripts/test.mjs

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TESTS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'tests');
const files = fs
  .readdirSync(TESTS, { recursive: true })
  .filter(file => file.endsWith('.test.mjs') && !file.split(path.sep).includes('fixtures'))
  .map(file => path.join(TESTS, file))
  .sort();
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
