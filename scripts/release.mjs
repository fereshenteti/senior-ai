#!/usr/bin/env node
// Prepares a release: sets the version in senior-ai.json, regenerates every tool package
// and validates the Claude plugin. Commit and push afterwards.
//   node scripts/release.mjs 1.2.0

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = process.argv[2] ?? '';
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage: node scripts/release.mjs <major.minor.patch>');
  process.exit(2);
}

const metaFile = path.join(REPO, 'senior-ai.json');
const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
meta.version = version;
fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2) + '\n');
console.log(`Version set to ${version} in senior-ai.json`);

const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: REPO, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
run(process.execPath, [path.join(REPO, 'build', 'index.mjs')]);
run('claude', ['plugin', 'validate', '.']);

console.log(`
Next:
  git commit -am "Release ${version}"
  git push
Each machine is then told about ${version} within a day and shown how to update.`);
