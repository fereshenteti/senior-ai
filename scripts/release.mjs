#!/usr/bin/env node
// Prepares a release: sets the version in senior-ai.json, regenerates every tool package
// and validates the Claude plugin. Commit and push afterwards.
//   node scripts/release.mjs 1.2.0

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnPortable } from '../installer/run.mjs';

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
  const result = spawnPortable(command, args, { cwd: REPO, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
run(process.execPath, [path.join(REPO, 'build', 'index.mjs')]);
run('claude', ['plugin', 'validate', '.']);
run(process.execPath, [path.join(REPO, 'scripts', 'package-plugin.mjs')]);

console.log(`
Next:
  git commit -am "Release ${version}"
  git tag -a v${version} -m "senior-ai ${version}"
  git push origin main v${version}
  gh release create v${version} out/senior-ai.plugin --title "senior-ai ${version}" --notes "…"
The .plugin file is what Chat and Cowork users install.
Each machine is then told about ${version} within a day and shown how to update.`);
