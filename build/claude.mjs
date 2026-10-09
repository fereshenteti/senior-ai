// Generates the Claude Code plugin (dist/claude) and the feres marketplace manifest
// (.claude-plugin/marketplace.json) from the tool-neutral sources.

import fs from 'node:fs';
import path from 'node:path';
import { copyHookScripts, json, readAgents, readHooks, readMeta, readSkills, REPO, resetDir, writeFile } from './lib.mjs';

const PLUGIN_DIR = 'dist/claude';
const CLAUDE_MODELS = { session: 'inherit', small: 'haiku', mid: 'sonnet', top: 'opus' };
const READ_ONLY_TOOLS = 'Read, Grep, Glob, Bash';

export function agentFile(agent) {
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
  const agents = readAgents();
  for (const agent of agents) writeFile(path.join(out, 'agents', `${agent.name}.md`), agentFile(agent));
  for (const skill of readSkills()) fs.cpSync(skill.dir, path.join(out, 'skills', skill.name), { recursive: true });

  copyHookScripts(path.join(out, 'hooks'));
  writeFile(path.join(out, 'hooks', 'checkers.json'), json(agents.filter(agent => agent.role === 'checker').map(agent => agent.name)));
  writeFile(path.join(out, 'hooks', 'hooks.json'), json({ hooks: claudeHooks() }));
}

// hooks.json in exec form (`node <script>`): no shell, so it runs the same on every OS.
// `scriptsDir` is how Claude Code finds the scripts: the plugin root, or the project's copy.
export function claudeHooks(scriptsDir = '${CLAUDE_PLUGIN_ROOT}/hooks', extraArgs = []) {
  const byEvent = {};
  for (const hook of readHooks().filter(hook => hook.claude)) {
    const { event, matcher, timeout } = hook.claude;
    const entry = {
      ...(matcher ? { matcher } : {}),
      hooks: [{ type: 'command', command: 'node', args: [`${scriptsDir}/${hook.script}`, '--tool', 'claude', ...extraArgs], timeout }],
    };
    (byEvent[event] ??= []).push(entry);
  }
  return byEvent;
}
