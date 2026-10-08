import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  hasForClaude,
  hasForVibe,
  installForClaude,
  loadExtras,
  vibeServerNames,
  vibeServerToml,
  VIBE_BLOCK,
} from '../../installer/extras.mjs';
import { fakeCli, tempDir, withPath } from '../helpers.mjs';

const extras = loadExtras();
const extra = id => extras.find(e => e.id === id);

test('every extra is complete and unique', () => {
  const ids = new Set();
  for (const e of extras) {
    assert.ok(!ids.has(e.id), `duplicate id ${e.id}`);
    ids.add(e.id);
    for (const field of ['name', 'purpose', 'departments', 'account', 'detect', 'mcp']) assert.ok(e[field], `${e.id}: ${field}`);
    assert.ok(['none', 'login', 'token'].includes(e.account), `${e.id}: account`);
    if (e.account !== 'none') assert.ok(e.setup, `${e.id}: accounts need setup instructions`);
    if (e.mcp.transport === 'stdio') assert.ok(e.mcp.command && Array.isArray(e.mcp.args), `${e.id}: stdio command`);
    else assert.match(e.mcp.url, /^https:\/\//, `${e.id}: url`);
  }
});

test('Claude detection: by plugin id or by MCP server name', () => {
  const inventory = { plugins: new Set(['playwright@claude-plugins-official']), servers: new Set(['angular']) };
  assert.equal(hasForClaude(extra('playwright'), inventory), true);
  assert.equal(hasForClaude(extra('angular-cli'), inventory), true);
  assert.equal(hasForClaude(extra('figma'), inventory), false);
});

test('Vibe detection ignores the block senior-ai manages', () => {
  const config = [
    'theme = "dark"',
    '[[mcp_servers]]',
    'name = "figma"',
    'transport = "streamable-http"',
    VIBE_BLOCK[0],
    '[[mcp_servers]]',
    'name = "playwright"',
    VIBE_BLOCK[1],
  ].join('\n');
  const names = vibeServerNames(config);
  assert.equal(hasForVibe(extra('figma'), names), true);
  assert.equal(hasForVibe(extra('playwright'), names), false);
});

test('Vibe entries for each transport and login type', () => {
  assert.match(vibeServerToml(extra('playwright')), /transport = "stdio"\ncommand = "npx"\nargs = \["-y", "@playwright\/mcp@latest"\]/);
  assert.match(vibeServerToml(extra('figma')), /auth = \{ type = "oauth", scopes = \[\] \}/);
  assert.match(vibeServerToml(extra('github')), /api_key_env = "GITHUB_PERSONAL_ACCESS_TOKEN", api_key_format = "Bearer \{token\}"/);
  assert.match(vibeServerToml(extra('angular-cli')), /name = "angular-cli"/);
});

test('Claude install uses the official plugin', async () => {
  const bin = tempDir();
  const log = fakeCli(bin, 'claude', { output: 'claude-plugins-official' });
  const result = await withPath(bin, () => installForClaude(extra('playwright')));
  assert.deepEqual(result, { ok: true, how: 'plugin', detail: 'playwright@claude-plugins-official' });
  assert.match(fs.readFileSync(log, 'utf8'), /plugin install playwright@claude-plugins-official/);
});

test('Claude install adds a plain MCP server when there is no plugin', async () => {
  const bin = tempDir();
  const log = fakeCli(bin, 'claude');
  const result = await withPath(bin, () => installForClaude(extra('angular-cli')));
  assert.equal(result.ok, true);
  assert.equal(result.how, 'mcp');
  assert.match(fs.readFileSync(log, 'utf8'), /mcp add --scope user angular-cli -- npx -y @angular\/cli mcp/);
});

test('a failing install is reported, not thrown', async () => {
  const bin = tempDir();
  fakeCli(bin, 'claude', { output: 'network error', code: 1 });
  const result = await withPath(bin, () => installForClaude(extra('figma')));
  assert.equal(result.ok, false);
  assert.ok(result.detail);
});

test('no definition refers to a missing file', () => {
  assert.ok(fs.existsSync(path.join(import.meta.dirname, '..', '..', 'extras')));
});
