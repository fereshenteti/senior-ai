#!/usr/bin/env node
// Integrates senior-ai into the project in the current working directory. Safe to re-run:
//   - .claude/settings.json: registers the senior-ai marketplace and enables the plugin for everyone who opens the project
//   - AGENTS.md: project facts template (created only if missing)
//   - CLAUDE.md: imports AGENTS.md (created or appended)
//   - .gitignore: ignores the visual-check output

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKETPLACE = 'senior-ai';
const PLUGIN = `senior-ai@${MARKETPLACE}`;
const REPO = 'fereshenteti/senior-ai';
const TEMPLATE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'AGENTS.md');

const root = process.cwd();
const changes = [];

function updateSettings() {
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
  changes.push('.claude/settings.json: senior-ai marketplace registered and plugin enabled');
}

function createAgentsMd() {
  const file = path.join(root, 'AGENTS.md');
  if (fs.existsSync(file)) return;
  fs.copyFileSync(TEMPLATE, file);
  changes.push('AGENTS.md: created from the project template (fill in the TODOs)');
}

function linkClaudeMd() {
  const file = path.join(root, 'CLAUDE.md');
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (/^@AGENTS\.md\s*$/m.test(current)) return;
  const separator = current && !current.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(file, `${current}${separator}${current ? '\n' : ''}@AGENTS.md\n`);
  changes.push(`CLAUDE.md: ${current ? 'now imports' : 'created, imports'} AGENTS.md`);
}

function ignoreVisualCheck() {
  const file = path.join(root, '.gitignore');
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (/^\/?\.visual-check\/?\s*$/m.test(current)) return;
  const separator = current && !current.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(file, `${current}${separator}.visual-check/\n`);
  changes.push('.gitignore: ignores .visual-check/');
}

updateSettings();
createAgentsMd();
linkClaudeMd();
ignoreVisualCheck();

console.log(changes.length ? `senior-ai integrated:\n- ${changes.join('\n- ')}` : 'senior-ai is already integrated; nothing changed.');
