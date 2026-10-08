// The generated Vibe package accounts for Vibe's delegation rules.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const VIBE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist', 'vibe');
const read = file => fs.readFileSync(path.join(VIBE, file), 'utf8');
const profiles = fs.readdirSync(path.join(VIBE, 'agents')).map(name => name.replace(/\.toml$/, ''));
const isSubagent = name => /agent_type = "subagent"/.test(read(`agents/${name}.toml`));

test('every profile has its prompt', () => {
  for (const name of profiles) assert.ok(fs.existsSync(path.join(VIBE, 'prompts', `${name}.md`)), name);
});

test('ui-builder is both a main agent and a subagent', () => {
  assert.equal(isSubagent('ui-builder'), false);
  assert.equal(isSubagent('ui-builder-subagent'), true);
});

test('main agents may delegate to every subagent without a prompt each time', () => {
  const subagents = profiles.filter(isSubagent);
  for (const main of profiles.filter(name => !isSubagent(name))) {
    const toml = read(`agents/${main}.toml`);
    for (const sub of subagents) assert.match(toml, new RegExp(`"${sub}"`), `${main} → ${sub}`);
  }
});

test('subagent makers hand the review back; checkers are read-only', () => {
  assert.match(read('prompts/api-developer.md'), /Ready for review by:/);
  assert.match(read('prompts/orchestrator.md'), /run the review loop yourself/);
  assert.doesNotMatch(read('prompts/db-reviewer.md'), /Ready for review by:/);
  assert.match(read('agents/db-reviewer.toml'), /disabled_tools = \["edit", "write_file"\]/);
});
