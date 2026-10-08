// Generates the Mistral Vibe package (dist/vibe) from the tool-neutral sources. The installer
// copies it into Vibe's folder: agents/*.toml, prompts/*.md, skills/*, AGENTS.md and the hooks.
//
// Vibe differs from Claude Code in ways the generated profiles and prompts account for:
//   - only subagents can be delegated to (the task tool refuses main agents), so an agent with
//     `entry: both` gets a main profile and a `<name>-subagent` profile;
//   - subagents cannot delegate (one level only), so makers running as subagents hand the review
//     loop back to the main agent, which runs the checkers;
//   - each delegation asks for approval unless the agent is on the task tool's allowlist, so main
//     agents allow senior-ai's own subagents in their profile (their actions still ask as usual).

import fs from 'node:fs';
import path from 'node:path';
import { copyHookScripts, readAgents, readSkills, REPO, resetDir, writeFile } from './lib.mjs';

const OUT_DIR = 'dist/vibe';
const BUILTIN_SUBAGENTS = ['explore'];
const tomlList = values => `[${values.map(value => JSON.stringify(value)).join(', ')}]`;

// One Vibe profile per role an agent can play.
function vibeProfiles(agents) {
  const profiles = [];
  for (const agent of agents) {
    if (agent.entry !== 'subagent') profiles.push({ agent, name: agent.name, kind: 'main' });
    if (agent.entry !== 'main') profiles.push({ agent, name: agent.entry === 'both' ? `${agent.name}-subagent` : agent.name, kind: 'subagent' });
  }
  return profiles;
}

function profileToml(profile, subagentNames) {
  const { agent, name, kind } = profile;
  const lines = [
    `# Generated from ${agent.file.split(path.sep).join('/')}; edit that file, not this one.`,
    kind === 'main'
      ? `# Main agent: pick it with Shift+Tab, or start with \`vibe --agent ${name}\``
      : '# Subagent: a main agent delegates to it with the task tool.',
  ];
  if (kind === 'subagent') lines.push('agent_type = "subagent"');
  lines.push(`system_prompt_id = "${name}"`);
  if (agent.role === 'checker') lines.push('disabled_tools = ["edit", "write_file"]');
  if (agent.needs_vision) {
    lines.push('# Needs a vision-capable model to read screenshots, for example:', '# active_model = "mistral-medium-3.5"');
  }
  if (kind === 'main') {
    lines.push(
      '',
      "# Delegating to senior-ai's subagents doesn't ask each time; what they do still follows your approvals.",
      '[tools.task]',
      `allowlist = ${tomlList([...BUILTIN_SUBAGENTS, ...subagentNames])}`,
    );
  }
  return lines.join('\n') + '\n';
}

function mainNote(profiles) {
  const renamed = profiles.filter(p => p.kind === 'subagent' && p.name !== p.agent.name).map(p => `\`${p.agent.name}\` → \`${p.name}\``);
  return [
    '',
    '## In Mistral Vibe',
    '- Delegate with the task tool. Only subagents can be delegated to' + (renamed.length ? `; use ${renamed.join(', ')}.` : '.'),
    '- Subagents cannot start other agents. When a maker subagent ends with "Ready for review by: …", run the review loop yourself: delegate to those checkers, send their Blocker and Major findings back to the maker as a new task, and re-check what failed, at most 3 rounds.',
    '- Each subagent runs on the model configured for it; you cannot choose a model per delegation.',
    '',
  ].join('\n');
}

const SUBAGENT_MAKER_NOTE = [
  '',
  '## In Mistral Vibe',
  'You run as a subagent and cannot start other agents. Do your self-checks (build, lint, tests), then end your report with `Ready for review by:` followed by the checkers your review step names. The agent that called you runs them and sends you their findings to fix.',
  '',
].join('\n');

function promptFor(profile, profiles) {
  const { agent, kind } = profile;
  if (kind === 'main') return agent.body + mainNote(profiles);
  if (agent.role === 'maker') return agent.body + SUBAGENT_MAKER_NOTE;
  return agent.body;
}

export function buildVibe(outRoot = REPO) {
  const out = path.join(outRoot, OUT_DIR);
  resetDir(out);
  fs.copyFileSync(path.join(REPO, 'AGENTS.md'), path.join(out, 'AGENTS.md'));
  const profiles = vibeProfiles(readAgents());
  const subagentNames = profiles.filter(p => p.kind === 'subagent').map(p => p.name);
  for (const profile of profiles) {
    writeFile(path.join(out, 'agents', `${profile.name}.toml`), profileToml(profile, subagentNames));
    writeFile(path.join(out, 'prompts', `${profile.name}.md`), promptFor(profile, profiles));
  }
  for (const skill of readSkills()) fs.cpSync(skill.dir, path.join(out, 'skills', skill.name), { recursive: true });
  copyHookScripts(path.join(out, 'hooks'));
  writeFile(path.join(out, 'hooks', 'registry.json'), fs.readFileSync(path.join(REPO, 'hooks', 'registry.json')));
  const checkers = readAgents().filter(agent => agent.role === 'checker').map(agent => agent.name);
  writeFile(path.join(out, 'hooks', 'checkers.json'), JSON.stringify(checkers, null, 2) + '\n');
}
