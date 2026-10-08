#!/usr/bin/env node
// Integrates senior-ai into the project in the current working directory. Safe to re-run: it
// merges into existing files and never overwrites them.
//
//   node setup-project.mjs --tool claude|vibe|both
//                          [--memory yes|no] [--ignore-memory yes|no] [--orchestrator-default yes|no]
//
// Every tool:
//   - AGENTS.md: project facts template (created only if missing); both tools read it
//   - .senior-ai/status.md: the project memory board (--memory, default yes)
//   - .gitignore: .visual-check/, and .senior-ai/ when --ignore-memory yes
// Claude Code:
//   - .claude/settings.json: registers the feres marketplace and enables senior-ai for the team
//   - CLAUDE.md: imports AGENTS.md
//   - .claude/settings.local.json: the orchestrator as this user's default agent (--orchestrator-default yes)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKETPLACE = 'feres';
const PLUGIN = `senior-ai@${MARKETPLACE}`;
const REPO = 'fereshenteti/senior-ai';
const ORCHESTRATOR = 'senior-ai:orchestrator';
const SKILL_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const AGENTS_TEMPLATE = path.join(SKILL_DIR, 'AGENTS.project.md');
const STATUS_TEMPLATE = path.join(SKILL_DIR, '..', 'project-memory', 'templates', 'status.md');
const TOOLS = { claude: ['claude'], vibe: ['vibe'], both: ['claude', 'vibe'] };
const USAGE =
  'Usage: node setup-project.mjs --tool claude|vibe|both [--memory yes|no] [--ignore-memory yes|no] [--orchestrator-default yes|no]';

const root = process.cwd();
const changes = [];
const notes = [];

function fail(message) {
  console.error(`${message}\n${USAGE}`);
  process.exit(2);
}

function parseArgs(argv) {
  const options = { tools: null, memory: true, ignoreMemory: false, orchestratorDefault: false };
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
    else fail(`Unknown option: ${flag}`);
    i++;
  }
  if (!options.tools) fail('--tool is required');
  return options;
}

function appendLine(file, line, pattern) {
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
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
    fail(`Cannot parse ${path.relative(root, file)}: ${err.message}. Fix it and re-run.`);
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
  if (options.memory && options.ignoreMemory && appendLine(file, '.senior-ai/', /^\/?\.senior-ai\/?\s*$/m)) {
    changes.push('.gitignore: ignores .senior-ai/ (the project memory stays on this machine)');
  }
}

function enableClaudePlugin() {
  const file = path.join(root, '.claude', 'settings.json');
  const settings = readJson(file);
  const before = JSON.stringify(settings);
  settings.extraKnownMarketplaces = {
    ...settings.extraKnownMarketplaces,
    [MARKETPLACE]: { source: { source: 'github', repo: REPO } },
  };
  settings.enabledPlugins = { ...settings.enabledPlugins, [PLUGIN]: true };
  if (JSON.stringify(settings) === before) return;
  writeJson(file, settings);
  changes.push(`.claude/settings.json: ${MARKETPLACE} marketplace registered and ${PLUGIN} enabled for the team`);
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
  } else if (!enabled && settings.agent === ORCHESTRATOR) {
    delete settings.agent;
    writeJson(file, settings);
    changes.push('.claude/settings.local.json: sessions no longer start as the orchestrator');
  }
}

const options = parseArgs(process.argv.slice(2));
createAgentsMd();
if (options.memory) createMemory();
updateGitignore(options);
if (options.tools.includes('claude')) {
  enableClaudePlugin();
  importAgentsMd();
  setOrchestratorDefault(options.orchestratorDefault);
}
if (options.tools.includes('vibe')) {
  notes.push('Vibe: each Vibe user installs senior-ai once per machine; pick the orchestrator with Shift+Tab or `vibe --agent orchestrator`.');
}

const toolNames = options.tools.join(' + ');
console.log(changes.length ? `senior-ai integrated for ${toolNames}:\n- ${changes.join('\n- ')}` : `senior-ai is already integrated for ${toolNames}; nothing changed.`);
for (const note of notes) console.log(note);
