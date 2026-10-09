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

test('Claude project: agents, skills and hooks in .claude/, rules import, shared memory', () => {
  const project = tempDir();
  fs.writeFileSync(path.join(project, 'CLAUDE.md'), '# Notes');
  const result = setup(project, '--tool', 'claude', '--ignore-memory', 'no', '--orchestrator-default', 'no');
  assert.equal(result.status, 0, result.stderr);
  assert.match(read(project, '.claude/agents/orchestrator.md'), /^name: orchestrator$/m);
  assert.ok(fs.existsSync(path.join(project, '.claude/skills/orchestrate/SKILL.md')));
  assert.ok(fs.existsSync(path.join(project, '.claude/hooks/guard.mjs')));
  assert.equal(JSON.parse(read(project, '.claude/hooks/senior-ai.lock.json')).version, JSON.parse(fs.readFileSync(path.join(REPO, 'senior-ai.json'))).version);
  const settings = JSON.parse(read(project, '.claude/settings.json'));
  assert.equal(settings.enabledPlugins['senior-ai@feres'], false);
  assert.deepEqual(settings.hooks.PreToolUse[0].hooks[0].args, ['${CLAUDE_PROJECT_DIR}/.claude/hooks/guard.mjs', '--tool', 'claude', '--project']);
  assert.match(read(project, 'AGENTS.md'), /<!-- senior-ai:rules:start -->\n# Team engineering rules/);
  assert.match(read(project, 'CLAUDE.md'), /^# Notes\n\n@AGENTS\.md$/m);
  assert.match(read(project, '.senior-ai/status.md'), /^# Status\n\nUpdated: \d{4}-\d{2}-\d{2}/);
  assert.doesNotMatch(read(project, '.gitignore'), /\.senior-ai/);
  for (const absent of ['.vibe', '.senior-ai/system', '.claude/settings.local.json']) assert.equal(fs.existsSync(path.join(project, absent)), false, absent);
});

test('memory kept on this machine and orchestrator as personal default', () => {
  const project = tempDir();
  assert.equal(setup(project, '--tool', 'claude', '--ignore-memory', 'yes', '--orchestrator-default', 'yes').status, 0);
  assert.match(read(project, '.gitignore'), /^\.senior-ai\/$/m);
  assert.match(read(project, '.gitignore'), /^\.claude\/settings\.local\.json$/m);
  assert.equal(JSON.parse(read(project, '.claude/settings.local.json')).agent, 'orchestrator');

  // Switching it off again keeps the user's other local settings.
  const local = path.join(project, '.claude', 'settings.local.json');
  fs.writeFileSync(local, JSON.stringify({ agent: 'orchestrator', permissions: { allow: ['Bash(npm test)'] } }));
  assert.equal(setup(project, '--tool', 'claude', '--orchestrator-default', 'no').status, 0);
  assert.deepEqual(JSON.parse(read(project, '.claude/settings.local.json')), { permissions: { allow: ['Bash(npm test)'] } });
});

test("Vibe project: everything in Vibe's own folders, no Claude files", () => {
  const project = tempDir();
  const result = setup(project, '--tool', 'vibe');
  assert.equal(result.status, 0, result.stderr);
  assert.match(read(project, '.vibe/agents/frontend-security.toml'), /^description = /m);
  assert.ok(fs.existsSync(path.join(project, '.vibe/prompts/orchestrator.md')));
  assert.ok(fs.existsSync(path.join(project, '.vibe/skills/orchestrate/SKILL.md')));
  assert.ok(fs.existsSync(path.join(project, '.vibe/hooks/guard.mjs')));
  assert.match(read(project, '.vibe/hooks.toml'), /command = "node \\".vibe\/hooks\/guard.mjs\\" --tool vibe --project"/);
  for (const absent of ['.claude', 'CLAUDE.md', '.vibe/config.toml', '.senior-ai/system']) assert.equal(fs.existsSync(path.join(project, absent)), false, absent);
  assert.match(result.stdout, /Shift\+Tab/);
});

test('both tools: skills and hook scripts exist once, in .claude/', () => {
  const project = tempDir();
  fs.mkdirSync(path.join(project, '.vibe'));
  fs.writeFileSync(path.join(project, '.vibe', 'config.toml'), '[project_context]\nmax_files = 10\n');
  assert.equal(setup(project, '--tool', 'both').status, 0);
  assert.equal(fs.existsSync(path.join(project, '.vibe/skills')), false);
  assert.equal(fs.existsSync(path.join(project, '.vibe/hooks')), false);
  assert.match(read(project, '.vibe/config.toml'), /^# >>> senior-ai[^\n]*\nskill_paths = \[".claude\/skills"\]\n# <<< senior-ai <<<\n\n\[project_context\]/);
  assert.match(read(project, '.vibe/hooks.toml'), /node \\".claude\/hooks\/guard.mjs\\" --tool vibe --project/);
  assert.ok(fs.existsSync(path.join(project, '.vibe/prompts/orchestrator.md')));
  assert.ok(fs.existsSync(path.join(project, '.claude/agents/orchestrator.md')));
});

test("re-running keeps the team's files, and changes nothing the second time", () => {
  const project = tempDir();
  assert.equal(setup(project, '--tool', 'both').status, 0);
  fs.writeFileSync(path.join(project, 'AGENTS.md'), '# Mine');
  fs.writeFileSync(path.join(project, '.senior-ai', 'status.md'), '# My board');
  fs.appendFileSync(path.join(project, '.claude/agents/frontend-dev.md'), '\nTeam rule: always use signals.\n');
  assert.equal(setup(project, '--tool', 'both').status, 0);
  assert.match(read(project, 'AGENTS.md'), /^# Mine\n\n<!-- senior-ai:rules:start -->/);
  assert.equal(read(project, '.senior-ai/status.md'), '# My board');
  assert.match(read(project, '.claude/agents/frontend-dev.md'), /always use signals/);
  assert.match(setup(project, '--tool', 'both').stdout, /nothing changed/);
});

test('invalid options are refused with the usage', () => {
  const project = tempDir();
  const result = setup(project, '--tool', 'cursor');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage:/);
});

test('--update takes upstream changes, keeps team edits and flags files both changed', () => {
  const upstream = tempDir();
  for (const item of ['AGENTS.md', 'senior-ai.json', 'departments', 'hooks', 'build']) {
    fs.cpSync(path.join(REPO, item), path.join(upstream, item), { recursive: true });
  }
  const project = tempDir();
  assert.equal(spawnSync(process.execPath, [SCRIPT, '--tool', 'claude', '--from', upstream], { cwd: project }).status, 0);
  const agent = name => path.join('departments/core/agents', `${name}.md`);
  fs.appendFileSync(path.join(upstream, agent('architect')), '\nUpstream change.\n');
  fs.appendFileSync(path.join(upstream, agent('orchestrator')), '\nUpstream change.\n');
  fs.appendFileSync(path.join(project, '.claude/agents/qa-engineer.md'), '\nTeam change.\n');
  fs.appendFileSync(path.join(project, '.claude/agents/orchestrator.md'), '\nTeam change.\n');
  const result = spawnSync(process.execPath, [SCRIPT, '--tool', 'claude', '--update', '--from', upstream], { cwd: project, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(read(project, '.claude/agents/architect.md'), /Upstream change/);
  assert.match(read(project, '.claude/agents/qa-engineer.md'), /Team change/);
  assert.match(read(project, '.claude/agents/orchestrator.md'), /Team change/);
  assert.match(read(project, '.claude/agents/orchestrator.md.senior-ai-new'), /Upstream change/);
  assert.match(result.stdout, /orchestrator\.md\.senior-ai-new/);
});

test('a project set up with the earlier .senior-ai/system copy is moved to the tools\' folders', () => {
  const project = tempDir();
  const system = path.join(project, '.senior-ai', 'system');
  fs.mkdirSync(path.join(project, '.vibe', 'skills', 'orchestrate'), { recursive: true });
  fs.writeFileSync(path.join(project, '.vibe', 'skills', 'orchestrate', 'SKILL.md'), 'old');
  fs.mkdirSync(system, { recursive: true });
  fs.writeFileSync(path.join(system, 'senior-ai.json'), '{}');
  fs.writeFileSync(path.join(system, 'generated.json'), JSON.stringify(['.vibe/skills/orchestrate/SKILL.md']));
  fs.writeFileSync(path.join(project, '.gitignore'), 'node_modules/\n.senior-ai/*\n!.senior-ai/system/\n');
  const result = setup(project, '--tool', 'both');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(system), false);
  assert.equal(fs.existsSync(path.join(project, '.vibe', 'skills')), false);
  assert.match(result.stdout, /\.senior-ai\/system\/ removed/);
  assert.equal(read(project, '.gitignore'), 'node_modules/\n.senior-ai/\n.visual-check/\n');
});
