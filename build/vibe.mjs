// Generates the Mistral Vibe package (dist/vibe) from the tool-neutral sources. The installer
// copies it into Vibe's folder: agents/*.toml, prompts/*.md, skills/*, AGENTS.md and the update hook.

import fs from 'node:fs';
import path from 'node:path';
import { readAgents, readSkills, REPO, resetDir, writeFile } from './lib.mjs';

const OUT_DIR = 'dist/vibe';

function agentToml(agent) {
  const lines = [
    `# Generated from ${agent.file.split(path.sep).join('/')}; edit that file, not this one.`,
    agent.entry === 'main'
      ? `# Main agent: pick it with Shift+Tab, or start with \`vibe --agent ${agent.name}\``
      : '# Subagent: the main agent delegates to it with the task tool.',
  ];
  if (agent.entry === 'subagent') lines.push('agent_type = "subagent"');
  lines.push(`system_prompt_id = "${agent.name}"`);
  if (agent.role === 'checker') lines.push('disabled_tools = ["edit", "write_file"]');
  if (agent.needs_vision) {
    lines.push('# Needs a vision-capable model to read screenshots, for example:', '# active_model = "mistral-medium-3.5"');
  }
  return lines.join('\n') + '\n';
}

export function buildVibe(outRoot = REPO) {
  const out = path.join(outRoot, OUT_DIR);
  resetDir(out);
  fs.copyFileSync(path.join(REPO, 'AGENTS.md'), path.join(out, 'AGENTS.md'));
  for (const agent of readAgents()) {
    writeFile(path.join(out, 'agents', `${agent.name}.toml`), agentToml(agent));
    writeFile(path.join(out, 'prompts', `${agent.name}.md`), agent.body);
  }
  for (const skill of readSkills()) fs.cpSync(skill.dir, path.join(out, 'skills', skill.name), { recursive: true });
  writeFile(path.join(out, 'hooks', 'check-update.mjs'), fs.readFileSync(path.join(REPO, 'hooks', 'check-update.mjs')));
}
