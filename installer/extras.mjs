// Optional extras: MCP servers and companion plugins that make the agents more capable.
// None is required. Each is detected, offered, and installed only with consent; a decline or
// a failed install is reported and never stops the installation.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCommand } from './run.mjs';

const EXTRAS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'extras');
const OFFICIAL_MARKETPLACE = 'claude-plugins-official';
const OFFICIAL_MARKETPLACE_REPO = 'anthropics/claude-plugins-official';

export function loadExtras() {
  return fs
    .readdirSync(EXTRAS_DIR)
    .filter(name => name.endsWith('.json'))
    .sort()
    .map(name => JSON.parse(fs.readFileSync(path.join(EXTRAS_DIR, name), 'utf8')));
}

const mcpName = extra => extra.mcp.name ?? extra.id;

// --- Claude Code --------------------------------------------------------------------------

// Everything Claude already provides: plugin ids and MCP server names (from plugins and user scope).
export function claudeInventory({ claudeJsonPath } = {}) {
  const plugins = new Set();
  const servers = new Set();
  const listed = runCommand('claude', ['plugin', 'list', '--json'], { timeout: 60_000 });
  if (listed.ok) {
    try {
      for (const plugin of JSON.parse(listed.stdout)) {
        if (plugin.enabled === false) continue;
        plugins.add(plugin.id);
        for (const name of Object.keys(plugin.mcpServers ?? {})) servers.add(name);
      }
    } catch {}
  }
  try {
    const config = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
    for (const name of Object.keys(config.mcpServers ?? {})) servers.add(name);
  } catch {}
  return { plugins, servers };
}

export function hasForClaude(extra, inventory) {
  if (extra.claude?.plugin && inventory.plugins.has(extra.claude.plugin)) return true;
  return extra.detect.some(name => inventory.servers.has(name));
}

function ensureOfficialMarketplace() {
  const listed = runCommand('claude', ['plugin', 'marketplace', 'list'], { timeout: 60_000 });
  if (listed.ok && listed.stdout.includes(OFFICIAL_MARKETPLACE)) return true;
  return runCommand('claude', ['plugin', 'marketplace', 'add', OFFICIAL_MARKETPLACE_REPO], { timeout: 180_000 }).ok;
}

// Installs one extra for Claude: the official plugin when there is one, the MCP server otherwise.
// Returns { ok, how, detail } and never throws.
export function installForClaude(extra) {
  if (extra.claude?.plugin) {
    if (!ensureOfficialMarketplace()) return { ok: false, how: 'plugin', detail: `could not add the ${OFFICIAL_MARKETPLACE} marketplace` };
    const result = runCommand('claude', ['plugin', 'install', extra.claude.plugin], { timeout: 180_000 });
    if (result.ok) return { ok: true, how: 'plugin', detail: extra.claude.plugin };
    if (!extra.mcp) return { ok: false, how: 'plugin', detail: lastLine(result) };
  }
  const args = ['mcp', 'add', '--scope', 'user'];
  const { mcp } = extra;
  if (mcp.transport === 'stdio') args.push(mcpName(extra), '--', mcp.command, ...mcp.args);
  else {
    args.push('--transport', 'http', mcpName(extra), mcp.url);
    if (mcp.tokenEnv) args.push('--header', `Authorization: ${mcp.tokenFormat.replace('{token}', `\${${mcp.tokenEnv}}`)}`);
  }
  const result = runCommand('claude', args, { timeout: 60_000 });
  return result.ok ? { ok: true, how: 'mcp', detail: mcpName(extra) } : { ok: false, how: 'mcp', detail: lastLine(result) };
}

export function uninstallForClaude(how, detail) {
  if (how === 'plugin') return runCommand('claude', ['plugin', 'uninstall', detail], { timeout: 60_000 }).ok;
  return runCommand('claude', ['mcp', 'remove', '--scope', 'user', detail], { timeout: 60_000 }).ok;
}

const lastLine = result => (result.stderr || result.stdout).trim().split(/\r?\n/).pop() || `exit code ${result.status}`;

// --- Mistral Vibe -------------------------------------------------------------------------

export const VIBE_BLOCK = ['# senior-ai mcp:start', '# senior-ai mcp:end'];

// MCP server names in config.toml, ignoring the block senior-ai manages itself.
export function vibeServerNames(configText) {
  const names = new Set();
  let inOurs = false;
  let inServer = false;
  for (const line of configText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === VIBE_BLOCK[0]) inOurs = true;
    else if (trimmed === VIBE_BLOCK[1]) inOurs = false;
    else if (trimmed.startsWith('[')) inServer = trimmed === '[[mcp_servers]]';
    else if (inServer && !inOurs) {
      const match = /^name\s*=\s*["']([^"']+)["']/.exec(trimmed);
      if (match) names.add(match[1]);
    }
  }
  return names;
}

export const hasForVibe = (extra, names) => extra.detect.some(name => names.has(name));

const tomlString = value => JSON.stringify(value);

// The [[mcp_servers]] entry for one extra in Vibe's config.toml.
export function vibeServerToml(extra) {
  const { mcp } = extra;
  const lines = ['[[mcp_servers]]', `name = ${tomlString(mcpName(extra))}`, `transport = ${tomlString(mcp.transport)}`];
  if (mcp.transport === 'stdio') {
    lines.push(`command = ${tomlString(mcp.command)}`, `args = [${mcp.args.map(tomlString).join(', ')}]`);
  } else {
    lines.push(`url = ${tomlString(mcp.url)}`);
    if (mcp.oauth) lines.push('auth = { type = "oauth", scopes = [] }'); // empty: the server's default permissions
    if (mcp.tokenEnv) {
      lines.push(`auth = { type = "static", api_key_env = ${tomlString(mcp.tokenEnv)}, api_key_format = ${tomlString(mcp.tokenFormat)} }`);
    }
  }
  return lines.join('\n');
}
