#!/usr/bin/env node
// Prepares a release: sets the version in both .claude-plugin manifests, rebuilds agents/
// from prompts/ and validates the plugin. Commit and push afterwards.
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

function update(file, apply) {
  const full = path.join(REPO, '.claude-plugin', file);
  const json = JSON.parse(fs.readFileSync(full, 'utf8'));
  apply(json);
  fs.writeFileSync(full, JSON.stringify(json, null, 2) + '\n');
}

update('plugin.json', json => {
  json.version = version;
});
update('marketplace.json', json => {
  const entry = json.plugins.find(plugin => plugin.name === 'senior-ai');
  if (!entry) throw new Error('senior-ai entry missing from marketplace.json');
  entry.version = version;
});
console.log(`Version set to ${version} in .claude-plugin/plugin.json and .claude-plugin/marketplace.json`);

const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: REPO, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
run(process.execPath, [path.join(REPO, 'scripts', 'build-claude-agents.mjs')]);
run('claude', ['plugin', 'validate', '.']);

console.log(`
Next:
  git commit -am "Release ${version}"
  git push
Each machine is then told about ${version} within a day and shown how to update.`);
