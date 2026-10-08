// Generates the Claude Code plugin (dist/claude) and the feres marketplace manifest
// (.claude-plugin/marketplace.json) from the tool-neutral sources.

import fs from 'node:fs';
import path from 'node:path';
import { json, readAgents, readMeta, readSkills, REPO, resetDir, writeFile } from './lib.mjs';

const PLUGIN_DIR = 'dist/claude';
const CLAUDE_MODELS = { session: 'inherit', small: 'haiku', mid: 'sonnet', top: 'opus' };
const READ_ONLY_TOOLS = 'Read, Grep, Glob, Bash';

function agentFile(agent) {
  const lines = ['---', `name: ${agent.name}`, `description: ${agent.description}`];
  if (agent.role === 'checker') lines.push(`tools: ${READ_ONLY_TOOLS}`);
  lines.push(`model: ${CLAUDE_MODELS[agent.model]}`, '---', '');
  return `${lines.join('\n')}\n${agent.body}`;
}

export function buildClaude(outRoot = REPO) {
  const meta = readMeta();
  const out = path.join(outRoot, PLUGIN_DIR);
  resetDir(out);

  const { marketplace, ...plugin } = meta;
  writeFile(path.join(out, '.claude-plugin', 'plugin.json'), json({
    name: plugin.name,
    displayName: plugin.displayName,
    version: plugin.version,
    description: plugin.description,
    author: plugin.author,
    repository: plugin.repository,
  }));
  writeFile(path.join(outRoot, '.claude-plugin', 'marketplace.json'), json({
    name: marketplace.name,
    owner: plugin.author,
    description: marketplace.description,
    plugins: [{
      name: plugin.name,
      displayName: plugin.displayName,
      version: plugin.version,
      description: plugin.description,
      source: `./${PLUGIN_DIR}`,
    }],
  }));

  fs.copyFileSync(path.join(REPO, 'AGENTS.md'), path.join(out, 'AGENTS.md'));
  for (const agent of readAgents()) writeFile(path.join(out, 'agents', `${agent.name}.md`), agentFile(agent));
  for (const skill of readSkills()) fs.cpSync(skill.dir, path.join(out, 'skills', skill.name), { recursive: true });
  fs.cpSync(path.join(REPO, 'hooks'), path.join(out, 'hooks'), { recursive: true });
}
