import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { detectTools, findOnPath } from '../../installer/tools.mjs';
import { fakeCli, tempDir, withPath } from '../helpers.mjs';

const byId = tools => Object.fromEntries(tools.map(tool => [tool.id, tool]));

// Runs fn with controlled tool folders: Vibe's (VIBE_HOME) and Claude's (CLAUDE_CONFIG_DIR).
async function withFolders({ vibe = false, claude = false } = {}, fn) {
  const root = tempDir();
  const saved = { VIBE_HOME: process.env.VIBE_HOME, CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR, SENIOR_AI_VIBE_DIR: process.env.SENIOR_AI_VIBE_DIR };
  delete process.env.SENIOR_AI_VIBE_DIR;
  process.env.VIBE_HOME = path.join(root, '.vibe');
  process.env.CLAUDE_CONFIG_DIR = path.join(root, '.claude');
  if (vibe) fs.mkdirSync(process.env.VIBE_HOME);
  if (claude) fs.mkdirSync(process.env.CLAUDE_CONFIG_DIR);
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('finds no tools on an empty machine', async () => {
  const tools = byId(await withFolders({}, () => withPath(tempDir(), () => detectTools())));
  assert.equal(tools.claude.installed, false);
  assert.equal(tools.vibe.installed, false);
  assert.match(tools.vibe.note, /isn't on this terminal's PATH/);
});

test('finds an installed tool and reads its version', async () => {
  const bin = tempDir();
  fakeCli(bin, 'claude', { output: '2.1.293 (Claude Code)' });
  const tools = byId(await withFolders({}, () => withPath(bin, () => detectTools())));
  assert.equal(tools.claude.installed, true);
  assert.equal(tools.claude.version, '2.1.293');
  assert.equal(tools.claude.note, '');
  assert.equal(tools.vibe.installed, false);
});

test('Vibe counts as installed from its folder when the command is not on PATH', async () => {
  const tools = byId(await withFolders({ vibe: true }, () => withPath(tempDir(), () => detectTools())));
  assert.equal(tools.vibe.installed, true);
  assert.equal(tools.vibe.version, '');
  assert.match(tools.vibe.note, /found its folder/);
  assert.match(tools.vibe.note, /isn't on this terminal's PATH/);
});

test('Vibe counts as installed from its folder when its command fails', async () => {
  const bin = tempDir();
  fakeCli(bin, 'vibe', { output: 'broken', code: 1 });
  const tools = byId(await withFolders({ vibe: true }, () => withPath(bin, () => detectTools())));
  assert.equal(tools.vibe.installed, true);
  assert.match(tools.vibe.note, /failed \(exit code 1\)/);
});

test('without its folder, a failing Vibe command means not installed', async () => {
  const bin = tempDir();
  fakeCli(bin, 'vibe', { output: 'broken', code: 1 });
  const tools = byId(await withFolders({}, () => withPath(bin, () => detectTools())));
  assert.equal(tools.vibe.installed, false);
});

test('Claude Code needs its command: a folder alone is not enough', async () => {
  const tools = byId(await withFolders({ claude: true }, () => withPath(tempDir(), () => detectTools())));
  assert.equal(tools.claude.installed, false);
});

test('honors VIBE_HOME for the Vibe folder', async () => {
  await withFolders({}, async () => {
    const tools = byId(await withPath(tempDir(), () => detectTools()));
    assert.equal(tools.vibe.configDir, process.env.VIBE_HOME);
  });
});

test('findOnPath locates a command without running it', async () => {
  const bin = tempDir();
  fakeCli(bin, 'vibe');
  await withPath(bin, () => {
    assert.ok(findOnPath('vibe'));
    assert.equal(findOnPath('definitely-not-a-command'), null);
  });
});
