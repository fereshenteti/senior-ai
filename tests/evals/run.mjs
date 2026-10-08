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
  'backend-security': {
    agent: 'senior-ai:backend-security',
    setup: dir => {
      fs.writeFileSync(
        path.join(dir, 'db.mjs'),
        "// Database access (PostgreSQL in production).\nexport async function query(sql) {\n  throw new Error('not connected in tests: ' + sql);\n}\n",
      );
      plant(
        dir,
        'server.mjs',
        "    if (req.url === '/api/notes' && req.method === 'GET') return send(200, notes);",
        `    if (req.url === '/api/notes' && req.method === 'GET') return send(200, notes);
    // Notes of a user, with an optional search: GET /api/users/:id/notes?q=…
    const userNotes = /^\\/api\\/users\\/([^/]+)\\/notes(?:\\?q=(.*))?$/.exec(req.url);
    if (userNotes && req.method === 'GET') {
      const [, userId, search = ''] = userNotes;
      const rows = await query("SELECT * FROM notes WHERE owner_id = " + userId + " AND title LIKE '%" + decodeURIComponent(search) + "%'");
      return send(200, rows);
    }`,
      );
      plant(dir, 'server.mjs', "import { fileURLToPath } from 'node:url';", "import { fileURLToPath } from 'node:url';\nimport { query } from './db.mjs';");
    },
    prompt: `Review the backend (server.mjs, db.mjs) for security issues. Users are identified by a session cookie handled by a gateway that sets the x-user-id header. ${NON_INTERACTIVE}`,
    checks: (dir, report) => [
      ['the verdict is FAIL', verdict(report) === 'FAIL'],
      ['the SQL injection is found', /SQL injection|injection/i.test(report)],
      ['the missing authorization (IDOR) is found', /IDOR|authori[sz]ation|another user|other users|any user/i.test(report)],
      ['they are rated Blocker', /Blocker/.test(report)],
      ['no project file was modified (read-only)', unchanged(dir)],
    ],
  },
  'db-reviewer': {
    agent: 'senior-ai:db-reviewer',
    setup: dir => {
      fs.mkdirSync(path.join(dir, 'migrations'));
      fs.writeFileSync(
        path.join(dir, 'migrations', '001_create_notes.sql'),
        'CREATE TABLE users (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, email text NOT NULL UNIQUE);\nCREATE TABLE notes (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, title text NOT NULL);\n',
      );
      fs.writeFileSync(
        path.join(dir, 'migrations', '002_add_owner.sql'),
        [
          '-- Notes now belong to a user.',
          'ALTER TABLE notes ADD COLUMN owner_id bigint NOT NULL;',
          'ALTER TABLE notes ADD CONSTRAINT notes_owner_fk FOREIGN KEY (owner_id) REFERENCES users (id);',
          'CREATE INDEX notes_title_idx ON notes (title);',
          'ALTER TABLE notes RENAME COLUMN title TO name;',
          '',
        ].join('\n'),
      );
    },
    prompt: `Review migrations/002_add_owner.sql before it runs in production. The notes table has about 5 million rows and constant traffic; the current server code reads and writes notes.title. ${NON_INTERACTIVE}`,
    checks: (dir, report) => [
      ['the verdict is FAIL', verdict(report) === 'FAIL'],
      ['NOT NULL without default is found', /NOT NULL/.test(report) && /default|backfill/i.test(report)],
      ['the blocking index build is found', /CONCURRENTLY/.test(report)],
      ['the foreign-key scan under lock is found', /NOT VALID|VALIDATE CONSTRAINT/.test(report)],
      ['the rename breaking running code is found', /rename/i.test(report) && /title/.test(report)],
      ['no project file was modified (read-only)', unchanged(dir)],
    ],
  },
  'infra-reviewer': {
    agent: 'senior-ai:infra-reviewer',
    setup: dir => {
      // A fake password, assembled at runtime so this repository holds no secret-shaped text.
      const databaseUrl = 'postgres://app:' + 'n0tAr3alPassw0rd' + '@db:5432/notes';
      fs.writeFileSync(
        path.join(dir, 'Dockerfile'),
        ['FROM node:latest', 'WORKDIR /app', 'COPY . .', `ENV DATABASE_URL=${databaseUrl}`, 'RUN npm install', 'EXPOSE 3000', 'CMD npm start', ''].join('\n'),
      );
      fs.mkdirSync(path.join(dir, '.github', 'workflows'), { recursive: true });
      fs.writeFileSync(
        path.join(dir, '.github', 'workflows', 'preview.yml'),
        [
          'name: Preview',
          'on: pull_request_target',
          'permissions: write-all',
          'jobs:',
          '  preview:',
          '    runs-on: ubuntu-latest',
          '    steps:',
          '      - uses: actions/checkout@v5',
          '        with:',
          '          ref: ${{ github.event.pull_request.head.sha }}',
          '      - run: npm ci && npm test',
          '      - uses: some-org/deploy-preview-action@main',
          '        with:',
          '          token: ${{ secrets.VERCEL_TOKEN }}',
          '      - run: echo "Preview for ${{ github.event.pull_request.title }}"',
          '',
        ].join('\n'),
      );
    },
    prompt: `Review the new Dockerfile and .github/workflows/preview.yml before they are merged. This is a public repository that accepts pull requests from forks. ${NON_INTERACTIVE}`,
    checks: (dir, report) => [
      ['the verdict is FAIL', verdict(report) === 'FAIL'],
      ['pull_request_target running PR code with secrets is found', /pull_request_target/.test(report)],
      ['the secret in the Dockerfile is found', /DATABASE_URL|secret|password|credential/i.test(report) && /ENV|image|layer/i.test(report)],
      ['the root user is found', /root|USER/.test(report)],
      ['the unpinned base image or action is found', /latest|@main|pin|SHA/i.test(report)],
      ['the PR title injection is found', /title/.test(report) && /inject/i.test(report)],
      ['they include a Blocker', /Blocker/.test(report)],
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
