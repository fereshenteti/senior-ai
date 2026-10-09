#!/usr/bin/env node
// Integrates senior-ai into the project in the current working directory, in each AI tool's own
// project folders (.claude/, .vibe/), so the team can edit its agents, skills, rules and hooks and
// commit them with the project. Safe to re-run: existing files are the team's and are kept.
//
//   node setup-project.mjs --tool claude|vibe|both
//                          [--memory yes|no] [--ignore-memory yes|no] [--orchestrator-default yes|no]
//                          [--update] [--from <senior-ai folder>]
//
//   --update  take the senior-ai version installed on this machine: replaces the files the team did
//             not change, and puts the new version of the others next to them (<file>.senior-ai-new)
//
// Every tool:
//   - agents, skills, hooks and the rules block in AGENTS.md (build/project.mjs describes the layout)
//   - AGENTS.md: project facts template (created only if missing)
//   - .senior-ai/status.md: the project memory board (--memory, default yes)
//   - .gitignore: .visual-check/, and .senior-ai/ when --ignore-memory yes
// Claude Code:
//   - CLAUDE.md: imports AGENTS.md
//   - .claude/settings.local.json: the orchestrator as this user's default agent (--orchestrator-default yes)

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ORCHESTRATOR = 'orchestrator';
const OLD_ORCHESTRATOR = 'senior-ai:orchestrator'; // the plugin's name for it
const SKILL_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const AGENTS_TEMPLATE = path.join(SKILL_DIR, 'AGENTS.project.md');
const STATUS_TEMPLATE = path.join(SKILL_DIR, '..', 'project-memory', 'templates', 'status.md');
const TOOLS = { claude: ['claude'], vibe: ['vibe'], both: ['claude', 'vibe'] };
const USAGE =
  'Usage: node setup-project.mjs --tool claude|vibe|both [--memory yes|no] [--ignore-memory yes|no] ' +
  '[--orchestrator-default yes|no] [--update] [--from <senior-ai folder>]';

const root = process.cwd();
const changes = [];
const notes = [];

function fail(message, code = 2) {
  console.error(code === 2 ? `${message}\n${USAGE}` : message);
  process.exit(code);
}

function parseArgs(argv) {
  const options = { tools: null, memory: true, ignoreMemory: false, orchestratorDefault: false, update: false, from: null };
  const yesNo = (flag, value) => {
    if (value !== 'yes' && value !== 'no') fail(`${flag} must be yes or no`);
    return value === 'yes';
  };
  for (let i = 0; i < argv.length; i++) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (flag === '--update') {
      options.update = true;
      continue;
    }
    if (flag === '--tool') options.tools = TOOLS[value] ?? fail('--tool must be claude, vibe or both');
    else if (flag === '--memory') options.memory = yesNo(flag, value);
    else if (flag === '--ignore-memory') options.ignoreMemory = yesNo(flag, value);
    else if (flag === '--orchestrator-default') options.orchestratorDefault = yesNo(flag, value);
    else if (flag === '--from') options.from = value ? path.resolve(value) : fail('--from needs a folder');
    else fail(`Unknown option: ${flag}`);
    i++;
  }
  if (!options.tools) fail('--tool is required');
  return options;
}

const readText = file => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
const isSeniorAi = dir =>
  Boolean(dir) && ['senior-ai.json', 'departments', path.join('build', 'project.mjs')].every(item => fs.existsSync(path.join(dir, item)));

// The full senior-ai sources: the tree this script runs from (a clone), else the Claude Code
// marketplace copy, else the folder the Vibe install came from.
function findSource(from) {
  if (from) return isSeniorAi(from) ? from : fail(`${from} is not a senior-ai folder.`, 1);
  const own = path.resolve(SKILL_DIR, '..', '..', '..', '..');
  if (isSeniorAi(own)) return own;
  try {
    const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
    const known = JSON.parse(readText(path.join(claudeDir, 'plugins', 'known_marketplaces.json')));
    if (isSeniorAi(known.feres?.installLocation)) return known.feres.installLocation;
  } catch {}
  const recorded = readText(path.join(process.env.VIBE_HOME || path.join(os.homedir(), '.vibe'), 'senior-ai', 'SOURCE')).trim();
  if (isSeniorAi(recorded)) return recorded;
  return fail(
    "senior-ai's sources were not found on this machine. Clone https://github.com/fereshenteti/senior-ai " +
      'and run this script again with --from <that folder>.',
    1,
  );
}

// A project keeps the copy of this skill it was set up with; the senior-ai on this machine may be
// newer and know a newer layout, so its own script does the work.
function runNewestScript(source) {
  const newest = path.join(source, 'departments', 'core', 'skills', 'setup-project', 'scripts', 'setup-project.mjs');
  if (!fs.existsSync(newest) || fs.realpathSync(newest) === fs.realpathSync(fileURLToPath(import.meta.url))) return;
  const args = process.argv.slice(2).filter((arg, i, all) => arg !== '--from' && all[i - 1] !== '--from');
  const result = spawnSync(process.execPath, [newest, ...args, '--from', source], { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}

function appendLine(file, line, pattern) {
  const current = readText(file);
  if (pattern.test(current)) return false;
  const separator = current && !current.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(file, `${current}${separator}${line}\n`);
  return true;
}

function readJson(file) {
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    fail(`Cannot parse ${path.relative(root, file)}: ${err.message}. Fix it and re-run.`, 1);
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function createAgentsMd() {
  const file = path.join(root, 'AGENTS.md');
  if (fs.existsSync(file)) return;
  fs.copyFileSync(AGENTS_TEMPLATE, file);
  changes.push('AGENTS.md: created from the project template (fill in the placeholders)');
}

function createMemory() {
  const file = path.join(root, '.senior-ai', 'status.md');
  if (fs.existsSync(file)) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(file, fs.readFileSync(STATUS_TEMPLATE, 'utf8').replace('<YYYY-MM-DD>', today));
  changes.push('.senior-ai/status.md: project memory created (stories, decisions and status go in .senior-ai/)');
}

function updateGitignore(options) {
  const file = path.join(root, '.gitignore');
  if (appendLine(file, '.visual-check/', /^\/?\.visual-check\/?\s*$/m)) changes.push('.gitignore: ignores .visual-check/');
  // An earlier layout kept a copy in .senior-ai/system/ and ignored only the memory around it.
  const current = readText(file);
  const cleaned = current.replace(/^!\/?\.senior-ai\/system\/?[ \t]*\r?\n?/m, '').replace(/^(\/?)\.senior-ai\/\*[ \t]*$/m, '$1.senior-ai/');
  if (cleaned !== current) fs.writeFileSync(file, cleaned);
  if (options.memory && options.ignoreMemory && appendLine(file, '.senior-ai/', /^\/?\.senior-ai\/?\s*$/m)) {
    changes.push('.gitignore: ignores .senior-ai/ (the project memory stays on this machine)');
  }
}

function importAgentsMd() {
  const file = path.join(root, 'CLAUDE.md');
  const existed = fs.existsSync(file) && fs.readFileSync(file, 'utf8').trim() !== '';
  if (appendLine(file, existed ? '\n@AGENTS.md' : '@AGENTS.md', /^@AGENTS\.md\s*$/m)) {
    changes.push(`CLAUDE.md: ${existed ? 'now imports' : 'created, imports'} AGENTS.md`);
  }
}

// Personal and git-ignored: each person chooses whether their sessions start as the orchestrator.
function setOrchestratorDefault(enabled) {
  const file = path.join(root, '.claude', 'settings.local.json');
  const settings = readJson(file);
  if (enabled && settings.agent !== ORCHESTRATOR) {
    writeJson(file, { ...settings, agent: ORCHESTRATOR });
    appendLine(path.join(root, '.gitignore'), '.claude/settings.local.json', /^\/?\.claude\/settings\.local\.json\s*$/m);
    changes.push('.claude/settings.local.json: your Claude sessions in this project start as the orchestrator (personal, git-ignored)');
  } else if (!enabled && [ORCHESTRATOR, OLD_ORCHESTRATOR].includes(settings.agent)) {
    delete settings.agent;
    writeJson(file, settings);
    changes.push('.claude/settings.local.json: sessions no longer start as the orchestrator');
  }
}

async function installSeniorAi(options, source) {
  const project = await import(pathToFileURL(path.join(source, 'build', 'project.mjs')).href);
  const tools = [...new Set([...(project.readLock(root)?.tools ?? []), ...options.tools])].sort();
  const { version } = JSON.parse(readText(path.join(source, 'senior-ai.json')));
  const report = project.installProject(root, tools, { update: options.update });
  const placed = [...report.added, ...report.updated];
  if (placed.length) changes.push(`senior-ai ${version} for ${tools.join(' + ')}: ${summarize(placed)}`);
  changes.push(...report.migrated);
  if (report.removed.length) changes.push(`removed, no longer part of senior-ai: ${summarize(report.removed)}`);
  if (report.kept.length) {
    notes.push(`${report.kept.length} senior-ai file(s) differ from version ${version} and were kept. To take the new version: re-run with --update.`);
  }
  if (report.conflicts.length) {
    notes.push('Changed by your team and by senior-ai. Your version is kept; merge in the new one next to it, then delete it:');
    notes.push(...report.conflicts.map(rel => `  ${rel}  ←  ${rel}.senior-ai-new`));
  }
  if (tools.length > 1) {
    const { skills, hooks } = project.layout(tools);
    notes.push(`Skills and hook scripts exist once, in ${skills}/ and ${hooks}/; Vibe reads those skills through .vibe/config.toml.`);
  }
  return tools;
}

// ".claude/agents/a.md, .claude/agents/b.md, AGENTS.md" → ".claude/agents/ (2 files), AGENTS.md"
function summarize(files) {
  const groups = new Map();
  for (const file of files) {
    const parts = file.split('/');
    const key = parts.length > 2 ? `${parts.slice(0, 2).join('/')}/` : file;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  return [...groups].map(([key, count]) => (key.endsWith('/') ? `${key} (${count} file${count > 1 ? 's' : ''})` : key)).join(', ');
}

const options = parseArgs(process.argv.slice(2));
const source = findSource(options.from);
runNewestScript(source);
createAgentsMd();
if (options.memory) createMemory();
updateGitignore(options);
const tools = await installSeniorAi(options, source);
if (tools.includes('claude')) {
  importAgentsMd();
  setOrchestratorDefault(options.orchestratorDefault);
  notes.push('Claude Code: restart it in this project. Agents: `claude --agent orchestrator`, or `@agent-orchestrator` in a session.');
}
if (tools.includes('vibe')) {
  notes.push("Vibe: trust this folder when Vibe asks, so it uses the project's agents; pick the orchestrator with Shift+Tab or `vibe --agent orchestrator`.");
}

console.log(changes.length ? `senior-ai integrated for ${tools.join(' + ')}:\n- ${changes.join('\n- ')}` : `senior-ai is already integrated for ${tools.join(' + ')}; nothing changed.`);
for (const note of notes) console.log(note);
