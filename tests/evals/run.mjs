#!/usr/bin/env node
// Evaluations: real Claude Code runs of senior-ai agents on a copy of the sample app, with
// automatic checks on what they produce. They cost credits, so they run on demand, not in CI.
//   node tests/evals/run.mjs                 every scenario
//   node tests/evals/run.mjs orchestrator    one scenario
// Uses the plugin in dist/claude (run `node build/index.mjs` first) and the `claude` CLI.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'sample-app');
const PLUGIN = path.join(REPO, 'dist', 'claude');
const NON_INTERACTIVE = 'This is an unattended run: do not ask questions; proceed on clearly stated assumptions.';

const read = (dir, file) => (fs.existsSync(path.join(dir, file)) ? fs.readFileSync(path.join(dir, file), 'utf8') : '');
const glob = (dir, sub, pattern) =>
  fs.existsSync(path.join(dir, sub)) ? fs.readdirSync(path.join(dir, sub)).filter(name => pattern.test(name)).map(name => path.join(sub, name)) : [];
const testsPass = dir => spawnSync(process.execPath, ['--test'], { cwd: dir, encoding: 'utf8' }).status === 0;

// Plants a problem in the copied app: replaces `from` with `to` in a file.
function plant(dir, file, from, to) {
  const full = path.join(dir, file);
  const text = fs.readFileSync(full, 'utf8');
  if (!text.includes(from)) throw new Error(`cannot plant in ${file}: anchor not found`);
  fs.writeFileSync(full, text.replace(from, to));
}

const RENDER_SAFE = "list.replaceChildren(...notes.map(note => Object.assign(document.createElement('li'), { textContent: note.title })));";
const unchanged = dir => spawnSync('git', ['diff', '--quiet'], { cwd: dir }).status === 0;
const verdict = report => /Verdict:\s*(PASS|FAIL)/.exec(report)?.[1];

const SCENARIOS = {
  orchestrator: {
    agent: 'senior-ai:orchestrator',
    prompt: `Users need to delete notes they no longer want. ${NON_INTERACTIVE}`,
    checks: dir => {
      const [storyFile] = glob(dir, '.senior-ai/stories', /^S-\d{3}-.+\.md$/);
      const story = storyFile ? read(dir, storyFile) : '';
      return [
        ['a story file was written', Boolean(storyFile)],
        ['the story has acceptance criteria', /## Acceptance criteria\s+1\./.test(story)],
        ['the story has a task table', /\|\s*#\s*\|\s*Task\s*\|/.test(story)],
        ['the review log records verdicts', /Verdict|PASS|FAIL/.test(story)],
        ['the status board lists the story', /S-\d{3}/.test(read(dir, '.senior-ai/status.md'))],
        ['the API can delete notes', /DELETE/.test(read(dir, 'server.mjs'))],
        ['the page can delete notes', /delete|DELETE|remove/i.test(read(dir, 'public/app.js'))],
        ['the project tests pass', testsPass(dir)],
        ['nothing was committed', spawnSync('git', ['rev-list', '--count', 'HEAD'], { cwd: dir, encoding: 'utf8' }).stdout.trim() === '1'],
      ];
    },
  },
  'frontend-security': {
    agent: 'senior-ai:frontend-security',
    setup: dir => plant(dir, 'public/app.js', RENDER_SAFE, "list.innerHTML = notes.map(note => `<li>${note.title}</li>`).join('');"),
    prompt: `Review the frontend code in public/ for security issues. ${NON_INTERACTIVE}`,
    checks: (dir, report) => [
      ['the verdict is FAIL', verdict(report) === 'FAIL'],
      ['the XSS through innerHTML is found', /innerHTML/.test(report) && /XSS|cross-site scripting/i.test(report)],
      ['it is rated Blocker or Major', /Blocker|Major/.test(report)],
      ['no project file was modified (read-only)', unchanged(dir)],
    ],
  },
  'perf-auditor': {
    agent: 'senior-ai:perf-auditor',
    setup: dir =>
      plant(
        dir,
        'public/app.js',
        RENDER_SAFE,
        `${RENDER_SAFE}
  // Recompute every note's layout one by one.
  for (const item of list.children) item.style.width = list.offsetWidth - item.offsetLeft + 'px';
  const start = Date.now();
  while (Date.now() - start < 1500) Math.sqrt(Math.random()); // warm-up`,
      ),
    prompt: `Audit the performance of the notes page (public/). ${NON_INTERACTIVE}`,
    checks: (dir, report) => [
      ['the verdict is FAIL', verdict(report) === 'FAIL'],
      ['the main-thread block is found', /main[- ]thread|long task|block|busy|while/i.test(report) && /1[.,]?5\s?s|1500/.test(report)],
      ['the layout thrashing is found', /layout|reflow|thrash|offsetWidth|offsetLeft/i.test(report)],
      ['no project file was modified (read-only)', unchanged(dir)],
    ],
  },
  architect: {
    agent: 'senior-ai:architect',
    prompt: `Notes are lost when the server restarts. Choose how to persist them for a small team app, record the decision, and document the architecture. ${NON_INTERACTIVE}`,
    checks: dir => {
      const [adrFile] = glob(dir, '.senior-ai/decisions', /^ADR-\d{3}-.+\.md$/);
      const adr = adrFile ? read(dir, adrFile) : '';
      return [
        ['an ADR was written', Boolean(adrFile)],
        ['the ADR compares options', /## Options[\s\S]*\|.*\|/.test(adr)],
        ['the ADR states a decision', /## Decision\s+\S/.test(adr)],
        ['architecture.md was written', /## Stack/.test(read(dir, '.senior-ai/architecture.md'))],
        ['no application code changed', read(dir, 'server.mjs') === read(FIXTURE, 'server.mjs')],
      ];
    },
  },
};

function prepareProject(setup) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'senior-ai-eval-'));
  fs.cpSync(FIXTURE, dir, { recursive: true });
  setup?.(dir);
  const git = args => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  git(['init', '-q']);
  git(['add', '-A']);
  git(['-c', 'user.name=eval', '-c', 'user.email=eval@example.com', 'commit', '-qm', 'sample app']);
  return dir;
}

// The model each delegation asked for, from the stream-json transcript.
function delegations(stream) {
  const found = [];
  for (const line of stream.split('\n')) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    for (const part of event.message?.content ?? []) {
      if (part.type === 'tool_use' && ['Agent', 'Task'].includes(part.name)) {
        found.push(`${part.input.subagent_type ?? 'general'} (${part.input.model ?? 'default model'})`);
      }
    }
    if (event.type === 'result') {
      found.cost = event.total_cost_usd;
      found.report = event.result ?? '';
    }
  }
  return found;
}

const wanted = process.argv.slice(2);
let failures = 0;
for (const [name, scenario] of Object.entries(SCENARIOS)) {
  if (wanted.length && !wanted.includes(name)) continue;
  const dir = prepareProject(scenario.setup);
  console.log(`\n▶ ${name}  (${dir})`);
  const run = spawnSync(
    'claude',
    ['-p', '--plugin-dir', PLUGIN, '--agent', scenario.agent, '--permission-mode', 'bypassPermissions', '--output-format', 'stream-json', '--verbose', scenario.prompt],
    { cwd: dir, encoding: 'utf8', timeout: 30 * 60_000, maxBuffer: 256 * 1024 * 1024, shell: process.platform === 'win32' },
  );
  fs.writeFileSync(`${dir}.transcript.jsonl`, run.stdout ?? '');
  const used = delegations(run.stdout ?? '');
  console.log(`  delegations: ${used.length ? used.join(', ') : 'none'}`);
  if (used.cost !== undefined) console.log(`  cost: $${used.cost.toFixed(2)}`);
  for (const [label, ok] of scenario.checks(dir, used.report ?? '')) {
    console.log(`  ${ok ? '✓' : '✗'} ${label}`);
    if (!ok) failures++;
  }
}
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
