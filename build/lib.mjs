// Reads the tool-neutral sources (departments/*/agents, departments/*/skills, AGENTS.md,
// senior-ai.json) that every generator turns into a tool-specific package.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const ROLES = ['maker', 'checker'];
const ENTRIES = ['main', 'subagent'];
const MODELS = ['session', 'small', 'mid', 'top'];

export function readMeta() {
  return JSON.parse(fs.readFileSync(path.join(REPO, 'senior-ai.json'), 'utf8'));
}

// Frontmatter is a flat list of `key: value` lines; values may be true/false or [a, b] lists.
export function parseFrontmatter(text, file) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) throw new Error(`${file}: missing frontmatter`);
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const sep = line.indexOf(':');
    if (sep === -1) throw new Error(`${file}: invalid frontmatter line "${line}"`);
    const key = line.slice(0, sep).trim();
    const raw = line.slice(sep + 1).trim();
    if (raw === 'true' || raw === 'false') data[key] = raw === 'true';
    else if (raw.startsWith('[') && raw.endsWith(']')) {
      data[key] = raw.slice(1, -1).split(',').map(item => item.trim()).filter(Boolean);
    } else data[key] = raw;
  }
  return { data, body: text.slice(match[0].length) };
}

const departmentsDir = path.join(REPO, 'departments');

export function listDepartments() {
  return fs
    .readdirSync(departmentsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
}

function subdirEntries(department, kind) {
  const dir = path.join(departmentsDir, department, kind);
  return fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : [];
}

export function readAgents() {
  const agents = [];
  for (const department of listDepartments()) {
    for (const entry of subdirEntries(department, 'agents')) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const file = path.join('departments', department, 'agents', entry.name);
      const { data, body } = parseFrontmatter(fs.readFileSync(path.join(REPO, file), 'utf8'), file);
      validateAgent(data, file, department, entry.name);
      agents.push({ ...data, body, file });
    }
  }
  assertUnique(agents.map(agent => agent.name), 'agent');
  return agents.sort((a, b) => a.name.localeCompare(b.name));
}

function validateAgent(agent, file, department, fileName) {
  const fail = message => {
    throw new Error(`${file}: ${message}`);
  };
  if (agent.name !== fileName.replace(/\.md$/, '')) fail('name must match the file name');
  if (agent.department !== department) fail(`department must be "${department}"`);
  if (!agent.description) fail('description is required');
  if (!ROLES.includes(agent.role)) fail(`role must be one of ${ROLES.join(', ')}`);
  if (!ENTRIES.includes(agent.entry)) fail(`entry must be one of ${ENTRIES.join(', ')}`);
  if (!MODELS.includes(agent.model)) fail(`model must be one of ${MODELS.join(', ')}`);
  if (typeof agent.needs_vision !== 'boolean') fail('needs_vision must be true or false');
}

export function readSkills() {
  const skills = [];
  for (const department of listDepartments()) {
    for (const entry of subdirEntries(department, 'skills')) {
      if (!entry.isDirectory()) continue;
      const dir = path.join('departments', department, 'skills', entry.name);
      const skillFile = path.join(REPO, dir, 'SKILL.md');
      if (!fs.existsSync(skillFile)) throw new Error(`${dir}: missing SKILL.md`);
      const { data } = parseFrontmatter(fs.readFileSync(skillFile, 'utf8'), `${dir}/SKILL.md`);
      if (data.name !== entry.name) throw new Error(`${dir}/SKILL.md: name must match the folder name`);
      skills.push({ name: entry.name, department, dir: path.join(REPO, dir) });
    }
  }
  assertUnique(skills.map(skill => skill.name), 'skill');
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

function assertUnique(names, kind) {
  const seen = new Set();
  for (const name of names) {
    if (seen.has(name)) throw new Error(`duplicate ${kind} name: ${name}`);
    seen.add(name);
  }
}

// Writes into a fresh output directory, so files removed from the sources disappear too.
export function resetDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

export function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

export const json = value => JSON.stringify(value, null, 2) + '\n';
