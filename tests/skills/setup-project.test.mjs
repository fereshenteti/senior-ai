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

// The installed copy has no sources of its own; tests point it at this repository.
const setup = (cwd, ...args) => spawnSync(process.execPath, [SCRIPT, ...args, '--from', REPO], { cwd, encoding: 'utf8' });
const read = (dir, file) => fs.readFileSync(path.join(dir, file), 'utf8');

test('Claude project: the system copy, its agents, skills and hooks, rules import, shared memory', () => {
  const project = tempDir();
  fs.writeFileSync(path.join(project, 'CLAUDE.md'), '# Notes');
  const result = setup(project, '--tool', 'claude', '--ignore-memory', 'no', '--orchestrator-default', 'no');
  assert.equal(result.status, 0, result.stderr);
  assert.ok(fs.existsSync(path.join(project, '.senior-ai/system/departments/core/agents/orchestrator.md')));
  assert.match(read(project, '.claude/agents/orchestrator.md'), /^name: orchestrator$/m);
  assert.ok(fs.existsSync(path.join(project, '.claude/skills/orchestrate/SKILL.md')));
  const settings = JSON.parse(read(project, '.claude/settings.json'));
  assert.equal(settings.enabledPlugins['senior-ai@feres'], false);
  assert.deepEqual(settings.hooks.PreToolUse[0].hooks[0].args, ['${CLAUDE_PROJECT_DIR}/.senior-ai/system/hooks/guard.mjs', '--tool', 'claude', '--project']);
  assert.match(read(project, 'AGENTS.md'), /<!-- senior-ai:rules:start -->[\s\S]*# Team engineering rules/);
  assert.equal(fs.existsSync(path.join(project, '.vibe')), false);
  assert.match(read(project, 'CLAUDE.md'), /^# Notes\n\n@AGENTS\.md$/m);
  assert.match(read(project, '.senior-ai/status.md'), /^# Status\n\nUpdated: \d{4}-\d{2}-\d{2}/);
  assert.match(read(project, 'AGENTS.md'), /## Departments/);
  assert.doesNotMatch(read(project, '.gitignore'), /\.senior-ai/);
  assert.equal(fs.existsSync(path.join(project, '.claude', 'settings.local.json')), false);
});

test('memory kept on this machine and orchestrator as personal default', () => {
  const project = tempDir();
  assert.equal(setup(project, '--tool', 'claude', '--ignore-memory', 'yes', '--orchestrator-default', 'yes').status, 0);
  assert.match(read(project, '.gitignore'), /^\.senior-ai\/\*\n!\.senior-ai\/system\/$/m);
  assert.match(read(project, '.gitignore'), /^\.claude\/settings\.local\.json$/m);
  assert.equal(JSON.parse(read(project, '.claude/settings.local.json')).agent, 'orchestrator');

  // Switching it off again keeps the user's other local settings.
  const local = path.join(project, '.claude', 'settings.local.json');
  fs.writeFileSync(local, JSON.stringify({ agent: 'senior-ai:orchestrator', permissions: { allow: ['Bash(npm test)'] } }));
  assert.equal(setup(project, '--tool', 'claude', '--orchestrator-default', 'no').status, 0);
  assert.deepEqual(JSON.parse(read(project, '.claude/settings.local.json')), { permissions: { allow: ['Bash(npm test)'] } });
});

test('Vibe project: profiles, prompts, skills and hooks from the copy, no Claude files', () => {
  const project = tempDir();
  const result = setup(project, '--tool', 'vibe');
  assert.equal(result.status, 0, result.stderr);
  assert.match(read(project, '.vibe/agents/frontend-security.toml'), /^description = /m);
  assert.ok(fs.existsSync(path.join(project, '.vibe/prompts/orchestrator.md')));
  assert.ok(fs.existsSync(path.join(project, '.vibe/skills/orchestrate/SKILL.md')));
  assert.match(read(project, '.vibe/hooks.toml'), /command = "node \\".senior-ai\/system\/hooks\/guard.mjs\\" --tool vibe --project"/);
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
  assert.equal(setup(project, '--tool', 'both').status, 0);
  assert.match(read(project, 'AGENTS.md'), /^# Mine\n\n<!-- senior-ai:rules:start -->/);
  assert.equal(read(project, '.senior-ai/status.md'), '# My board');
  assert.match(setup(project, '--tool', 'both').stdout, /nothing changed/);
});

test('invalid options are refused with the usage', () => {
  const project = tempDir();
  const result = setup(project, '--tool', 'cursor');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage:/);
});

test('an old whole-folder ignore becomes content-only, so the copy is committed', () => {
  const project = tempDir();
  fs.writeFileSync(path.join(project, '.gitignore'), 'node_modules/\n.senior-ai/\n');
  assert.equal(setup(project, '--tool', 'claude').status, 0);
  assert.equal(read(project, '.gitignore'), 'node_modules/\n.senior-ai/*\n.visual-check/\n!.senior-ai/system/\n');
});

test("the team's edits drive the generated files, and re-running setup keeps them", () => {
  const project = tempDir();
  assert.equal(setup(project, '--tool', 'both').status, 0);
  const agent = path.join(project, '.senior-ai/system/departments/frontend/agents/frontend-dev.md');
  fs.writeFileSync(agent, fs.readFileSync(agent, 'utf8') + '\nTeam rule: always use signals.\n');
  const sync = path.join(project, '.senior-ai/system/build/project.mjs');
  const check = spawnSync(process.execPath, [sync, '--check'], { cwd: project, encoding: 'utf8' });
  assert.equal(check.status, 1);
  assert.match(check.stderr, /\.claude\/agents\/frontend-dev\.md/);
  assert.equal(spawnSync(process.execPath, [sync], { cwd: project }).status, 0);
  assert.match(read(project, '.claude/agents/frontend-dev.md'), /always use signals/);
  assert.match(read(project, '.vibe/prompts/frontend-dev.md'), /always use signals/);
  assert.equal(setup(project, '--tool', 'both').status, 0);
  assert.match(read(project, '.senior-ai/system/departments/frontend/agents/frontend-dev.md'), /always use signals/);
});

test('an update takes upstream changes, keeps team edits and flags files both changed', () => {
  const upstream = tempDir();
  for (const item of ['AGENTS.md', 'senior-ai.json', 'departments', 'hooks', 'build']) {
    fs.cpSync(path.join(REPO, item), path.join(upstream, item), { recursive: true });
  }
  const project = tempDir();
  assert.equal(setup(project, '--tool', 'claude').status, 0);
  const system = path.join(project, '.senior-ai/system');
  const rel = {
    upstreamOnly: 'departments/core/agents/architect.md',
    teamOnly: 'departments/core/agents/qa-engineer.md',
    both: 'departments/core/agents/orchestrator.md',
  };
  fs.appendFileSync(path.join(upstream, rel.upstreamOnly), '\nUpstream change.\n');
  fs.appendFileSync(path.join(upstream, rel.both), '\nUpstream change.\n');
  fs.appendFileSync(path.join(system, rel.teamOnly), '\nTeam change.\n');
  fs.appendFileSync(path.join(system, rel.both), '\nTeam change.\n');
  const result = spawnSync(process.execPath, [path.join(system, 'build/project.mjs'), '--update', upstream], { cwd: project, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(path.join(system, rel.upstreamOnly), 'utf8'), /Upstream change/);
  assert.match(fs.readFileSync(path.join(system, rel.teamOnly), 'utf8'), /Team change/);
  assert.match(fs.readFileSync(path.join(system, rel.both), 'utf8'), /Team change/);
  assert.match(fs.readFileSync(path.join(system, `${rel.both}.senior-ai-new`), 'utf8'), /Upstream change/);
  assert.match(result.stdout, /orchestrator\.md\.senior-ai-new/);
  assert.match(read(project, '.claude/agents/architect.md'), /Upstream change/);
});
