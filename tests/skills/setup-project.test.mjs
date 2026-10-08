import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { tempDir } from '../helpers.mjs';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// The generated copy, as installed: the script finds project-memory as a sibling skill.
const SCRIPT = path.join(REPO, 'dist', 'claude', 'skills', 'setup-project', 'scripts', 'setup-project.mjs');

const setup = (cwd, ...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8' });
const read = (dir, file) => fs.readFileSync(path.join(dir, file), 'utf8');

test('Claude project: team settings, rules import, shared memory, no orchestrator default', () => {
  const project = tempDir();
  fs.writeFileSync(path.join(project, 'CLAUDE.md'), '# Notes');
  const result = setup(project, '--tool', 'claude', '--ignore-memory', 'no', '--orchestrator-default', 'no');
  assert.equal(result.status, 0, result.stderr);
  const settings = JSON.parse(read(project, '.claude/settings.json'));
  assert.equal(settings.enabledPlugins['senior-ai@feres'], true);
  assert.equal(settings.extraKnownMarketplaces.feres.source.repo, 'fereshenteti/senior-ai');
  assert.match(read(project, 'CLAUDE.md'), /^# Notes\n\n@AGENTS\.md$/m);
  assert.match(read(project, '.senior-ai/status.md'), /^# Status\n\nUpdated: \d{4}-\d{2}-\d{2}/);
  assert.match(read(project, 'AGENTS.md'), /## Departments/);
  assert.doesNotMatch(read(project, '.gitignore'), /\.senior-ai/);
  assert.equal(fs.existsSync(path.join(project, '.claude', 'settings.local.json')), false);
});

test('memory kept on this machine and orchestrator as personal default', () => {
  const project = tempDir();
  assert.equal(setup(project, '--tool', 'claude', '--ignore-memory', 'yes', '--orchestrator-default', 'yes').status, 0);
  assert.match(read(project, '.gitignore'), /^\.senior-ai\/$/m);
  assert.match(read(project, '.gitignore'), /^\.claude\/settings\.local\.json$/m);
  assert.equal(JSON.parse(read(project, '.claude/settings.local.json')).agent, 'senior-ai:orchestrator');

  // Switching it off again keeps the user's other local settings.
  const local = path.join(project, '.claude', 'settings.local.json');
  fs.writeFileSync(local, JSON.stringify({ agent: 'senior-ai:orchestrator', permissions: { allow: ['Bash(npm test)'] } }));
  assert.equal(setup(project, '--tool', 'claude', '--orchestrator-default', 'no').status, 0);
  assert.deepEqual(JSON.parse(read(project, '.claude/settings.local.json')), { permissions: { allow: ['Bash(npm test)'] } });
});

test('Vibe project: no Claude files', () => {
  const project = tempDir();
  const result = setup(project, '--tool', 'vibe');
  assert.equal(result.status, 0, result.stderr);
  assert.ok(fs.existsSync(path.join(project, 'AGENTS.md')));
  assert.ok(fs.existsSync(path.join(project, '.senior-ai', 'status.md')));
  assert.equal(fs.existsSync(path.join(project, '.claude')), false);
  assert.equal(fs.existsSync(path.join(project, 'CLAUDE.md')), false);
  assert.match(result.stdout, /Shift\+Tab/);
});

test('re-running changes nothing and never overwrites', () => {
  const project = tempDir();
  assert.equal(setup(project, '--tool', 'both').status, 0);
  fs.writeFileSync(path.join(project, 'AGENTS.md'), '# Mine');
  fs.writeFileSync(path.join(project, '.senior-ai', 'status.md'), '# My board');
  const again = setup(project, '--tool', 'both');
  assert.match(again.stdout, /nothing changed/);
  assert.equal(read(project, 'AGENTS.md'), '# Mine');
  assert.equal(read(project, '.senior-ai/status.md'), '# My board');
});

test('invalid options are refused with the usage', () => {
  const project = tempDir();
  const result = setup(project, '--tool', 'cursor');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage:/);
});
