import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { detectTools } from '../../installer/tools.mjs';
import { fakeCli, tempDir, withPath } from '../helpers.mjs';

const byId = tools => Object.fromEntries(tools.map(tool => [tool.id, tool]));

test('finds no tools on an empty machine', async () => {
  const bin = tempDir();
  const tools = byId(await withPath(bin, () => detectTools()));
  assert.equal(tools.claude.installed, false);
  assert.equal(tools.vibe.installed, false);
});

test('finds an installed tool and reads its version', async () => {
  const bin = tempDir();
  fakeCli(bin, 'claude', { output: '2.1.293 (Claude Code)' });
  const tools = byId(await withPath(bin, () => detectTools()));
  assert.equal(tools.claude.installed, true);
  assert.equal(tools.claude.version, '2.1.293');
  assert.equal(tools.vibe.installed, false);
});

test('a tool whose --version fails counts as not installed', async () => {
  const bin = tempDir();
  fakeCli(bin, 'vibe', { output: 'broken', code: 1 });
  const tools = byId(await withPath(bin, () => detectTools()));
  assert.equal(tools.vibe.installed, false);
});

test('honors VIBE_HOME for the Vibe folder', async () => {
  const saved = process.env.VIBE_HOME;
  process.env.VIBE_HOME = path.join(tempDir(), 'custom-vibe');
  try {
    const tools = byId(await withPath(tempDir(), () => detectTools()));
    assert.equal(tools.vibe.configDir, process.env.VIBE_HOME);
  } finally {
    if (saved === undefined) delete process.env.VIBE_HOME;
    else process.env.VIBE_HOME = saved;
  }
});
