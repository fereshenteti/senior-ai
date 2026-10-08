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

  // Update notice: a post_agent hook that tells the user when GitHub has a newer version.
  // Vibe runs hook commands through the system shell (cmd.exe on Windows), so the command is
  // plain `node "<path>"` with forward slashes, which every shell and Node accept.
  const noticeDir = path.join(vibeDir, 'senior-ai');
  const script = path.join(noticeDir, 'check-update.mjs');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'senior-ai-'));
  fs.writeFileSync(path.join(tmp, 'VERSION'), `${version}\n`);
  fs.writeFileSync(path.join(tmp, 'SOURCE'), `${path.resolve(src, '..', '..')}\n`);
  ops.place(path.join(src, 'hooks', 'check-update.mjs'), script, 'copy');
  ops.place(path.join(tmp, 'VERSION'), path.join(noticeDir, 'VERSION'), 'copy');
  ops.place(path.join(tmp, 'SOURCE'), path.join(noticeDir, 'SOURCE'), 'copy');
  const command = `node "${script.split(path.sep).join('/')}" --tool vibe`;
  ops.addBlock(
    path.join(vibeDir, 'hooks.toml'),
    [
      '[[hooks]]',
      'name = "senior-ai-update-check"',
      'type = "post_agent"',
      `command = ${JSON.stringify(command)}`,
      'timeout = 10.0',
      'description = "Tell the user when a newer senior-ai version is available."',
    ].join('\n'),
    'tomlblock',
  );
  fs.rmSync(tmp, { recursive: true, force: true });
}

// Writes senior-ai's MCP block: the servers it installed before plus the newly chosen ones.
export function installVibeExtras({ ops, vibeDir, extras, chosenIds }) {
  const ours = ourServerNames(readConfig(vibeDir));
  const selected = extras.filter(extra => ours.has(mcpName(extra)) || chosenIds.has(extra.id));
  if (!selected.length) return;
  const header = '# MCP servers installed by senior-ai. Edit them outside this block, or re-run the installer.';
  ops.addBlock(configFile(vibeDir), [header, ...selected.map(vibeServerToml)].join('\n\n'), 'mcpblock');
}
