// End-to-end: runs install.mjs as a separate process in a fake home, with fake `claude` and
// `vibe` CLIs that log their calls.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { fakeCli, IS_WINDOWS, tempDir } from '../helpers.mjs';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const VERSION = JSON.parse(fs.readFileSync(path.join(REPO, 'senior-ai.json'), 'utf8')).version;

function machine({ claude = true, vibe = true } = {}) {
  const home = tempDir();
  const bin = path.join(home, 'bin');
  fs.mkdirSync(bin);
  const logs = {};
  if (claude) logs.claude = fakeCli(bin, 'claude', { output: '2.1.300 (Claude Code) claude-plugins-official' });
  if (vibe) logs.vibe = fakeCli(bin, 'vibe', { output: 'vibe 2.25.5' });
  const env = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    PATH: [bin, path.dirname(process.execPath), IS_WINDOWS ? `${process.env.SystemRoot}\\System32` : '/usr/bin:/bin'].join(path.delimiter),
    SENIOR_AI_STATE_DIR: path.join(home, '.senior-ai'),
    VIBE_HOME: path.join(home, '.vibe'),
  };
  delete env.CLAUDE_CONFIG_DIR;
  delete env.SENIOR_AI_VIBE_DIR;
  const install = (...args) => spawnSync(process.execPath, [path.join(REPO, 'install.mjs'), ...args], { env, encoding: 'utf8' });
  return { home, vibeDir: env.VIBE_HOME, logs, install };
}

const read = file => fs.readFileSync(file, 'utf8');
const count = (text, needle) => text.split(needle).length - 1;

test('with no AI tool, explains how to install one and changes nothing', () => {
  const m = machine({ claude: false, vibe: false });
  const result = m.install('--yes');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /No supported AI tool found/);
  assert.match(result.stdout, /claude\.ai\/install/);
  assert.equal(fs.existsSync(m.vibeDir), false);
});

test('installs everything for both tools with --yes', () => {
  const m = machine();
  const result = m.install('--yes');
  assert.equal(result.status, 0, result.stderr + result.stdout);

  // Vibe: senior-ai files, update hook, MCP block
  for (const file of ['AGENTS.md', 'agents/ui-builder.toml', 'prompts/ui-builder.md', 'skills/angular/SKILL.md', 'senior-ai/check-update.mjs']) {
    assert.ok(fs.existsSync(path.join(m.vibeDir, file)), file);
  }
  assert.equal(read(path.join(m.vibeDir, 'senior-ai', 'VERSION')).trim(), VERSION);
  assert.match(read(path.join(m.vibeDir, 'hooks.toml')), /senior-ai-update-check/);
  const config = read(path.join(m.vibeDir, 'config.toml'));
  assert.equal(count(config, '[[mcp_servers]]'), 7);

  // Claude: the senior-ai plugin from GitHub, then the extras
  const calls = read(m.logs.claude);
  assert.match(calls, /plugin marketplace add fereshenteti\/senior-ai/);
  assert.match(calls, /plugin install senior-ai@feres/);
  assert.match(calls, /plugin install playwright@claude-plugins-official/);
  assert.match(calls, /mcp add --scope user angular-cli/);
  assert.match(result.stdout, /Summary/);
});

test('re-installing keeps the extras and does not duplicate anything', () => {
  const m = machine();
  assert.equal(m.install('--yes').status, 0);
  const second = m.install('--yes', '--tool', 'vibe');
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /installed by senior-ai/);
  const config = read(path.join(m.vibeDir, 'config.toml'));
  assert.equal(count(config, '[[mcp_servers]]'), 7);
  assert.equal(count(read(path.join(m.vibeDir, 'hooks.toml')), 'senior-ai-update-check'), 1);
});

test("keeps the user's own files and MCP servers", () => {
  const m = machine({ claude: false });
  fs.mkdirSync(m.vibeDir, { recursive: true });
  fs.writeFileSync(path.join(m.vibeDir, 'AGENTS.md'), '# my rules\n');
  fs.writeFileSync(path.join(m.vibeDir, 'config.toml'), 'theme = "dark"\n\n[[mcp_servers]]\nname = "figma"\ntransport = "stdio"\ncommand = "x"\n');
  assert.equal(m.install('--yes').status, 0);
  const config = read(path.join(m.vibeDir, 'config.toml'));
  assert.equal(count(config, 'name = "figma"'), 1, 'figma not added twice');
  assert.match(read(path.join(m.vibeDir, 'AGENTS.md')), /^# my rules/);

  assert.equal(m.install('--uninstall', '--yes').status, 0);
  assert.equal(read(path.join(m.vibeDir, 'AGENTS.md')), '# my rules\n');
  assert.match(read(path.join(m.vibeDir, 'config.toml')), /theme = "dark"/);
});

test('without a terminal and without --yes, extras are not installed', () => {
  const m = machine({ claude: false });
  const result = m.install('--tool', 'vibe');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Re-run with --yes/);
  assert.equal(fs.existsSync(path.join(m.vibeDir, 'config.toml')), false);
  assert.ok(fs.existsSync(path.join(m.vibeDir, 'AGENTS.md')));
});

test('asking for a tool that is missing explains how to install it', () => {
  const m = machine({ vibe: false });
  const result = m.install('--tool', 'vibe', '--yes');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Mistral Vibe not found/);
  assert.match(result.stdout, /mistral\.ai\/vibe\/install|uv tool install/);
});

test('uninstall removes senior-ai, keeps extras unless asked', () => {
  const m = machine();
  assert.equal(m.install('--yes').status, 0);
  const result = m.install('--uninstall', '--yes');
  assert.equal(result.status, 0, result.stderr);
  for (const file of ['agents/ui-builder.toml', 'skills', 'senior-ai']) assert.equal(fs.existsSync(path.join(m.vibeDir, file)), false, file);
  const hooks = path.join(m.vibeDir, 'hooks.toml');
  assert.ok(!fs.existsSync(hooks) || !read(hooks).includes('senior-ai'), 'hook removed (file deleted, as senior-ai created it)');
  assert.equal(count(read(path.join(m.vibeDir, 'config.toml')), '[[mcp_servers]]'), 7, 'extras kept');
  assert.match(read(m.logs.claude), /plugin uninstall senior-ai@feres/);
});
