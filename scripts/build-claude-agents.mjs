#!/usr/bin/env node
// Builds the Claude Code plugin agents (agents/*.md) from adapters/claude/agents/ (frontmatter)
// and prompts/ (shared system prompts). Run after changing either, and commit the result.
//   node scripts/build-claude-agents.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const headers = path.join(REPO, 'adapters', 'claude', 'agents');
const out = path.join(REPO, 'agents');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
const names = fs.readdirSync(headers).filter(name => name.endsWith('.md')).sort();
for (const name of names) {
  const header = fs.readFileSync(path.join(headers, name), 'utf8');
  const prompt = fs.readFileSync(path.join(REPO, 'prompts', name), 'utf8');
  fs.writeFileSync(path.join(out, name), `${header}\n${prompt}`);
}
console.log(`Built ${names.length} agents in agents/`);
