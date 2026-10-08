// File operations shared by the tool installers: placing files with backups, marked blocks in
// files the user owns, and a manifest per tool so re-installs and --uninstall are exact.
//
// Manifest: one line per installed item, "<dest><TAB><backup or extra info>". Prefixed entries:
//   block:<file>      marked block in a Markdown file (an existing AGENTS.md)
//   tomlblock:<file>  marked block in hooks.toml
//   mcpblock:<file>   senior-ai's MCP servers in Vibe's config.toml (an optional extra)
//   plugin:<id>       the senior-ai Claude plugin
//   extra:<how>       an optional extra installed for Claude; the value is the plugin id or MCP name

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VIBE_BLOCK } from './extras.mjs';
import { IS_WINDOWS } from './run.mjs';
import { pretty, say } from './ui.mjs';

const HOME = os.homedir();

export const MARKS = {
  block: ['<!-- senior-ai:start -->', '<!-- senior-ai:end -->'],
  tomlblock: ['# senior-ai:start', '# senior-ai:end'],
  mcpblock: VIBE_BLOCK,
};

// Entries that survive a re-install: optional extras stay until the user removes them.
const KEPT_ON_REINSTALL = ['extra', 'mcpblock'];

function timestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export function exists(p) {
  try {
    fs.lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

export const entryKind = dest => {
  const kind = dest.split(':')[0];
  return kind in MARKS || kind === 'plugin' || kind === 'extra' ? kind : 'file';
};
const entryTarget = dest => dest.slice(dest.indexOf(':') + 1);

export function createFileOps({ stateDir, mode, dryRun }) {
  const backupRoot = path.join(stateDir, 'backups', timestamp());
  let currentTool = '';
  let warnedFileLinks = false;

  const manifest = tool => path.join(stateDir, `${tool}.manifest`);

  function run(description, action) {
    if (dryRun) {
      say(`  [dry-run] ${description}`);
      return;
    }
    action();
  }

  function readManifest(file) {
    if (!fs.existsSync(file)) return [];
    return fs
      .readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map(line => {
        const [dest, backup = ''] = line.split('\t');
        return { dest, backup };
      });
  }

  function record(dest, backup = '') {
    if (dryRun) return;
    fs.mkdirSync(stateDir, { recursive: true });
    fs.appendFileSync(manifest(currentTool), `${dest}\t${backup}\n`);
  }

  // Backup recorded for <dest> by a previous install of the current tool (kept across re-installs).
  const previousBackup = dest => readManifest(`${manifest(currentTool)}.prev`).find(e => e.dest === dest)?.backup ?? '';

  function backupPath(dest) {
    const rel = dest.startsWith(HOME + path.sep) ? path.relative(HOME, dest) : dest.replace(/^([a-zA-Z]:)?[\\/]+/, '');
    return path.join(backupRoot, currentTool, rel);
  }

  function move(from, to) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    try {
      fs.renameSync(from, to);
    } catch (err) {
      if (err.code !== 'EXDEV') throw err;
      fs.cpSync(from, to, { recursive: true, verbatimSymlinks: true });
      fs.rmSync(from, { recursive: true, force: true });
    }
  }

  // Directories link as junctions on Windows (no admin rights needed); files that cannot be
  // symlinked there (no Developer Mode) are copied instead.
  function link(src, dest) {
    if (!IS_WINDOWS) return fs.symlinkSync(src, dest);
    if (fs.statSync(src).isDirectory()) return fs.symlinkSync(src, dest, 'junction');
    try {
      fs.symlinkSync(src, dest, 'file');
    } catch {
      if (!warnedFileLinks) {
        say('  note: Windows refused file symlinks (enable Developer Mode to allow them); copying files instead.');
        warnedFileLinks = true;
      }
      fs.copyFileSync(src, dest);
    }
  }

  // place(src, dest, how): link (or copy) src to dest, backing up whatever is there.
  function place(src, dest, how = mode) {
    let backup = previousBackup(dest);
    if (exists(dest)) {
      backup = backupPath(dest);
      run(`move ${pretty(dest)} → ${pretty(backup)}`, () => move(dest, backup));
      say(`  backed up existing ${pretty(dest)} → ${pretty(backup)}`);
    }
    run(`${how === 'link' ? 'link' : 'copy'} ${pretty(src)} → ${pretty(dest)}`, () => {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      if (how === 'link') link(src, dest);
      else fs.cpSync(src, dest, { recursive: true });
    });
    record(dest, backup);
  }

  function stripBlock(file, kind) {
    if (!fs.existsSync(file)) return;
    const [start, end] = MARKS[kind];
    const text = fs.readFileSync(file, 'utf8');
    if (!text.includes(start)) return;
    if (dryRun) {
      say(`  [dry-run] remove senior-ai block from ${pretty(file)}`);
      return;
    }
    const kept = [];
    let skip = false;
    for (const line of text.split(/\r?\n/)) {
      if (line === start) skip = true;
      else if (line === end) skip = false;
      else if (!skip) kept.push(line);
    }
    // Drop the trailing blank lines the block leaves behind.
    while (kept.length && kept[kept.length - 1].trim() === '') kept.pop();
    fs.writeFileSync(file, kept.length ? kept.join('\n') + '\n' : '');
  }

  // addBlock(file, content, kind): append content between markers; records "<kind>:<file>".
  function addBlock(file, content, kind) {
    const created = fs.existsSync(file) ? '' : 'created';
    const previous = readManifest(`${manifest(currentTool)}.prev`).find(e => e.dest === `${kind}:${file}`);
    if (dryRun) {
      say(`  [dry-run] add senior-ai block to ${pretty(file)}`);
      return;
    }
    const [start, end] = MARKS[kind];
    fs.mkdirSync(path.dirname(file), { recursive: true });
    stripBlock(file, kind);
    const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const body = content.endsWith('\n') ? content : content + '\n';
    fs.appendFileSync(file, `${current ? '\n' : ''}${start}\n${body}${end}\n`);
    record(`${kind}:${file}`, previous?.backup || created);
  }

  function removeBlock(file, kind, created) {
    stripBlock(file, kind);
    if (created === 'created' && fs.existsSync(file) && fs.readFileSync(file, 'utf8').trim() === '') {
      run(`delete ${pretty(file)}`, () => fs.rmSync(file));
    }
  }

  // Removes what the tool's manifest lists. Optional extras are only removed when removeExtras
  // is set; uninstallExtra(entry) does the tool-specific part for extras and the senior-ai plugin.
  function removeInstalled(tool, { restore, removeExtras, uninstallEntry }) {
    for (const entry of readManifest(manifest(tool))) {
      const kind = entryKind(entry.dest);
      if (KEPT_ON_REINSTALL.includes(kind) && !removeExtras) continue;
      if (kind in MARKS) {
        removeBlock(entryTarget(entry.dest), kind, entry.backup);
        continue;
      }
      if (kind === 'plugin' || kind === 'extra') {
        if (dryRun) say(`  [dry-run] remove ${entry.dest} (${entry.backup || 'senior-ai'})`);
        else uninstallEntry?.(kind, entryTarget(entry.dest), entry.backup);
        continue;
      }
      if (exists(entry.dest)) run(`delete ${pretty(entry.dest)}`, () => fs.rmSync(entry.dest, { recursive: true, force: true }));
      if (restore && entry.backup && exists(entry.backup)) {
        run(`move ${pretty(entry.backup)} → ${pretty(entry.dest)}`, () => move(entry.backup, entry.dest));
        say(`  restored ${pretty(entry.dest)}`);
      }
    }
  }

  // Starts a (re-)install for a tool: removes its previous files, keeps the extras it installed.
  function beginTool(tool, { uninstallEntry } = {}) {
    currentTool = tool;
    const file = manifest(tool);
    if (!fs.existsSync(file)) return;
    const kept = readManifest(file).filter(entry => KEPT_ON_REINSTALL.includes(entryKind(entry.dest)));
    removeInstalled(tool, { restore: false, removeExtras: false, uninstallEntry });
    if (dryRun) return;
    fs.renameSync(file, `${file}.prev`);
    for (const entry of kept) if (entryKind(entry.dest) === 'extra') record(entry.dest, entry.backup);
  }

  // After a re-install, restore backups of items that are no longer part of senior-ai.
  function restoreOrphans() {
    const prev = `${manifest(currentTool)}.prev`;
    for (const { dest, backup } of readManifest(prev)) {
      if (entryKind(dest) !== 'file') continue;
      if (backup && exists(backup) && !exists(dest)) {
        run(`move ${pretty(backup)} → ${pretty(dest)}`, () => move(backup, dest));
        say(`  restored ${pretty(dest)} (no longer provided by senior-ai)`);
      }
    }
    if (!dryRun) fs.rmSync(prev, { force: true });
  }

  function extrasInstalledBySeniorAi(tool) {
    return readManifest(manifest(tool)).filter(entry => entryKind(entry.dest) === 'extra');
  }

  return {
    run,
    place,
    addBlock,
    record,
    readManifest,
    manifest,
    beginTool,
    restoreOrphans,
    removeInstalled,
    previousBackup,
    extrasInstalledBySeniorAi,
    setTool: tool => {
      currentTool = tool;
    },
  };
}
