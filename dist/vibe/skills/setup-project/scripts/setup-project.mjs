#!/usr/bin/env node
// Integrates senior-ai into the project in the current working directory by copying the whole
// system into it (.senior-ai/system/), so the team can edit its agents, skills, rules and hooks and
// commit them with the project. Safe to re-run: it merges into existing files and never overwrites
// the team's copy (`node .senior-ai/system/build/project.mjs --update` takes a newer senior-ai).
//
//   node setup-project.mjs --tool claude|vibe|both
//                          [--memory yes|no] [--ignore-memory yes|no] [--orchestrator-default yes|no]
//                          [--from <senior-ai folder>]
//
// Every tool:
//   - .senior-ai/system/: the team's copy of senior-ai, and the tool files generated from it
//     (.claude/agents, .claude/skills and hooks; .vibe/agents, prompts, skills and hooks.toml)
//   - AGENTS.md: project facts template (created only if missing) plus the generated rules block
//   - .senior-ai/status.md: the project memory board (--memory, default yes)
//   - .gitignore: .visual-check/, and the memory (not the system copy) when --ignore-memory yes
// Claude Code:
//   - .claude/settings.json: the copy's hooks; the machine-wide senior-ai plugin is off here
//   - CLAUDE.md: imports AGENTS.md
//   - .claude/settings.local.json: the orchestrator as this user's default agent (--orchestrator-default yes)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SYSTEM_DIR = path.join('.senior-ai', 'system');
const ORCHESTRATOR = 'orchestrator';
const OLD_ORCHESTRATOR = 'senior-ai:orchestrator'; // the plugin's name for it, before projects had a copy
const SKILL_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const AGENTS_TEMPLATE = path.join(SKILL_DIR, 'AGENTS.project.md');
const STATUS_TEMPLATE = path.join(SKILL_DIR, '..', 'project-memory', 'templates', 'status.md');
const TOOLS = { claude: ['claude'], vibe: ['vibe'], both: ['claude', 'vibe'] };
const USAGE =
  'Usage: node setup-project.mjs --tool claude|vibe|both [--memory yes|no] [--ignore-memory yes|no] ' +
  '[--orchestrator-default yes|no] [--from <senior-ai folder>]';

const root = process.cwd();
const changes = [];
const notes = [];

function fail(message, code = 2) {
  console.error(code === 2 ? `${message}\n${USAGE}` : message);
  process.exit(code);
}

function parseArgs(argv) {
  const options = { tools: null, memory: true, ignoreMemory: false, orchestratorDefault: false, from: null };
  const yesNo = (flag, value) => {
    if (value !== 'yes' && value !== 'no') fail(`${flag} must be yes or no`);
    return value === 'yes';
  };
  for (let i = 0; i < argv.length; i++) {
    const [flag, value] = [argv[i], argv[i + 1]];
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

const isSeniorAi = dir => Boolean(dir) && ['senior-ai.json', 'departments', path.join('build', 'project.mjs')].every(item => fs.existsSync(path.join(dir, item)));
const readText = file => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');

// The full senior-ai sources to copy: the tree this script runs from (a clone, or a project's
// copy), else the Claude Code marketplace copy, else the folder the Vibe install came from.
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

// The memory may stay on this machine, but the system copy is always shared with the team.
function updateGitignore(options) {
  const file = path.join(root, '.gitignore');
  if (appendLine(file, '.visual-check/', /^\/?\.visual-check\/?\s*$/m)) changes.push('.gitignore: ignores .visual-check/');
  const current = readText(file);
  const wholeFolder = /^\/?\.senior-ai\/?\s*$/m;
  if (wholeFolder.test(current)) {
    // A whole ignored folder cannot have exceptions: ignore its content instead.
    fs.writeFileSync(file, current.replace(wholeFolder, '.senior-ai/*'));
    changes.push('.gitignore: .senior-ai/ became .senior-ai/* so the system copy can be committed');
  }
  if (options.memory && options.ignoreMemory && appendLine(file, '.senior-ai/*', /^\/?\.senior-ai\/\*\s*$/m)) {
    changes.push('.gitignore: ignores the project memory in .senior-ai/ (it stays on this machine)');
  }
  if (/^\/?\.senior-ai\/\*\s*$/m.test(readText(file)) && appendLine(file, '!.senior-ai/system/', /^!\/?\.senior-ai\/system\/?\s*$/m)) {
    changes.push('.gitignore: keeps .senior-ai/system/ (the team copy of senior-ai) in git');
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
  const isOurs = settings.agent === ORCHESTRATOR || settings.agent === OLD_ORCHESTRATOR;
  if (enabled && settings.agent !== ORCHESTRATOR) {
    writeJson(file, { ...settings, agent: ORCHESTRATOR });
    appendLine(path.join(root, '.gitignore'), '.claude/settings.local.json', /^\/?\.claude\/settings\.local\.json\s*$/m);
    changes.push('.claude/settings.local.json: your Claude sessions in this project start as the orchestrator (personal, git-ignored)');
  } else if (!enabled && isOurs) {
    delete settings.agent;
    writeJson(file, settings);
    changes.push('.claude/settings.local.json: sessions no longer start as the orchestrator');
  }
}

async function installSystem(options) {
  const source = findSource(options.from);
  const system = path.join(root, SYSTEM_DIR);
  const inPlace = path.resolve(source) === path.resolve(system);
  // Load the generators from the project's copy once it exists, so the team's edits apply.
  let project = await import(pathToFileURL(path.join(source, 'build', 'project.mjs')).href);
  if (!fs.existsSync(path.join(system, 'senior-ai.json'))) {
    const report = project.copySystem(source, root);
    const { version } = JSON.parse(readText(path.join(source, 'senior-ai.json')));
    changes.push(`${SYSTEM_DIR.split(path.sep).join('/')}/: the team copy of senior-ai ${version} (${report.added.length} files; edit and commit it)`);
  } else if (!inPlace) {
    notes.push(
      `${SYSTEM_DIR.split(path.sep).join('/')}/ already exists and was kept. To take a newer senior-ai into it: ` +
        'node .senior-ai/system/build/project.mjs --update',
    );
  }
  if (!inPlace) project = await import(pathToFileURL(path.join(system, 'build', 'project.mjs')).href);
  const tools = [...new Set([...(fs.existsSync(path.join(system, 'project.json')) ? project.readTools(root) : []), ...options.tools])];
  project.writeTools(root, tools);
  const written = project.buildProject(root, tools);
  if (written.length) changes.push(`generated from the copy for ${tools.join(' + ')}: ${summarize(written)}`);
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
createAgentsMd();
if (options.memory) createMemory();
updateGitignore(options);
await installSystem(options);
if (options.tools.includes('claude')) {
  importAgentsMd();
  setOrchestratorDefault(options.orchestratorDefault);
  notes.push('Claude Code: restart it in this project; the agents are `orchestrator`, `ui-builder`… (`claude --agent orchestrator`, `@agent-orchestrator`).');
}
if (options.tools.includes('vibe')) {
  notes.push("Vibe: trust this folder when Vibe asks, so it uses the project's copy; pick the orchestrator with Shift+Tab or `vibe --agent orchestrator`.");
}
notes.push('After editing .senior-ai/system/, run: node .senior-ai/system/build/project.mjs');

const toolNames = options.tools.join(' + ');
console.log(changes.length ? `senior-ai integrated for ${toolNames}:\n- ${changes.join('\n- ')}` : `senior-ai is already integrated for ${toolNames}; nothing changed.`);
for (const note of notes) console.log(note);
