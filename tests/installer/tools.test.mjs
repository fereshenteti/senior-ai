import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { detectTools, findEditorExtension } from '../../installer/tools.mjs';
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

// Runs fn with a fake home folder (HOME, and USERPROFILE on Windows).
async function withHome(setup, fn) {
  const home = tempDir();
  setup(home);
  const saved = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  try {
    return await fn(home);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
const extension = (home, editor, folder) => fs.mkdirSync(path.join(home, editor, 'extensions', folder), { recursive: true });

test('finds Vibe through its VS Code extension when there is no vibe command', async () => {
  const tools = byId(
    await withHome(home => extension(home, '.vscode', 'mistralai.mistral-vibe-code-1.23.102-win32-x64'), () => withPath(tempDir(), () => detectTools())),
  );
  assert.equal(tools.vibe.installed, true);
  assert.equal(tools.vibe.version, '1.23.102');
  assert.equal(tools.vibe.via, 'VS Code extension');
});

test('picks the newest copy across editors and ignores other Mistral extensions', async () => {
  await withHome(
    home => {
      extension(home, '.vscode', 'mistralai.mistral-vibe-code-1.9.0');
      extension(home, '.cursor', 'mistralai.mistral-vibe-code-1.23.102-darwin-arm64');
      extension(home, '.vscode', 'mistralai.mistral-code-9.9.9');
    },
    () => assert.deepEqual(findEditorExtension('mistralai.mistral-vibe-code'), { editor: 'Cursor', version: '1.23.102' }),
  );
  await withHome(home => extension(home, '.vscode', 'mistralai.mistral-code-9.9.9'), () => {
    assert.equal(findEditorExtension('mistralai.mistral-vibe-code'), null);
  });
});

test('the vibe command takes precedence over the extension', async () => {
  const bin = tempDir();
  fakeCli(bin, 'vibe', { output: 'vibe 2.25.5' });
  const tools = byId(await withHome(home => extension(home, '.vscode', 'mistralai.mistral-vibe-code-1.23.102'), () => withPath(bin, () => detectTools())));
  assert.equal(tools.vibe.via, 'command');
  assert.equal(tools.vibe.version, '2.25.5');
});

test('Claude Code is never found through an editor extension', async () => {
  const tools = byId(await withHome(home => extension(home, '.vscode', 'anthropic.claude-code-2.1.0'), () => withPath(tempDir(), () => detectTools())));
  assert.equal(tools.claude.installed, false);
});
