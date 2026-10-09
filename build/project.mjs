// Installs senior-ai into a project in each AI tool's own project folders, so the team can edit the
// agents, skills, rules and hooks there and commit them with the project. setup-project runs it.
//
//   Mistral Vibe: .vibe/agents/*.toml + .vibe/prompts/*.md (Vibe's profile/prompt pair), .vibe/skills/,
//                 .vibe/hooks/ (scripts) and a senior-ai block in .vibe/hooks.toml
//   Claude Code:  .claude/agents/, .claude/skills/, .claude/hooks/ (scripts) and the senior-ai hooks in
//                 .claude/settings.json (the machine-wide plugin is turned off there)
//   Both tools:   skills and hook scripts exist once, in .claude/; .vibe/config.toml points Vibe's
//                 skill_paths at .claude/skills and .vibe/hooks.toml runs the scripts in .claude/hooks.
//                 Only the agents exist in each tool's format.
//   Every tool:   a senior-ai rules block in AGENTS.md.
//
// <hooks folder>/senior-ai.lock.json records the version and what senior-ai wrote, so an update replaces
// only the files the team did not change (a file both changed gets the new version next to it as
// <file>.senior-ai-new).

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { agentFile, claudeHooks } from './claude.mjs';
import { readAgents, readHooks, readMeta, readSkills, REPO } from './lib.mjs';
import { profileToml, promptFor, vibeProfiles } from './vibe.mjs';

const LOCK = 'senior-ai.lock.json';
const PLUGIN = 'senior-ai@feres';
const RULES_START = '<!-- senior-ai:rules:start -->';
const RULES_END = '<!-- senior-ai:rules:end -->';
const TOML_START = '# >>> senior-ai project hooks (installed by setup-project) >>>';
const TOML_END = '# <<< senior-ai project hooks <<<';
const CONFIG_START = '# >>> senior-ai: skills shared with Claude Code >>>';
const CONFIG_END = '# <<< senior-ai <<<';
// An earlier layout kept a full copy in .senior-ai/system/; the next run removes it.
const OLD_SYSTEM = '.senior-ai/system';
const OLD_TOML = ['# >>> senior-ai project hooks (generated from .senior-ai/system; edit there) >>>', TOML_END];

const posix = file => file.split(path.sep).join('/');
const sha = content => createHash('sha256').update(String(content).replace(/\r\n/g, '\n')).digest('hex');
const readText = file => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
const sameText = (a, b) => a.replace(/\r\n/g, '\n') === b.replace(/\r\n/g, '\n');
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function listFiles(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.name !== '.DS_Store')
    .flatMap(entry => (entry.isDirectory() ? listFiles(path.join(dir, entry.name), base) : [posix(path.relative(base, path.join(dir, entry.name)))]))
    .sort();
}

// Where the files both tools use live: in .claude/ when Claude Code is used (it reads skills only
// from there), otherwise in .vibe/.
export function layout(tools) {
  const home = tools.includes('claude') ? '.claude' : '.vibe';
  return { skills: `${home}/skills`, hooks: `${home}/hooks` };
}

// ---- Files senior-ai owns whole -----------------------------------------------------------------

function ownedFiles(tools) {
  const { skills, hooks } = layout(tools);
  const agents = readAgents();
  const files = {};
  for (const skill of readSkills()) {
    for (const rel of listFiles(skill.dir)) files[`${skills}/${skill.name}/${rel}`] = readText(path.join(skill.dir, rel));
  }
  for (const name of fs.readdirSync(path.join(REPO, 'hooks')).filter(name => name.endsWith('.mjs'))) {
    files[`${hooks}/${name}`] = readText(path.join(REPO, 'hooks', name));
  }
  files[`${hooks}/checkers.json`] = JSON.stringify(agents.filter(a => a.role === 'checker').map(a => a.name), null, 2) + '\n';
  if (tools.includes('claude')) {
    for (const agent of agents) files[`.claude/agents/${agent.name}.md`] = agentFile(agent);
  }
  if (tools.includes('vibe')) {
    const profiles = vibeProfiles(agents);
    const subagentNames = profiles.filter(p => p.kind === 'subagent').map(p => p.name);
    for (const profile of profiles) {
      files[`.vibe/agents/${profile.name}.toml`] = profileToml(profile, subagentNames);
      files[`.vibe/prompts/${profile.name}.md`] = promptFor(profile, profiles);
    }
  }
  return files;
}

// ---- Files shared with the team: senior-ai only rewrites its own part ---------------------------

function withBlock(current, block, start, end) {
  const pattern = new RegExp(`${escape(start)}[\\s\\S]*?${escape(end)}\\n?`);
  if (pattern.test(current)) return current.replace(pattern, () => `${block}\n`);
  return current.trim() ? `${current.trimEnd()}\n\n${block}\n` : `${block}\n`;
}

function withoutBlock(current, start, end) {
  const pattern = new RegExp(`\\n*${escape(start)}[\\s\\S]*?${escape(end)}\\n?`);
  return pattern.test(current) ? current.replace(pattern, '\n').replace(/^\n+/, '') : current;
}

// The rules block keeps the team's edits: it is written once, and replaced only by an update.
function rulesBlock(tools) {
  const where = tools.map(tool => `\`.${tool}/\``).join(' and ');
  const rules = readText(path.join(REPO, 'AGENTS.md'))
    .replace(/^# Global engineering rules \(senior-ai\)/m, '# Team engineering rules (senior-ai)')
    .replace(/^In Claude Code, the skills and agents named below come from the `senior-ai` plugin.*$/m, `The agents and skills named below are this project's own, in ${where}.`)
    .trim();
  return `${RULES_START}\n${rules}\n${RULES_END}`;
}

const ownClaudeHook = entry => entry.hooks?.some(hook => (hook.args ?? []).includes('--project'));

function claudeSettings(current, tools) {
  const settings = current.trim() ? JSON.parse(current) : {};
  const hooks = {};
  for (const [event, entries] of Object.entries(settings.hooks ?? {})) {
    const others = entries.filter(entry => !ownClaudeHook(entry));
    if (others.length) hooks[event] = others;
  }
  for (const [event, entries] of Object.entries(claudeHooks(`\${CLAUDE_PROJECT_DIR}/${layout(tools).hooks}`, ['--project']))) {
    hooks[event] = [...(hooks[event] ?? []), ...entries];
  }
  settings.hooks = hooks;
  // The project has its own copy; the machine-wide plugin would run everything twice.
  settings.enabledPlugins = { ...settings.enabledPlugins, [PLUGIN]: false };
  if (settings.extraKnownMarketplaces?.feres) {
    delete settings.extraKnownMarketplaces.feres;
    if (!Object.keys(settings.extraKnownMarketplaces).length) delete settings.extraKnownMarketplaces;
  }
  return JSON.stringify(settings, null, 2) + '\n';
}

// Vibe runs project hooks from the project root, once the folder is trusted. The names differ from
// the machine-wide ones, which step aside while these run.
function vibeHooksBlock(tools) {
  const scripts = layout(tools).hooks;
  const entries = readHooks()
    .filter(hook => hook.vibe)
    .flatMap(hook => {
      const events = [hook.vibe].flat();
      return events.map(event => {
        const suffix = events.length > 1 ? `-${event.type.replace('_', '-')}` : '';
        const lines = [
          '[[hooks]]',
          `name = ${JSON.stringify(`senior-ai-project-${hook.id}${suffix}`)}`,
          `type = ${JSON.stringify(event.type)}`,
          `command = ${JSON.stringify(`node "${scripts}/${hook.script}" --tool vibe --project`)}`,
        ];
        if (event.match) lines.push(`match = ${JSON.stringify(event.match)}`);
        lines.push(`timeout = ${event.timeout.toFixed(1)}`, `description = ${JSON.stringify(hook.description)}`);
        return lines.join('\n');
      });
    });
  return [TOML_START, ...entries.flatMap(entry => [entry, '']), TOML_END].join('\n');
}

// Points Vibe at the skills in .claude/skills. skill_paths is a top-level key, so the block goes
// first in the file. Returns null when the team keeps its own skill_paths (they add it there).
function vibeConfig(current, tools) {
  const cleaned = withoutBlock(current, CONFIG_START, CONFIG_END);
  if (!tools.includes('claude')) return cleaned;
  if (/^\s*skill_paths\s*=/m.test(cleaned)) return null;
  const block = `${CONFIG_START}\nskill_paths = [".claude/skills"]\n${CONFIG_END}\n`;
  return cleaned.trim() ? `${block}\n${cleaned}` : block;
}

function sharedFiles(root, tools, { update }) {
  const agentsMd = readText(path.join(root, 'AGENTS.md'));
  const hasRules = agentsMd.includes(RULES_START);
  const files = {};
  if (!hasRules || update) files['AGENTS.md'] = withBlock(agentsMd, rulesBlock(tools), RULES_START, RULES_END);
  if (tools.includes('claude')) files['.claude/settings.json'] = claudeSettings(readText(path.join(root, '.claude', 'settings.json')), tools);
  if (tools.includes('vibe')) {
    const toml = withoutBlock(readText(path.join(root, '.vibe', 'hooks.toml')), ...OLD_TOML);
    files['.vibe/hooks.toml'] = withBlock(toml, vibeHooksBlock(tools), TOML_START, TOML_END);
    const configFile = path.join(root, '.vibe', 'config.toml');
    const config = vibeConfig(readText(configFile), tools);
    if (config !== null && (config.trim() || fs.existsSync(configFile))) files['.vibe/config.toml'] = config;
  }
  return files;
}

// ---- Install and update -----------------------------------------------------------------------

export function readLock(root) {
  for (const tools of [['claude'], ['vibe']]) {
    const file = path.join(root, layout(tools).hooks, LOCK);
    if (fs.existsSync(file)) return JSON.parse(readText(file));
  }
  return null;
}

// Installs senior-ai in `root` for `tools`. Without `update`, files that already exist stay as they
// are (they are the team's); with it, files senior-ai wrote and the team did not change are
// replaced, and the others get the new version next to them. Returns what happened.
export function installProject(root, tools, { update = false } = {}) {
  const previous = readLock(root)?.files ?? {};
  const report = { added: [], updated: [], removed: [], kept: [], conflicts: [], migrated: [] };
  const next = {};

  for (const [rel, content] of Object.entries(ownedFiles(tools))) {
    const target = path.join(root, rel);
    next[rel] = sha(content);
    if (!fs.existsSync(target)) {
      if (previous[rel] && !update) continue; // the team deleted it
      write(target, content);
      report.added.push(rel);
      continue;
    }
    const current = readText(target);
    if (sameText(current, content)) continue;
    if (!update) {
      report.kept.push(rel);
    } else if (sha(current) === previous[rel]) {
      write(target, content);
      report.updated.push(rel);
    } else {
      write(`${target}.senior-ai-new`, content);
      report.conflicts.push(rel);
    }
  }
  // Files senior-ai no longer ships, or that moved because the tools changed, if the team left them as they were.
  for (const [rel, hash] of Object.entries(previous)) {
    if (rel in next) continue;
    const target = path.join(root, rel);
    if (fs.existsSync(target) && sha(readText(target)) === hash) {
      fs.rmSync(target);
      report.removed.push(rel);
      removeEmptyParents(path.dirname(target), root);
    }
  }
  for (const [rel, content] of Object.entries(sharedFiles(root, tools, { update }))) {
    if (sameText(readText(path.join(root, rel)), content)) continue;
    write(path.join(root, rel), content);
    report.updated.push(rel);
  }
  migrateOldCopy(root, next, report);
  const lockFile = path.join(root, layout(tools).hooks, LOCK);
  for (const other of [['vibe'], ['claude']]) {
    const stale = path.join(root, layout(other).hooks, LOCK);
    if (stale !== lockFile && fs.existsSync(stale)) fs.rmSync(stale);
  }
  write(lockFile, JSON.stringify({ version: readMeta().version, tools, files: next }, null, 2) + '\n');
  return report;
}

function removeEmptyParents(dir, root) {
  while (path.resolve(dir) !== path.resolve(root) && fs.existsSync(dir) && !fs.readdirSync(dir).length) {
    fs.rmdirSync(dir);
    dir = path.dirname(dir);
  }
}

// The earlier layout generated every tool's files from a copy in .senior-ai/system/. The files this
// layout doesn't use go, and so does the copy.
function migrateOldCopy(root, next, report) {
  const system = path.join(root, OLD_SYSTEM);
  if (!fs.existsSync(path.join(system, 'senior-ai.json'))) return;
  let generated = [];
  try {
    generated = JSON.parse(readText(path.join(system, 'generated.json')));
  } catch {}
  for (const rel of generated) {
    const target = path.join(root, rel);
    if (rel in next || !fs.existsSync(target)) continue;
    fs.rmSync(target);
    removeEmptyParents(path.dirname(target), root);
  }
  fs.rmSync(system, { recursive: true, force: true });
  report.migrated.push(`${OLD_SYSTEM}/ removed: senior-ai now lives in the tools' own folders`);
}
