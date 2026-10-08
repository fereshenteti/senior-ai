// Mistral Vibe: senior-ai's generated package (dist/vibe) is copied (or linked) into Vibe's
// folder; extras are [[mcp_servers]] entries in one marked block of config.toml.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hasForVibe, VIBE_BLOCK, vibeServerNames, vibeServerToml } from './extras.mjs';
import { pretty, say } from './ui.mjs';

const mcpName = extra => extra.mcp.name ?? extra.id;
const configFile = vibeDir => path.join(vibeDir, 'config.toml');
const readConfig = vibeDir => (fs.existsSync(configFile(vibeDir)) ? fs.readFileSync(configFile(vibeDir), 'utf8') : '');

// Server names inside senior-ai's own block.
function ourServerNames(text) {
  const names = new Set();
  let inOurs = false;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === VIBE_BLOCK[0]) inOurs = true;
    else if (trimmed === VIBE_BLOCK[1]) inOurs = false;
    else if (inOurs) {
      const match = /^name\s*=\s*"([^"]+)"/.exec(trimmed);
      if (match) names.add(match[1]);
    }
  }
  return names;
}

export function vibeExtrasStatus(extras, vibeDir) {
  const text = readConfig(vibeDir);
  const userNames = vibeServerNames(text);
  const ours = ourServerNames(text);
  return extras.map(extra => ({
    extra,
    present: hasForVibe(extra, userNames) || ours.has(mcpName(extra)),
    bySeniorAi: ours.has(mcpName(extra)),
  }));
}

export function installVibe({ ops, src, vibeDir, version }) {
  say(`Mistral Vibe: ${pretty(vibeDir)}`);
  if (!fs.existsSync(vibeDir)) say(`  note: ${pretty(vibeDir)} does not exist yet; creating it.`);

  const entries = (dir, filter) =>
    fs
      .readdirSync(path.join(src, dir), { withFileTypes: true })
      .filter(filter)
      .map(entry => entry.name)
      .sort();
  for (const name of entries('skills', e => e.isDirectory())) ops.place(path.join(src, 'skills', name), path.join(vibeDir, 'skills', name));
  for (const name of entries('prompts', e => e.isFile() && e.name.endsWith('.md'))) {
    ops.place(path.join(src, 'prompts', name), path.join(vibeDir, 'prompts', name));
  }
  for (const name of entries('agents', e => e.isFile() && e.name.endsWith('.toml'))) {
    ops.place(path.join(src, 'agents', name), path.join(vibeDir, 'agents', name));
  }

  // Global rules: install AGENTS.md, or append to the user's own AGENTS.md if they have one.
  const agents = path.join(vibeDir, 'AGENTS.md');
  const userOwned = fs.existsSync(agents) && !fs.lstatSync(agents).isSymbolicLink() && !ops.previousBackup(agents);
  if (userOwned) {
    ops.addBlock(agents, fs.readFileSync(path.join(src, 'AGENTS.md'), 'utf8'), 'block');
    say(`  appended senior-ai rules to your existing ${pretty(agents)}`);
  } else {
    ops.place(path.join(src, 'AGENTS.md'), agents);
  }

  // Hooks: the scripts go to <vibe>/senior-ai/ (always copied: hooks must not depend on this
  // folder), with the installed version and the source folder for the update notice.
  const hooksDir = path.join(vibeDir, 'senior-ai');
  const hookSrc = path.join(src, 'hooks');
  for (const name of fs.readdirSync(hookSrc).filter(name => name.endsWith('.mjs')).sort()) {
    ops.place(path.join(hookSrc, name), path.join(hooksDir, name), 'copy');
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'senior-ai-'));
  fs.writeFileSync(path.join(tmp, 'VERSION'), `${version}\n`);
  fs.writeFileSync(path.join(tmp, 'SOURCE'), `${path.resolve(src, '..', '..')}\n`);
  ops.place(path.join(tmp, 'VERSION'), path.join(hooksDir, 'VERSION'), 'copy');
  ops.place(path.join(tmp, 'SOURCE'), path.join(hooksDir, 'SOURCE'), 'copy');
  fs.rmSync(tmp, { recursive: true, force: true });
  const registry = JSON.parse(fs.readFileSync(path.join(hookSrc, 'registry.json'), 'utf8'));
  ops.addBlock(path.join(vibeDir, 'hooks.toml'), vibeHooksToml(registry, hooksDir), 'tomlblock');
}

// One [[hooks]] entry per hook that supports Vibe. Vibe runs hook commands through the system
// shell (cmd.exe on Windows), so the command is plain `node "<path>"` with forward slashes,
// which every shell and Node accept.
// A hook may need several Vibe events (an array); each gets its own uniquely named entry.
export function vibeHooksToml(registry, hooksDir) {
  return registry
    .filter(hook => hook.vibe)
    .flatMap(hook => {
      const events = [hook.vibe].flat();
      return events.map(event => {
        const script = path.join(hooksDir, hook.script).split(path.sep).join('/');
        const name = events.length > 1 ? `senior-ai-${hook.id}-${event.type.replace('_', '-')}` : `senior-ai-${hook.id}`;
        const lines = [
          '[[hooks]]',
          `name = ${JSON.stringify(name)}`,
          `type = ${JSON.stringify(event.type)}`,
          `command = ${JSON.stringify(`node "${script}" --tool vibe`)}`,
        ];
        if (event.match) lines.push(`match = ${JSON.stringify(event.match)}`);
        lines.push(`timeout = ${event.timeout.toFixed(1)}`, `description = ${JSON.stringify(hook.description)}`);
        return lines.join('\n');
      });
    })
    .join('\n\n');
}

// Writes senior-ai's MCP block: the servers it installed before plus the newly chosen ones.
export function installVibeExtras({ ops, vibeDir, extras, chosenIds }) {
  const ours = ourServerNames(readConfig(vibeDir));
  const selected = extras.filter(extra => ours.has(mcpName(extra)) || chosenIds.has(extra.id));
  if (!selected.length) return;
  const header = '# MCP servers installed by senior-ai. Edit them outside this block, or re-run the installer.';
  ops.addBlock(configFile(vibeDir), [header, ...selected.map(vibeServerToml)].join('\n\n'), 'mcpblock');
}
