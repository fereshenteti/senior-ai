#!/usr/bin/env node
// Integrates senior-ai into the project in the current working directory. Safe to re-run.
//   node setup-project.mjs --tool claude|vibe|both
// Every tool:
//   - AGENTS.md: project facts template (created only if missing); Vibe and Claude Code both use it
//   - .gitignore: ignores the visual-check output
// Claude Code:
//   - .claude/settings.json: registers the feres marketplace and enables senior-ai for everyone who opens the project
//   - CLAUDE.md: imports AGENTS.md (created or appended)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKETPLACE = 'feres';
const PLUGIN = `senior-ai@${MARKETPLACE}`;
const REPO = 'fereshenteti/senior-ai';
const TEMPLATE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'AGENTS.project.md');
const TOOLS = { claude: ['claude'], vibe: ['vibe'], both: ['claude', 'vibe'] };

const root = process.cwd();
const changes = [];

function parseTools(argv) {
  const i = argv.indexOf('--tool');
  const value = i === -1 ? undefined : argv[i + 1];
  if (!TOOLS[value]) {
    console.error('Usage: node setup-project.mjs --tool claude|vibe|both');
    process.exit(2);
  }
  return TOOLS[value];
}

function appendLine(file, line, pattern) {
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (pattern.test(current)) return false;
  const separator = current && !current.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(file, `${current}${separator}${line}\n`);
  return true;
}

function createAgentsMd() {
  const file = path.join(root, 'AGENTS.md');
  if (fs.existsSync(file)) return;
  fs.copyFileSync(TEMPLATE, file);
  changes.push('AGENTS.md: created from the project template (fill in the placeholders)');
}

function ignoreVisualCheck() {
  if (appendLine(path.join(root, '.gitignore'), '.visual-check/', /^\/?\.visual-check\/?\s*$/m)) {
    changes.push('.gitignore: ignores .visual-check/');
  }
}

function enableClaudePlugin() {
  const file = path.join(root, '.claude', 'settings.json');
  let settings = {};
  if (fs.existsSync(file)) {
    try {
      settings = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      console.error(`Cannot parse ${file}: ${err.message}. Fix it and re-run.`);
      process.exit(2);
    }
  }
  const before = JSON.stringify(settings);
  settings.extraKnownMarketplaces = {
    ...settings.extraKnownMarketplaces,
    [MARKETPLACE]: { source: { source: 'github', repo: REPO } },
  };
  settings.enabledPlugins = { ...settings.enabledPlugins, [PLUGIN]: true };
  if (JSON.stringify(settings) === before) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
  changes.push(`.claude/settings.json: ${MARKETPLACE} marketplace registered and ${PLUGIN} enabled`);
}

function importAgentsMd() {
  const file = path.join(root, 'CLAUDE.md');
  const existed = fs.existsSync(file) && fs.readFileSync(file, 'utf8').trim() !== '';
  if (appendLine(file, existed ? '\n@AGENTS.md' : '@AGENTS.md', /^@AGENTS\.md\s*$/m)) {
    changes.push(`CLAUDE.md: ${existed ? 'now imports' : 'created, imports'} AGENTS.md`);
  }
}

const tools = parseTools(process.argv.slice(2));
createAgentsMd();
ignoreVisualCheck();
if (tools.includes('claude')) {
  enableClaudePlugin();
  importAgentsMd();
}

console.log(changes.length
  ? `senior-ai integrated for ${tools.join(' + ')}:\n- ${changes.join('\n- ')}`
  : `senior-ai is already integrated for ${tools.join(' + ')}; nothing changed.`);
