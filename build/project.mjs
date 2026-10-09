#!/usr/bin/env node
// Builds senior-ai into a project from the team's own copy of the system in .senior-ai/system/,
// so agents, skills, rules and hooks can be edited and committed with the project.
//
//   node .senior-ai/system/build/project.mjs            regenerate the tool files after editing the copy
//   node .senior-ai/system/build/project.mjs --check    fail if the tool files are out of date (for CI)
//   node .senior-ai/system/build/project.mjs --update [<senior-ai folder>]
//                                                      take a newer senior-ai into the copy, keeping the
//                                                      team's own edits, then regenerate
//
// Generated from the copy (do not edit these, edit the copy):
//   Claude Code: .claude/agents/, .claude/skills/, the senior-ai hooks in .claude/settings.json
//   Mistral Vibe: .vibe/agents/, .vibe/prompts/, .vibe/skills/, the senior-ai block in .vibe/hooks.toml
//   Both: the senior-ai rules block in AGENTS.md

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentFile, claudeHooks } from './claude.mjs';
import { readAgents, readHooks, readSkills, REPO } from './lib.mjs';
import { profileToml, promptFor, vibeProfiles } from './vibe.mjs';

export const SYSTEM_DIR = '.senior-ai/system';
// What a project copy holds: the sources and the generators, not the installer or the tests.
const COPIED = ['AGENTS.md', 'senior-ai.json', 'departments', 'hooks', 'build'];
const PROJECT_CONFIG = 'project.json'; // { "tools": ["claude", "vibe"] }
const BASELINE = 'baseline.json'; // what senior-ai shipped, to tell the team's edits from upstream changes
const GENERATED = 'generated.json'; // the files the last build wrote, to remove the ones that disappear
const PLUGIN = 'senior-ai@feres';
const RULES_START = '<!-- senior-ai:rules:start -->';
const RULES_END = '<!-- senior-ai:rules:end -->';
const TOML_START = '# >>> senior-ai project hooks (generated from .senior-ai/system; edit there) >>>';
const TOML_END = '# <<< senior-ai project hooks <<<';
const SYNC = `node ${SYSTEM_DIR}/build/project.mjs`;

const posix = file => file.split(path.sep).join('/');
const sha = content => createHash('sha256').update(String(content).replace(/\r\n/g, '\n')).digest('hex');
const readText = file => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
const sameText = (a, b) => a.replace(/\r\n/g, '\n') === b.replace(/\r\n/g, '\n');

function listFiles(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  if (fs.statSync(dir).isFile()) return [posix(path.relative(base, dir))];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.name !== '.DS_Store')
    .flatMap(entry => listFiles(path.join(dir, entry.name), base))
    .sort();
}

// Every file a senior-ai folder ships into a project copy, relative to that folder.
function shippedFiles(source) {
  return COPIED.flatMap(item => listFiles(path.join(source, item), source));
}

// ---- Copy and update ------------------------------------------------------------------------

// Puts senior-ai from `source` into <root>/.senior-ai/system. A first copy takes everything.
// An update replaces only the files the team did not change since the last copy, and reports the
// others so the team can merge them (the new version is left next to them as <file>.senior-ai-new).
export function copySystem(source, root) {
  const system = path.join(root, SYSTEM_DIR);
  const baselineFile = path.join(system, BASELINE);
  const previous = fs.existsSync(baselineFile) ? JSON.parse(readText(baselineFile)) : null;
  const report = { added: [], updated: [], removed: [], kept: [], conflicts: [] };
  const next = {};

  for (const rel of shippedFiles(source)) {
    const content = fs.readFileSync(path.join(source, rel));
    const target = path.join(system, rel);
    next[rel] = sha(content);
    const before = previous?.files[rel];
    if (!fs.existsSync(target)) {
      if (before) {
        report.kept.push(`${rel} (deleted by the team)`);
      } else {
        write(target, content);
        report.added.push(rel);
      }
      continue;
    }
    const current = sha(fs.readFileSync(target));
    if (current === next[rel]) continue;
    if (!previous || current === before) {
      write(target, content);
      report.updated.push(rel);
    } else if (before !== next[rel]) {
      write(`${target}.senior-ai-new`, content);
      report.conflicts.push(rel);
    } else report.kept.push(`${rel} (changed by the team)`);
  }
  for (const rel of Object.keys(previous?.files ?? {})) {
    if (rel in next) continue;
    const target = path.join(system, rel);
    if (fs.existsSync(target) && sha(fs.readFileSync(target)) === previous.files[rel]) {
      fs.rmSync(target);
      report.removed.push(rel);
    } else if (fs.existsSync(target)) report.kept.push(`${rel} (removed from senior-ai, changed by the team)`);
  }
  const { version } = JSON.parse(readText(path.join(source, 'senior-ai.json')));
  write(baselineFile, JSON.stringify({ version, files: next }, null, 2) + '\n');
  write(path.join(system, 'README.md'), systemReadme(version));
  return report;
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function systemReadme(version) {
  return `# senior-ai (this project's copy)

This folder is the team's own copy of [senior-ai](https://github.com/fereshenteti/senior-ai) ${version}:
agents, skills, rules and hooks. Edit it like any other code and commit it with the project.

- **Agents:** \`departments/<department>/agents/<name>.md\`
- **Skills:** \`departments/<department>/skills/<name>/SKILL.md\`
- **Team rules:** \`AGENTS.md\`
- **Hooks:** \`hooks/\`

After an edit, regenerate the files Claude Code and Mistral Vibe read (\`.claude/\`, \`.vibe/\`, and the
rules block in the project's \`AGENTS.md\`), then commit both:

\`\`\`
${SYNC}
\`\`\`

\`${SYNC} --check\` fails when they are out of date, for CI.
\`${SYNC} --update\` takes a newer senior-ai from this machine (the Claude Code marketplace copy, the
Vibe install, or a folder you name) and keeps the files the team changed.
`;
}

// ---- Generate the tool files ----------------------------------------------------------------

// The rules every session gets, adapted to a project copy: names have no plugin prefix.
function rulesBlock() {
  const rules = readText(path.join(REPO, 'AGENTS.md'))
    .replace(/^# Global engineering rules \(senior-ai\)/m, '# Team engineering rules (senior-ai)')
    .replace(
      /^In Claude Code, the skills and agents named below come from the `senior-ai` plugin.*$/m,
      `The agents and skills named below are this project's copy of senior-ai in \`${SYSTEM_DIR}/\`.`,
    )
    .trim();
  return `${RULES_START}\n<!-- Generated from ${SYSTEM_DIR}/AGENTS.md: edit that file, then run ${SYNC} -->\n\n${rules}\n${RULES_END}`;
}

function withBlock(current, block, start, end) {
  const pattern = new RegExp(`${escape(start)}[\\s\\S]*?${escape(end)}`);
  if (pattern.test(current)) return current.replace(pattern, () => block);
  return current.trim() ? `${current.trimEnd()}\n\n${block}\n` : `${block}\n`;
}
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function skillFiles(prefix) {
  const files = {};
  for (const skill of readSkills()) {
    for (const rel of listFiles(skill.dir)) files[`${prefix}/${skill.name}/${rel}`] = readText(path.join(skill.dir, rel));
  }
  return files;
}

// Whole files the build owns, by path relative to the project root.
function generatedFiles(tools) {
  const agents = readAgents();
  const files = {
    [`${SYSTEM_DIR}/hooks/checkers.json`]: JSON.stringify(agents.filter(a => a.role === 'checker').map(a => a.name), null, 2) + '\n',
  };
  if (tools.includes('claude')) {
    for (const agent of agents) files[`.claude/agents/${agent.name}.md`] = agentFile(agent);
    Object.assign(files, skillFiles('.claude/skills'));
  }
  if (tools.includes('vibe')) {
    const profiles = vibeProfiles(agents);
    const subagentNames = profiles.filter(p => p.kind === 'subagent').map(p => p.name);
    for (const profile of profiles) {
      files[`.vibe/agents/${profile.name}.toml`] = profileToml(profile, subagentNames);
      files[`.vibe/prompts/${profile.name}.md`] = promptFor(profile, profiles);
    }
    Object.assign(files, skillFiles('.vibe/skills'));
  }
  return files;
}

// Files the build shares with the team: it only rewrites its own part of them.
function mergedFiles(root, tools) {
  const merged = { 'AGENTS.md': withBlock(readText(path.join(root, 'AGENTS.md')), rulesBlock(), RULES_START, RULES_END) };
  if (tools.includes('claude')) merged['.claude/settings.json'] = claudeSettings(readText(path.join(root, '.claude', 'settings.json')));
  if (tools.includes('vibe')) merged['.vibe/hooks.toml'] = withBlock(readText(path.join(root, '.vibe', 'hooks.toml')), vibeHooksBlock(), TOML_START, TOML_END);
  return merged;
}

const ownHook = entry => entry.hooks?.some(hook => [hook.command, ...(hook.args ?? [])].some(arg => String(arg).includes(`${SYSTEM_DIR}/hooks/`)));

// The project's hooks run the copy's scripts, and the machine-wide plugin is off here so
// nothing runs twice; the team's other settings and hooks are kept.
function claudeSettings(current) {
  const settings = current.trim() ? JSON.parse(current) : {};
  const hooks = {};
  for (const [event, entries] of Object.entries(settings.hooks ?? {})) {
    const others = entries.filter(entry => !ownHook(entry));
    if (others.length) hooks[event] = others;
  }
  for (const [event, entries] of Object.entries(claudeHooks(`\${CLAUDE_PROJECT_DIR}/${SYSTEM_DIR}/hooks`, ['--project']))) {
    hooks[event] = [...(hooks[event] ?? []), ...entries];
  }
  settings.hooks = hooks;
  settings.enabledPlugins = { ...settings.enabledPlugins, [PLUGIN]: false };
  if (settings.extraKnownMarketplaces?.feres) {
    delete settings.extraKnownMarketplaces.feres;
    if (!Object.keys(settings.extraKnownMarketplaces).length) delete settings.extraKnownMarketplaces;
  }
  return JSON.stringify(settings, null, 2) + '\n';
}

// Vibe runs project hooks from the project root (only once the folder is trusted). The names
// differ from the machine-wide ones, which step aside while these run.
function vibeHooksBlock() {
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
          `command = ${JSON.stringify(`node "${SYSTEM_DIR}/hooks/${hook.script}" --tool vibe --project`)}`,
        ];
        if (event.match) lines.push(`match = ${JSON.stringify(event.match)}`);
        lines.push(`timeout = ${event.timeout.toFixed(1)}`, `description = ${JSON.stringify(hook.description)}`);
        return lines.join('\n');
      });
    });
  return [TOML_START, ...entries.flatMap(entry => [entry, '']), TOML_END].join('\n');
}

export function readTools(root) {
  const file = path.join(root, SYSTEM_DIR, PROJECT_CONFIG);
  return fs.existsSync(file) ? JSON.parse(readText(file)).tools : ['claude', 'vibe'];
}

export function writeTools(root, tools) {
  write(path.join(root, SYSTEM_DIR, PROJECT_CONFIG), JSON.stringify({ tools }, null, 2) + '\n');
}

// Writes the tool files. Returns the paths that changed.
export function buildProject(root, tools = readTools(root)) {
  const changed = [];
  const files = generatedFiles(tools);
  const generatedFile = path.join(root, SYSTEM_DIR, GENERATED);
  const before = fs.existsSync(generatedFile) ? JSON.parse(readText(generatedFile)) : [];
  for (const rel of before) {
    if (rel in files || !fs.existsSync(path.join(root, rel))) continue;
    fs.rmSync(path.join(root, rel));
    changed.push(`${rel} (removed)`);
  }
  for (const [rel, content] of Object.entries({ ...files, ...mergedFiles(root, tools) })) {
    const target = path.join(root, rel);
    if (sameText(readText(target), content)) continue;
    write(target, content);
    changed.push(rel);
  }
  write(generatedFile, JSON.stringify(Object.keys(files).sort(), null, 2) + '\n');
  return changed;
}

// The tool files that differ from what the copy generates.
export function staleFiles(root, tools = readTools(root)) {
  const expected = { ...generatedFiles(tools), ...mergedFiles(root, tools) };
  return Object.entries(expected)
    .filter(([rel, content]) => !sameText(readText(path.join(root, rel)), content))
    .map(([rel]) => rel);
}

// ---- Finding a newer senior-ai on this machine -----------------------------------------------

const isSeniorAi = dir => Boolean(dir) && fs.existsSync(path.join(dir, 'senior-ai.json')) && fs.existsSync(path.join(dir, 'departments'));

// The full senior-ai sources on this machine: the Claude Code marketplace copy, then the folder
// the Vibe install came from.
export function findSource() {
  const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  try {
    const known = JSON.parse(readText(path.join(claudeDir, 'plugins', 'known_marketplaces.json')));
    if (isSeniorAi(known.feres?.installLocation)) return known.feres.installLocation;
  } catch {}
  const vibeDir = process.env.VIBE_HOME || path.join(os.homedir(), '.vibe');
  const recorded = readText(path.join(vibeDir, 'senior-ai', 'SOURCE')).trim();
  return isSeniorAi(recorded) ? recorded : null;
}

function printReport(report) {
  const lines = [
    ...report.added.map(rel => `  + ${rel}`),
    ...report.updated.map(rel => `  ~ ${rel}`),
    ...report.removed.map(rel => `  - ${rel}`),
    ...report.kept.map(rel => `  = ${rel}: kept`),
  ];
  if (lines.length) console.log(lines.join('\n'));
  if (report.conflicts.length) {
    console.log('\nChanged by the team and by senior-ai; the team version is kept, the new one is next to it:');
    for (const rel of report.conflicts) console.log(`  ! ${SYSTEM_DIR}/${rel}  (new: ${rel}.senior-ai-new)`);
    console.log('Merge each pair, delete the .senior-ai-new file, then run this command again without --update.');
  }
}

async function main(argv) {
  const root = path.resolve(REPO, '..', '..');
  if (posix(path.relative(root, REPO)) !== SYSTEM_DIR) {
    console.error(`This command runs from a project's ${SYSTEM_DIR}/build/ folder.`);
    process.exit(2);
  }
  if (argv[0] === '--check') {
    const stale = staleFiles(root);
    if (stale.length) {
      console.error(`Out of date: ${stale.join(', ')}.\nRun: ${SYNC}`);
      process.exit(1);
    }
    console.log('The senior-ai tool files match the project copy.');
    return;
  }
  if (argv[0] === '--update') {
    const source = argv[1] ? path.resolve(argv[1]) : findSource();
    if (!isSeniorAi(source)) {
      console.error('No senior-ai found on this machine. Name its folder: --update <senior-ai folder>');
      process.exit(2);
    }
    const from = JSON.parse(readText(path.join(REPO, 'senior-ai.json'))).version;
    const to = JSON.parse(readText(path.join(source, 'senior-ai.json'))).version;
    console.log(`Updating the project copy of senior-ai from ${from} to ${to} (${source}):`);
    const report = copySystem(source, root);
    printReport(report);
    // Rebuild in a new process, so the generators just copied in are the ones that run.
    const rebuild = spawnSync(process.execPath, [path.join(root, SYSTEM_DIR, 'build', 'project.mjs')], { stdio: 'inherit' });
    process.exit(rebuild.status ?? 1);
  }
  if (argv.length) {
    console.error(`Usage: ${SYNC} [--check | --update [<senior-ai folder>]]`);
    process.exit(2);
  }
  const changed = buildProject(root);
  console.log(changed.length ? `Regenerated from ${SYSTEM_DIR}:\n  ${changed.join('\n  ')}` : 'Already up to date.');
}

// Run as a command (not imported). Real paths, as a temp or linked folder may be reached through a symlink.
const realPath = file => {
  try {
    return fs.realpathSync(file);
  } catch {
    return file;
  }
};
if (process.argv[1] && realPath(process.argv[1]) === realPath(fileURLToPath(import.meta.url))) await main(process.argv.slice(2));
