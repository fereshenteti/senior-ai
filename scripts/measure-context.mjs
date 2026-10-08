#!/usr/bin/env node
// Estimates what senior-ai adds to every session before any work: the injected rules plus the
// one-line descriptions of agents and skills. Skill bodies and references load only when used.
// Tokens are estimated at ~4 characters per token (English prose and code).
//   node scripts/measure-context.mjs

import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter, readAgents, readSkills, REPO } from '../build/lib.mjs';

const tokens = text => Math.round(text.length / 4);

const rules = fs.readFileSync(path.join(REPO, 'AGENTS.md'), 'utf8');
const agents = readAgents();
const skills = readSkills().map(skill => {
  const { data, body } = parseFrontmatter(fs.readFileSync(path.join(skill.dir, 'SKILL.md'), 'utf8'), skill.name);
  return { ...skill, description: data.description, body };
});

const rows = [
  ['Global rules (AGENTS.md, injected at session start)', tokens(rules)],
  [`Agent descriptions (${agents.length})`, agents.reduce((sum, agent) => sum + tokens(`${agent.name}: ${agent.description}`), 0)],
  [`Skill descriptions (${skills.length})`, skills.reduce((sum, skill) => sum + tokens(`${skill.name}: ${skill.description}`), 0)],
];
const total = rows.reduce((sum, [, n]) => sum + n, 0);

console.log('Loaded in every session (estimate):');
for (const [label, n] of rows) console.log(`  ${String(n).padStart(6)}  ${label}`);
console.log(`  ${String(total).padStart(6)}  total`);
console.log('\nLoaded only when used (largest skill bodies):');
for (const skill of [...skills].sort((a, b) => b.body.length - a.body.length).slice(0, 5)) {
  console.log(`  ${String(tokens(skill.body)).padStart(6)}  ${skill.name}`);
}
