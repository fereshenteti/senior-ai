#!/usr/bin/env node
// senior-ai installer for Claude Code and Mistral Vibe, on macOS, Linux and Windows.
// Started by install.sh (macOS/Linux) or install.cmd (Windows); `node install.mjs` works everywhere.
//
//   1. find the AI tools installed on this machine
//   2. ask which of them to install senior-ai for
//   3. offer the optional extras (MCP servers, companion plugins) each tool is missing
//   4. install senior-ai, then the accepted extras
//   5. print a summary: nothing optional ever stops the installation

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { claudeExtrasStatus, claudeUninstallEntry, installClaude, installClaudeExtra } from './installer/claude.mjs';
import { loadExtras } from './installer/extras.mjs';
import { createFileOps } from './installer/files.mjs';
import { IS_WINDOWS } from './installer/run.mjs';
import { detectTools, installCommand } from './installer/tools.mjs';
import { createPrompter, say } from './installer/ui.mjs';
import { installVibe, installVibeExtras, vibeExtrasStatus } from './installer/vibe.mjs';

const REPO = path.dirname(fileURLToPath(import.meta.url));
const META = JSON.parse(fs.readFileSync(path.join(REPO, 'senior-ai.json'), 'utf8'));
const STATE_DIR = process.env.SENIOR_AI_STATE_DIR || path.join(os.homedir(), '.senior-ai');
const INSTALL_COMMAND = IS_WINDOWS ? '.\\install.cmd' : './install.sh';

const USAGE = `Usage: ${INSTALL_COMMAND} [options]

Installs senior-ai for the AI tools found on this machine (Claude Code, Mistral Vibe).

  --tool <name>   Only this tool: claude, vibe or both. Without it, you are asked.
  --yes           Accept every default: all tools found, all missing extras.
  --no-extras     Don't offer or install optional extras (MCP servers, plugins).
  --link          Use this folder directly instead of a copy (for working on senior-ai).
  --dry-run       Show what would happen without changing anything.
  --uninstall     Remove senior-ai and restore what it replaced.
  -h, --help      Show this help.`;

function parseArgs(argv) {
  const options = { tool: '', yes: false, extras: true, mode: 'copy', dryRun: false, uninstall: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--tool') options.tool = argv[++i] ?? '';
    else if (arg.startsWith('--tool=')) options.tool = arg.slice('--tool='.length);
    else if (arg === '--yes' || arg === '-y') options.yes = true;
    else if (arg === '--no-extras') options.extras = false;
    else if (arg === '--link') options.mode = 'link';
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--uninstall') options.uninstall = true;
    else if (arg === '-h' || arg === '--help') {
      say(USAGE);
      process.exit(0);
    } else {
      console.error(`Unknown option: ${arg}\n\n${USAGE}`);
      process.exit(2);
    }
  }
  if (options.tool && !['claude', 'vibe', 'both'].includes(options.tool)) {
    console.error(`--tool must be claude, vibe or both (got: ${options.tool})`);
    process.exit(2);
  }
  return options;
}

function showInstallHelp(tools) {
  for (const tool of tools) {
    say(`  ${tool.name.padEnd(13)} ${installCommand(tool)}`);
    say(`  ${''.padEnd(13)} ${tool.docs}`);
  }
}

async function chooseTools(detected, options, prompter) {
  const found = detected.filter(tool => tool.installed);
  if (options.tool) {
    const wanted = options.tool === 'both' ? ['claude', 'vibe'] : [options.tool];
    const missing = detected.filter(tool => wanted.includes(tool.id) && !tool.installed);
    if (missing.length) {
      say(`\n${missing.map(tool => tool.name).join(' and ')} not found on this machine. Install it first:`);
      showInstallHelp(missing);
      process.exit(1);
    }
    return found.filter(tool => wanted.includes(tool.id));
  }
  if (found.length === 1) {
    return (await prompter.confirm(`\nInstall senior-ai for ${found[0].name}?`)) ? found : [];
  }
  return prompter.choose('\nInstall senior-ai for:', [
    { label: found.map(tool => tool.name).join(' and '), value: found },
    ...found.map(tool => ({ label: `${tool.name} only`, value: [tool] })),
  ]);
}

const ACCOUNT_NOTE = { none: '', login: ' (needs a login)', token: ' (needs a token)' };

// Shows each extra's status for one tool and returns the ids the user accepts.
async function chooseExtras(tool, statuses, options, prompter) {
  say(`\nOptional extras for ${tool.name} (none is required; senior-ai works without them):`);
  for (const { extra, present, bySeniorAi } of statuses) {
    const state = present ? (bySeniorAi ? 'installed by senior-ai' : 'already installed') : `missing${ACCOUNT_NOTE[extra.account]}`;
    say(`  ${present ? '✓' : '•'} ${extra.name.padEnd(16)} ${state.padEnd(28)} ${extra.purpose}`);
  }
  const missing = statuses.filter(status => !status.present).map(status => status.extra);
  if (!missing.length || !options.extras) return new Set();
  if (!prompter.interactive && !options.yes) {
    say('  Not installing extras without a terminal. Re-run with --yes to install them.');
    return new Set();
  }
  const answer = await prompter.choose(`Install the ${missing.length} missing extra${missing.length > 1 ? 's' : ''}?`, [
    { label: 'Yes, all of them', value: 'all' },
    { label: 'Let me choose', value: 'choose' },
    { label: 'No', value: 'none' },
  ]);
  if (answer === 'all') return new Set(missing.map(extra => extra.id));
  if (answer === 'none') return new Set();
  const chosen = new Set();
  for (const extra of missing) if (await prompter.confirm(`  ${extra.name}?`)) chosen.add(extra.id);
  return chosen;
}

function installForVibe({ tool, ops, extras, chosen }) {
  ops.beginTool('vibe');
  installVibe({ ops, src: path.join(REPO, 'dist', 'vibe'), vibeDir: tool.configDir, version: META.version });
  installVibeExtras({ ops, vibeDir: tool.configDir, extras, chosenIds: chosen });
  ops.restoreOrphans();
  return [
    `✓ senior-ai ${META.version}: agents, skills, rules and update notice`,
    ...extras.filter(extra => chosen.has(extra.id)).map(extra => `✓ ${extra.name} (MCP server)`),
  ];
}

function installForClaude({ ops, extras, chosen, options }) {
  ops.beginTool('claude', { uninstallEntry: claudeUninstallEntry(META) });
  const source = options.mode === 'link' ? REPO : process.env.SENIOR_AI_SOURCE || META.marketplace.githubRepo;
  const core = installClaude({ ops, meta: META, source, dryRun: options.dryRun });
  const lines = [core.ok ? `✓ senior-ai ${META.version} plugin (${core.detail})` : `✗ senior-ai plugin: ${core.detail}`];
  for (const extra of extras.filter(e => chosen.has(e.id))) {
    const result = installClaudeExtra({ ops, extra, dryRun: options.dryRun });
    const how = { plugin: 'official plugin', mcp: 'MCP server' }[result.how] ?? result.how;
    lines.push(result.ok ? `✓ ${extra.name} (${how})` : `✗ ${extra.name}: ${result.detail}. senior-ai works without it.`);
  }
  ops.restoreOrphans();
  return lines;
}

async function install(options, prompter) {
  say(`senior-ai ${META.version} installer\n`);
  say('Looking for AI tools…');
  const detected = detectTools();
  for (const tool of detected) {
    const how = tool.via && tool.via !== 'command' ? ` (${tool.via})` : '';
    say(`  ${tool.installed ? '✓' : '·'} ${tool.name}${tool.installed ? ` ${tool.version}${how}` : ': not found'}`);
    if (tool.outdated) say(`    ! ${tool.name} ${tool.minVersion} or newer is needed for the agents to work. Upgrade with: ${tool.upgrade}`);
  }
  if (!detected.some(tool => tool.installed)) {
    say('\nNo supported AI tool found. Install one of them, then run this installer again:');
    showInstallHelp(detected);
    process.exit(1);
  }

  const targets = await chooseTools(detected, options, prompter);
  if (!targets.length) {
    say('Nothing to install.');
    return;
  }

  const extras = loadExtras();
  const ops = createFileOps({ stateDir: STATE_DIR, mode: options.mode, dryRun: options.dryRun });
  const plans = [];
  for (const tool of targets) {
    const statuses =
      tool.id === 'claude' ? claudeExtrasStatus(extras, ops.extrasInstalledBySeniorAi('claude')) : vibeExtrasStatus(extras, tool.configDir);
    plans.push({ tool, statuses, chosen: await chooseExtras(tool, statuses, options, prompter) });
  }

  say(options.dryRun ? '\n(dry run: nothing will be changed)' : '\nInstalling…');
  const summary = [];
  for (const { tool, statuses, chosen } of plans) {
    const lines =
      tool.id === 'vibe' ? installForVibe({ tool, ops, extras, chosen }) : installForClaude({ ops, extras, chosen, options });
    for (const { extra, present } of statuses) if (!present && !chosen.has(extra.id)) lines.push(`− ${extra.name}: skipped`);
    // Login and token instructions, only for extras installed in this run.
    for (const extra of extras.filter(e => chosen.has(e.id) && e.setup)) lines.push(`! ${extra.name}: ${extra.setup}`);
    summary.push({ tool, lines });
  }

  say('\nSummary');
  for (const { tool, lines } of summary) {
    say(tool.name);
    for (const line of lines) say(`  ${line}`);
  }
  say('\nNext: in a project, run /senior-ai:setup-project (Claude Code) or ask Vibe to use the setup-project skill.');
  if (targets.some(tool => tool.id === 'vibe' && tool.via !== 'command')) {
    say(`In ${targets.find(tool => tool.id === 'vibe').via.replace(/ extension$/, '')}, reload the window, then pick a senior-ai agent (orchestrator, ui-builder) in the Vibe panel's agent selector.`);
  }
  if (targets.some(tool => tool.id === 'vibe') && options.mode === 'copy') {
    say(`Vibe gets a copy: after a git pull, re-run ${INSTALL_COMMAND} to update it.`);
  }
}

async function uninstall(options, prompter) {
  const ops = createFileOps({ stateDir: STATE_DIR, mode: options.mode, dryRun: options.dryRun });
  const wanted = options.tool === 'both' || !options.tool ? ['claude', 'vibe'] : [options.tool];
  const tools = detectTools().filter(tool => wanted.includes(tool.id) && fs.existsSync(ops.manifest(tool.id)));
  if (!tools.length) {
    say('senior-ai is not installed here (no install record found).');
    return;
  }
  const removeExtras = await prompter.confirm('Also remove the optional extras senior-ai installed (MCP servers, plugins)?', false);
  for (const tool of tools) {
    say(`Uninstalling senior-ai from ${tool.name}`);
    ops.setTool(tool.id);
    ops.removeInstalled(tool.id, { restore: true, removeExtras, uninstallEntry: claudeUninstallEntry(META) });
    if (options.dryRun) continue;
    fs.rmSync(ops.manifest(tool.id), { force: true });
    if (tool.id === 'vibe') {
      // Folders senior-ai created; only removed when nothing else is inside.
      for (const dir of ['senior-ai', 'skills', 'agents', 'prompts']) {
        try {
          fs.rmdirSync(path.join(tool.configDir, dir));
        } catch {}
      }
    }
  }
  say('Done.');
}

const options = parseArgs(process.argv.slice(2));
const prompter = createPrompter({ assumeYes: options.yes });
try {
  await (options.uninstall ? uninstall(options, prompter) : install(options, prompter));
} finally {
  prompter.close();
}
