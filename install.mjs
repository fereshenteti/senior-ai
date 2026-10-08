#!/usr/bin/env node
// senior-ai installer for Mistral Vibe and/or Claude Code, on macOS, Linux and Windows. Safe to re-run.
//   Vibe: copies (or links) the shared skills, prompts, agents and rules into ~/.vibe; existing files are backed up.
//   Claude Code: installs the senior-ai plugin from the feres marketplace (this repo).
// Started by install.sh (macOS/Linux) or install.cmd (Windows); `node install.mjs` works everywhere.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const REPO = path.dirname(fileURLToPath(import.meta.url));
const HOME = os.homedir();
const IS_WINDOWS = process.platform === 'win32';
const STATE_DIR = process.env.SENIOR_AI_STATE_DIR || path.join(HOME, '.senior-ai');
const VIBE_DIR = process.env.SENIOR_AI_VIBE_DIR || process.env.VIBE_HOME || path.join(HOME, '.vibe');
const MARKS = {
  block: ['<!-- senior-ai:start -->', '<!-- senior-ai:end -->'],
  tomlblock: ['# senior-ai:start', '# senior-ai:end'],
};
const MARKETPLACE = 'feres';
const PLUGIN = `senior-ai@${MARKETPLACE}`;
const GITHUB_REPO = 'fereshenteti/senior-ai';
const INSTALL_COMMAND = IS_WINDOWS ? 'install.cmd' : './install.sh';
const BACKUP_ROOT = path.join(STATE_DIR, 'backups', timestamp());

const USAGE = `Usage: ${INSTALL_COMMAND} [--tool vibe|claude|both] [--link] [--uninstall] [--dry-run]

  --tool <name>   Which AI tool to install for: vibe, claude or both (default: both).
                  Without --tool, you are asked interactively.
  --link          Use this folder directly instead of a copy. Vibe: links into ~/.vibe.
                  Claude Code: the plugin is read from this folder instead of GitHub.
                  Edits and 'git pull' apply immediately, but the repo must stay in place.
  --uninstall     Remove everything senior-ai installed and restore backups.
  --dry-run       Show what would happen without changing anything.`;

const options = { tool: '', mode: 'copy', action: 'install', dryRun: false };
let currentTool = '';
let warnedFileLinks = false;

function timestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function die(message) {
  console.error(`Error: ${message}`);
  process.exit(2);
}

const say = message => console.log(message);
const pretty = p => (p === HOME || p.startsWith(HOME + path.sep) ? '~' + p.slice(HOME.length) : p);

function exists(p) {
  try {
    fs.lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

// Runs a filesystem change, or only describes it in a dry run.
function run(description, action) {
  if (options.dryRun) {
    say(`  [dry-run] ${description}`);
    return;
  }
  action();
}

function parseArgs(argv) {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--tool') {
      if (argv[i + 1] === undefined) die('--tool needs a value (vibe, claude or both)');
      options.tool = argv[++i];
    } else if (arg.startsWith('--tool=')) options.tool = arg.slice('--tool='.length);
    else if (arg === '--link') options.mode = 'link';
    else if (arg === '--uninstall') options.action = 'uninstall';
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '-h' || arg === '--help') {
      say(USAGE);
      process.exit(0);
    } else {
      console.error(USAGE);
      die(`unknown option: ${arg}`);
    }
  }
}

async function chooseTools() {
  if (!options.tool) {
    if (process.stdin.isTTY) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await rl.question(
        `Which AI tool should senior-ai be ${options.action}ed for?\n` +
          '  1) Both Mistral Vibe and Claude Code (default)\n' +
          '  2) Mistral Vibe only\n' +
          '  3) Claude Code only\n' +
          'Choice [1]: ',
      );
      rl.close();
      const choices = { '': 'both', 1: 'both', both: 'both', 2: 'vibe', vibe: 'vibe', 3: 'claude', claude: 'claude' };
      options.tool = choices[answer.trim()] ?? die(`invalid choice: ${answer.trim()}`);
    } else {
      options.tool = 'both';
    }
  }
  const tools = { both: ['vibe', 'claude'], vibe: ['vibe'], claude: ['claude'] }[options.tool];
  return tools ?? die(`--tool must be vibe, claude or both (got: ${options.tool})`);
}

// --- manifest: one line per installed item, "<dest><TAB><backup or empty>" -------------------

const manifest = tool => path.join(STATE_DIR, `${tool}.manifest`);

function readManifest(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => {
      const [dest, backup = ''] = line.split('\t');
      return { dest, backup };
    });
}

function record(dest, backup) {
  if (options.dryRun) return;
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.appendFileSync(manifest(currentTool), `${dest}\t${backup}\n`);
}

// Backup recorded for <dest> by a previous install of the current tool (kept across re-installs).
function previousBackup(dest) {
  return readManifest(`${manifest(currentTool)}.prev`).find(entry => entry.dest === dest)?.backup ?? '';
}

function backupPath(dest) {
  const rel = dest.startsWith(HOME + path.sep) ? path.relative(HOME, dest) : dest.replace(/^([a-zA-Z]:)?[\\/]+/, '');
  return path.join(BACKUP_ROOT, currentTool, rel);
}

function move(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  try {
    fs.renameSync(from, to);
  } catch (err) {
    if (err.code !== 'EXDEV') throw err;
    fs.cpSync(from, to, { recursive: true, verbatimSymlinks: true });
    fs.rmSync(from, { recursive: true, force: true });
  }
}

// Directories link as junctions on Windows (no admin rights needed); files that cannot be
// symlinked there (no Developer Mode) are copied instead.
function link(src, dest) {
  const isDir = fs.statSync(src).isDirectory();
  if (!IS_WINDOWS) return fs.symlinkSync(src, dest);
  if (isDir) return fs.symlinkSync(src, dest, 'junction');
  try {
    fs.symlinkSync(src, dest, 'file');
  } catch {
    if (!warnedFileLinks) {
      say('  note: Windows refused file symlinks (enable Developer Mode to allow them); copying files instead.');
      warnedFileLinks = true;
    }
    fs.copyFileSync(src, dest);
  }
}

// place(src, dest, how): link (or copy) src to dest, backing up whatever is there.
function place(src, dest, how = options.mode) {
  let backup = previousBackup(dest);
  if (exists(dest)) {
    backup = backupPath(dest);
    run(`move ${pretty(dest)} → ${pretty(backup)}`, () => move(dest, backup));
    say(`  backed up existing ${pretty(dest)} → ${pretty(backup)}`);
  }
  run(`${how === 'link' ? 'link' : 'copy'} ${pretty(src)} → ${pretty(dest)}`, () => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (how === 'link') link(src, dest);
    else fs.cpSync(src, dest, { recursive: true });
  });
  record(dest, backup);
}

// --- marked blocks inside files the user owns (an existing AGENTS.md, hooks.toml) ------------

function stripBlock(file, kind) {
  if (!fs.existsSync(file)) return;
  const [start, end] = MARKS[kind];
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(start)) return;
  if (options.dryRun) {
    say(`  [dry-run] remove senior-ai block from ${pretty(file)}`);
    return;
  }
  const kept = [];
  let skip = false;
  for (const line of text.split(/\r?\n/)) {
    if (line === start) skip = true;
    else if (line === end) skip = false;
    else if (!skip) kept.push(line);
  }
  // Drop the trailing blank lines the block leaves behind.
  while (kept.length && kept[kept.length - 1].trim() === '') kept.pop();
  fs.writeFileSync(file, kept.length ? kept.join('\n') + '\n' : '');
}

// addBlock(file, content, kind): append content between markers; records "<kind>:<file>".
function addBlock(file, content, kind) {
  const created = fs.existsSync(file) ? '' : 'created';
  if (options.dryRun) {
    say(`  [dry-run] add senior-ai block to ${pretty(file)}`);
    return;
  }
  const [start, end] = MARKS[kind];
  fs.mkdirSync(path.dirname(file), { recursive: true });
  stripBlock(file, kind);
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const body = content.endsWith('\n') ? content : content + '\n';
  fs.appendFileSync(file, `${current ? '\n' : ''}${start}\n${body}${end}\n`);
  record(`${kind}:${file}`, created);
}

function removeBlock(file, kind, created) {
  stripBlock(file, kind);
  if (created === 'created' && fs.existsSync(file) && fs.readFileSync(file, 'utf8').trim() === '') {
    run(`delete ${pretty(file)}`, () => fs.rmSync(file));
  }
}

// --- uninstall ---------------------------------------------------------------------------------

function removeInstalled(tool, restore) {
  for (const { dest, backup } of readManifest(manifest(tool))) {
    const [kind, ...rest] = dest.split(':');
    if (kind in MARKS && rest.length) {
      removeBlock(rest.join(':'), kind, backup);
      continue;
    }
    if (kind === 'plugin' && rest.length) {
      removePlugin();
      continue;
    }
    if (exists(dest)) run(`delete ${pretty(dest)}`, () => fs.rmSync(dest, { recursive: true, force: true }));
    if (restore && backup && exists(backup)) {
      run(`move ${pretty(backup)} → ${pretty(dest)}`, () => move(backup, dest));
      say(`  restored ${pretty(dest)}`);
    }
  }
}

// After a re-install, restore backups of items that are no longer part of senior-ai.
function restoreOrphans() {
  const prev = `${manifest(currentTool)}.prev`;
  for (const { dest, backup } of readManifest(prev)) {
    const kind = dest.split(':')[0];
    if (kind in MARKS || kind === 'plugin') continue;
    if (backup && exists(backup) && !exists(dest)) {
      run(`move ${pretty(backup)} → ${pretty(dest)}`, () => move(backup, dest));
      say(`  restored ${pretty(dest)} (no longer provided by senior-ai)`);
    }
  }
  if (!options.dryRun) fs.rmSync(prev, { force: true });
}

function beginTool(tool) {
  currentTool = tool;
  const file = manifest(tool);
  if (!fs.existsSync(file)) return;
  removeInstalled(tool, false);
  if (!options.dryRun) fs.renameSync(file, `${file}.prev`);
}

// --- per-tool installs -------------------------------------------------------------------------

const entries = (dir, filter) =>
  fs
    .readdirSync(path.join(REPO, dir), { withFileTypes: true })
    .filter(filter)
    .map(entry => entry.name)
    .sort();

function readVersion() {
  return JSON.parse(fs.readFileSync(path.join(REPO, '.claude-plugin', 'plugin.json'), 'utf8')).version;
}

function installVibe() {
  beginTool('vibe');
  say(`Mistral Vibe → ${pretty(VIBE_DIR)}`);
  if (!fs.existsSync(VIBE_DIR)) say(`  note: ${pretty(VIBE_DIR)} does not exist yet; creating it.`);

  for (const name of entries('skills', e => e.isDirectory())) {
    place(path.join(REPO, 'skills', name), path.join(VIBE_DIR, 'skills', name));
  }
  for (const name of entries('prompts', e => e.isFile() && e.name.endsWith('.md'))) {
    place(path.join(REPO, 'prompts', name), path.join(VIBE_DIR, 'prompts', name));
  }
  for (const name of entries(path.join('adapters', 'vibe', 'agents'), e => e.isFile() && e.name.endsWith('.toml'))) {
    place(path.join(REPO, 'adapters', 'vibe', 'agents', name), path.join(VIBE_DIR, 'agents', name));
  }

  // Global rules: install AGENTS.md, or append to the user's own AGENTS.md if they have one.
  const agents = path.join(VIBE_DIR, 'AGENTS.md');
  const userOwned = fs.existsSync(agents) && !fs.lstatSync(agents).isSymbolicLink() && !previousBackup(agents);
  if (userOwned) {
    addBlock(agents, fs.readFileSync(path.join(REPO, 'AGENTS.md'), 'utf8'), 'block');
    say(`  appended senior-ai rules to your existing ${pretty(agents)} (re-run the installer after updating AGENTS.md)`);
  } else {
    place(path.join(REPO, 'AGENTS.md'), agents);
  }

  // Update notice: a post_agent hook that tells the user when GitHub has a newer version.
  // Vibe runs hook commands through the system shell (cmd.exe on Windows), so the command
  // is plain `node "<path>"` with forward slashes, which every shell and Node accept.
  const noticeDir = path.join(VIBE_DIR, 'senior-ai');
  const script = path.join(noticeDir, 'check-update.mjs');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'senior-ai-'));
  fs.writeFileSync(path.join(tmp, 'VERSION'), `${readVersion()}\n`);
  fs.writeFileSync(path.join(tmp, 'SOURCE'), `${REPO}\n`);
  place(path.join(REPO, 'hooks', 'check-update.mjs'), script, 'copy');
  place(path.join(tmp, 'VERSION'), path.join(noticeDir, 'VERSION'), 'copy');
  place(path.join(tmp, 'SOURCE'), path.join(noticeDir, 'SOURCE'), 'copy');
  const command = `node "${script.split(path.sep).join('/')}" --tool vibe`;
  addBlock(
    path.join(VIBE_DIR, 'hooks.toml'),
    [
      '[[hooks]]',
      'name = "senior-ai-update-check"',
      'type = "post_agent"',
      `command = ${JSON.stringify(command)}`,
      'timeout = 10.0',
      'description = "Tell the user when a newer senior-ai version is available."',
    ].join('\n'),
    'tomlblock',
  );
  fs.rmSync(tmp, { recursive: true, force: true });
  restoreOrphans();
}

// `claude` is claude.exe or an npm claude.cmd shim on Windows; shims only start through a shell.
function claude(args, { quiet = false } = {}) {
  const quote = arg => (IS_WINDOWS && /[\s"]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg);
  return spawnSync('claude', IS_WINDOWS ? args.map(quote) : args, {
    stdio: quiet ? 'ignore' : 'inherit',
    shell: IS_WINDOWS,
  });
}

function claudePlugin(args, { quiet = false } = {}) {
  if (options.dryRun) {
    say(`  [dry-run] claude plugin ${args.join(' ')}`);
    return true;
  }
  return claude(['plugin', ...args], { quiet }).status === 0;
}

function requireClaude() {
  const probe = claude(['--version'], { quiet: true });
  if (probe.error || probe.status !== 0) die("the 'claude' CLI is not on your PATH; install Claude Code first.");
}

function removePlugin() {
  claudePlugin(['uninstall', PLUGIN], { quiet: true });
  claudePlugin(['marketplace', 'remove', MARKETPLACE], { quiet: true });
}

function installClaude() {
  beginTool('claude');
  requireClaude();
  const source = options.mode === 'link' ? REPO : GITHUB_REPO;
  say(`Claude Code → plugin ${PLUGIN} from ${pretty(source)}`);

  // Re-register the marketplace so a switch between GitHub and this folder takes effect.
  claudePlugin(['marketplace', 'remove', MARKETPLACE], { quiet: true });
  if (!claudePlugin(['marketplace', 'add', source])) die('adding the feres marketplace failed (see above).');
  if (!claudePlugin(['install', PLUGIN])) die(`installing ${PLUGIN} failed (see above).`);
  record(`plugin:${PLUGIN}`, '');
  restoreOrphans();
}

function nextSteps(tools) {
  say('\nDone. Next steps:');
  if (tools.includes('vibe')) {
    say(`  Vibe:   merge adapters/vibe/config.example.toml into ${pretty(path.join(VIBE_DIR, 'config.toml'))} (MCP servers),`);
    say('          then start with: vibe --agent ui-builder');
  }
  if (tools.includes('claude')) {
    say('  Claude: add MCP servers with the commands in adapters/claude/mcp.md,');
    say('          then start with: claude --agent ui-builder');
    say(`          Updates: claude plugin update ${PLUGIN} (you are told when one is available)`);
  }
  say('  Per project: run /senior-ai:setup-project (Claude Code) or the setup-project skill (Vibe) from the project root.');
  if (tools.includes('vibe') && options.mode === 'copy') {
    say(`  Vibe files were copied: re-run ${INSTALL_COMMAND} after changing anything in this repo (or install with --link).`);
  }
}

async function main() {
  parseArgs(process.argv.slice(2));
  const tools = await chooseTools();
  if (options.dryRun) say('(dry run: nothing will be changed)');

  if (options.action === 'uninstall') {
    for (const tool of tools) {
      currentTool = tool;
      say(`Uninstalling senior-ai from ${tool}`);
      removeInstalled(tool, true);
      if (!options.dryRun) {
        fs.rmSync(manifest(tool), { force: true });
        // Folders senior-ai created; only removed when nothing else is inside.
        if (tool === 'vibe') {
          for (const dir of ['senior-ai', 'skills', 'agents', 'prompts']) {
            try {
              fs.rmdirSync(path.join(VIBE_DIR, dir));
            } catch {}
          }
        }
      }
    }
    say('Done.');
    return;
  }

  say(`Installing senior-ai (${options.mode} mode) from ${pretty(REPO)}`);
  if (tools.includes('vibe')) installVibe();
  if (tools.includes('claude')) installClaude();
  nextSteps(tools);
}

await main();
