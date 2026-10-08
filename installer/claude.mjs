// Claude Code: senior-ai is the senior-ai@feres plugin; extras are official plugins or MCP servers.

import os from 'node:os';
import path from 'node:path';
import { claudeInventory, hasForClaude, installForClaude, uninstallForClaude } from './extras.mjs';
import { runCommand } from './run.mjs';
import { pretty, say } from './ui.mjs';

export function claudeExtrasStatus(extras, installedBySeniorAi) {
  const configDir = process.env.CLAUDE_CONFIG_DIR;
  const inventory = claudeInventory({
    claudeJsonPath: configDir ? path.join(configDir, '.claude.json') : path.join(os.homedir(), '.claude.json'),
  });
  const ours = new Set(installedBySeniorAi.map(entry => entry.backup));
  return extras.map(extra => ({
    extra,
    present: hasForClaude(extra, inventory),
    bySeniorAi: ours.has(extra.claude?.plugin) || ours.has(extra.mcp.name ?? extra.id),
  }));
}

function plugin(args, { dryRun, quiet = false }) {
  if (dryRun) {
    say(`  [dry-run] claude plugin ${args.join(' ')}`);
    return true;
  }
  return runCommand('claude', ['plugin', ...args], { inherit: !quiet, timeout: 300_000 }).ok;
}

// Installs the senior-ai plugin. source: the GitHub repo, or this folder with --link.
// Returns { ok, detail }.
export function installClaude({ ops, meta, source, dryRun }) {
  const marketplace = meta.marketplace.name;
  const pluginId = `${meta.name}@${marketplace}`;
  say(`Claude Code: plugin ${pluginId} from ${pretty(source)}`);
  // Re-register the marketplace so a switch between GitHub and a local folder takes effect.
  plugin(['marketplace', 'remove', marketplace], { dryRun, quiet: true });
  if (!plugin(['marketplace', 'add', source], { dryRun })) return { ok: false, detail: `adding the ${marketplace} marketplace failed` };
  if (!plugin(['install', pluginId], { dryRun })) return { ok: false, detail: `installing ${pluginId} failed` };
  ops.record(`plugin:${pluginId}`, '');
  return { ok: true, detail: pluginId };
}

export function installClaudeExtra({ ops, extra, dryRun }) {
  if (dryRun) {
    say(`  [dry-run] install ${extra.name} for Claude Code`);
    return { ok: true, how: 'dry-run', detail: extra.id };
  }
  const result = installForClaude(extra);
  if (result.ok) ops.record(`extra:${result.how}`, result.detail);
  return result;
}

// Removes a manifest entry that is not a file: the senior-ai plugin or an extra.
export function claudeUninstallEntry(meta) {
  return (kind, target, value) => {
    if (kind === 'plugin') {
      runCommand('claude', ['plugin', 'uninstall', target], { timeout: 120_000 });
      runCommand('claude', ['plugin', 'marketplace', 'remove', meta.marketplace.name], { timeout: 120_000 });
    } else if (kind === 'extra') {
      uninstallForClaude(target, value);
    }
  };
}
