// Runs each generated hook script as a process with the JSON event a tool would send.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { fakeCli, tempDir } from '../helpers.mjs';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOOKS = path.join(REPO, 'dist', 'claude', 'hooks');

function hook(script, event, { tool = 'claude', env = {}, args = [], cwd } = {}) {
  const result = spawnSync(process.execPath, [path.join(HOOKS, script), '--tool', tool, ...args], {
    input: JSON.stringify(event),
    encoding: 'utf8',
    env: { ...process.env, ...env },
    cwd,
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}

test('safety guard: deny, ask and allow in Claude format', () => {
  const deny = hook('guard.mjs', { tool_name: 'Bash', tool_input: { command: 'rm -rf ~' } });
  assert.equal(deny.hookSpecificOutput.permissionDecision, 'deny');
  const ask = hook('guard.mjs', { tool_name: 'Bash', tool_input: { command: 'git push origin main' } });
  assert.equal(ask.hookSpecificOutput.permissionDecision, 'ask');
  assert.equal(hook('guard.mjs', { tool_name: 'Bash', tool_input: { command: 'npm test' } }), null);
});

test('safety guard: Vibe format, approvals left to Vibe', () => {
  const deny = hook('guard.mjs', { tool_name: 'write_file', tool_input: { file_path: 'a.ts', content: 'AKIA' + 'ABCDEFGHIJ234567' } }, { tool: 'vibe' });
  assert.equal(deny.decision, 'deny');
  assert.match(deny.reason, /AWS access key/);
  assert.equal(hook('guard.mjs', { tool_name: 'bash', tool_input: { command: 'git commit -m x' } }, { tool: 'vibe' }), null);
});

test('safety guard fails open on unexpected input', () => {
  assert.equal(hook('guard.mjs', 'not an event'), null);
});

function projectWithLinters({ lintOutput, lintCode }) {
  const project = tempDir();
  fs.writeFileSync(path.join(project, 'package.json'), '{}');
  const bin = path.join(project, 'node_modules', '.bin');
  const prettierLog = fakeCli(bin, 'prettier');
  fakeCli(bin, 'eslint', { output: lintOutput, code: lintCode });
  const file = path.join(project, 'src', 'app.ts');
  fs.mkdirSync(path.dirname(file));
  fs.writeFileSync(file, 'export const x = 1;\n');
  return { project, file, prettierLog };
}

test('format-lint: formats, then reports ESLint errors to the agent', () => {
  const { file, prettierLog } = projectWithLinters({ lintOutput: 'app.ts 1:1 error no-unused-vars', lintCode: 1 });
  const out = hook('format-lint.mjs', { tool_name: 'Edit', tool_input: { file_path: file } });
  assert.match(fs.readFileSync(prettierLog, 'utf8'), /--write/);
  assert.match(out.hookSpecificOutput.additionalContext, /no-unused-vars/);
  const vibe = hook('format-lint.mjs', { tool_name: 'edit', tool_input: { file_path: file } }, { tool: 'vibe' });
  assert.match(vibe.hook_specific_output.additional_context, /no-unused-vars/);
});

test('format-lint: silent when the file is clean or the project has no linters', () => {
  const { file } = projectWithLinters({ lintOutput: '', lintCode: 0 });
  assert.equal(hook('format-lint.mjs', { tool_name: 'Write', tool_input: { file_path: file } }), null);
  const bare = tempDir();
  fs.writeFileSync(path.join(bare, 'a.ts'), 'x');
  assert.equal(hook('format-lint.mjs', { tool_name: 'Write', tool_input: { file_path: path.join(bare, 'a.ts') } }), null);
});

function transcript(entries) {
  const file = path.join(tempDir(), 'transcript.jsonl');
  fs.writeFileSync(file, entries.map(entry => JSON.stringify(entry)).join('\n') + '\n');
  return file;
}
const prompt = text => ({ type: 'user', message: { role: 'user', content: text } });
const toolUse = (name, input) => ({ type: 'assistant', message: { content: [{ type: 'tool_use', name, input }] } });
const toolResult = () => ({ type: 'user', message: { content: [{ type: 'tool_result', content: 'ok' }] } });

test('done gate: code changed and nothing verified → sent back once', () => {
  const file = transcript([prompt('add a button'), toolUse('Edit', { file_path: '/p/src/button.ts' }), toolResult()]);
  const out = hook('done-gate.mjs', { transcript_path: file, stop_hook_active: false });
  assert.match(out.hookSpecificOutput.additionalContext, /1 code file changed/);
  assert.equal(hook('done-gate.mjs', { transcript_path: file, stop_hook_active: true }), null);
});

test('done gate: a commit message saying "test" is not a test run', () => {
  const file = transcript([prompt('x'), toolUse('Edit', { file_path: 'a.ts' }), toolResult(), toolUse('Bash', { command: 'git commit -m test' }), toolResult()]);
  assert.match(hook('done-gate.mjs', { transcript_path: file }).hookSpecificOutput.additionalContext, /done gate/);
});

test('done gate: silent when verified, when only docs changed, or for an earlier turn', () => {
  const verified = transcript([prompt('x'), toolUse('Edit', { file_path: 'a.ts' }), toolResult(), toolUse('Bash', { command: 'npm test' }), toolResult()]);
  assert.equal(hook('done-gate.mjs', { transcript_path: verified }), null);
  const reviewed = transcript([prompt('x'), toolUse('Write', { file_path: 'a.ts' }), toolResult(), toolUse('Agent', { subagent_type: 'senior-ai:code-auditor' }), toolResult()]);
  assert.equal(hook('done-gate.mjs', { transcript_path: reviewed }), null);
  const docs = transcript([prompt('x'), toolUse('Edit', { file_path: 'README.md' }), toolResult()]);
  assert.equal(hook('done-gate.mjs', { transcript_path: docs }), null);
  const earlier = transcript([prompt('x'), toolUse('Edit', { file_path: 'a.ts' }), toolResult(), prompt('thanks, explain it')]);
  assert.equal(hook('done-gate.mjs', { transcript_path: earlier }), null);
});

test('report check: only for checkers without a verdict', () => {
  const missing = hook('report-check.mjs', { tool_input: { subagent_type: 'senior-ai:code-auditor' }, tool_response: 'Looks fine overall.' });
  assert.match(missing.hookSpecificOutput.additionalContext, /no "Verdict: PASS"/);
  assert.equal(hook('report-check.mjs', { tool_input: { subagent_type: 'senior-ai:a11y-auditor' }, tool_response: { content: [{ text: 'Verdict: FAIL\n…' }] } }), null);
  assert.equal(hook('report-check.mjs', { tool_input: { subagent_type: 'senior-ai:ui-builder' }, tool_response: 'done' }), null);
});

test('session context: rules, project status, setup hint', () => {
  const project = tempDir();
  const plain = hook('session-context.mjs', {}, { env: { CLAUDE_PROJECT_DIR: project, CLAUDE_PLUGIN_ROOT: path.join(REPO, 'dist', 'claude') } });
  const context = plain.hookSpecificOutput.additionalContext;
  assert.match(context, /^# Global engineering rules/);
  assert.match(context, /setup-project/);

  fs.mkdirSync(path.join(project, '.senior-ai'));
  fs.writeFileSync(path.join(project, '.senior-ai', 'status.md'), '# Status\n| S-001 | Login | in progress |');
  fs.writeFileSync(path.join(project, 'AGENTS.md'), '# Project');
  const withStatus = hook('session-context.mjs', {}, { env: { CLAUDE_PROJECT_DIR: project, CLAUDE_PLUGIN_ROOT: path.join(REPO, 'dist', 'claude') } });
  assert.match(withStatus.hookSpecificOutput.additionalContext, /S-001 \| Login/);
  assert.doesNotMatch(withStatus.hookSpecificOutput.additionalContext, /setup-project integrates/);
});

test('Vibe done gate: edits without checks → sent back at the end of the answer, once', () => {
  const state = tempDir();
  const env = { SENIOR_AI_STATE_DIR: state };
  const cwd = tempDir();
  const vibe = event => hook('done-gate.mjs', { cwd, ...event }, { tool: 'vibe', env });
  assert.equal(vibe({ hook_event_name: 'post_tool', tool_name: 'edit', tool_input: { file_path: `${cwd}/src/app.ts` } }), null);
  assert.equal(vibe({ hook_event_name: 'post_tool', tool_name: 'bash', tool_input: { command: 'git commit -m test' } }), null);
  const end = vibe({ hook_event_name: 'post_agent' });
  assert.equal(end.decision, 'deny');
  assert.match(end.reason, /1 code file changed/);
  // The next answer starts clean: explaining without new edits passes.
  assert.equal(vibe({ hook_event_name: 'post_agent' }), null);
});

test('Vibe done gate never touches the edited file, and understands Unified Harness tool names', () => {
  const env = { SENIOR_AI_STATE_DIR: tempDir() };
  const cwd = tempDir();
  const source = path.join(cwd, 'app.ts');
  fs.writeFileSync(source, 'export const keep = 1;\n');
  const vibe = event => hook('done-gate.mjs', { cwd, ...event }, { tool: 'vibe', env });
  vibe({ hook_event_name: 'post_tool', tool_name: 'file_system.write_file', tool_input: { path: source, content: 'x' } });
  vibe({ hook_event_name: 'post_tool', tool_name: 'file_system.search_replace', tool_input: { file_path: source, content: [{ old_str: 'a', new_str: 'b' }] } });
  assert.equal(fs.readFileSync(source, 'utf8'), 'export const keep = 1;\n');
  assert.equal(vibe({ hook_event_name: 'post_agent' }).decision, 'deny');
  vibe({ hook_event_name: 'post_tool', tool_name: 'file_system.write_file', tool_input: { path: source, content: 'x' } });
  vibe({ hook_event_name: 'post_tool', tool_name: 'subagent.spawn', tool_input: { agent: 'code-auditor' } });
  assert.equal(vibe({ hook_event_name: 'post_agent' }), null);
});

test('Vibe done gate: a check or a reviewer delegation counts as verification', () => {
  const env = { SENIOR_AI_STATE_DIR: tempDir() };
  for (const verification of [
    { tool_name: 'bash', tool_input: { command: 'npm test' } },
    { tool_name: 'task', tool_input: { agent: 'code-auditor', task: 'review' } },
  ]) {
    const cwd = tempDir();
    const vibe = event => hook('done-gate.mjs', { cwd, ...event }, { tool: 'vibe', env });
    vibe({ hook_event_name: 'post_tool', tool_name: 'write_file', tool_input: { file_path: `${cwd}/a.ts` } });
    vibe({ hook_event_name: 'post_tool', ...verification });
    assert.equal(vibe({ hook_event_name: 'post_agent' }), null, verification.tool_name);
  }
});

test('Vibe report check: checker output without a verdict', () => {
  const missing = hook('report-check.mjs', { tool_name: 'task', tool_input: { agent: 'db-reviewer' }, tool_output_text: 'All good.' }, { tool: 'vibe' });
  assert.match(missing.hook_specific_output.additional_context, /db-reviewer/);
  assert.equal(hook('report-check.mjs', { tool_name: 'task', tool_input: { agent: 'db-reviewer' }, tool_output_text: 'Verdict: PASS' }, { tool: 'vibe' }), null);
  for (const decorated of ['## Review — Verdict: **FAIL**', '**Verdict:** PASS', 'Verdict: `FAIL`']) {
    assert.equal(hook('report-check.mjs', { tool_name: 'task', tool_input: { agent: 'db-reviewer' }, tool_output_text: decorated }, { tool: 'vibe' }), null, decorated);
  }
  assert.ok(hook('report-check.mjs', { tool_name: 'task', tool_input: { agent: 'db-reviewer' }, tool_output_text: 'Verdict pending, PASSING tests' }, { tool: 'vibe' }));
});

test("session context in a project's copy: the status board only (the rules are in AGENTS.md)", () => {
  const project = tempDir();
  const env = { CLAUDE_PROJECT_DIR: project, CLAUDE_PLUGIN_ROOT: path.join(REPO, 'dist', 'claude') };
  assert.equal(hook('session-context.mjs', {}, { env, args: ['--project'] }), null);
  fs.mkdirSync(path.join(project, '.senior-ai'));
  fs.writeFileSync(path.join(project, '.senior-ai', 'status.md'), '# Status\n| S-001 | Login | in progress |');
  const context = hook('session-context.mjs', {}, { env, args: ['--project'] }).hookSpecificOutput.additionalContext;
  assert.match(context, /^# Project status/);
  assert.doesNotMatch(context, /engineering rules|setup-project/);
});

test("machine-wide Vibe hooks step aside where Vibe runs a trusted project's own copy", () => {
  const project = tempDir();
  const vibeHome = tempDir();
  const env = { VIBE_HOME: vibeHome };
  const rmEvent = { tool_name: 'bash', tool_input: { command: 'rm -rf ~' } };
  const trust = list => fs.writeFileSync(path.join(vibeHome, 'trusted_folders.toml'), `trusted = ${JSON.stringify(list)}\nuntrusted = []\n`);
  fs.mkdirSync(path.join(project, '.senior-ai', 'system', 'hooks'), { recursive: true });
  fs.mkdirSync(path.join(project, '.vibe'));
  fs.writeFileSync(path.join(project, '.vibe', 'hooks.toml'), 'command = "node \\".senior-ai/system/hooks/guard.mjs\\" --tool vibe --project"\n');

  trust([]);
  assert.equal(hook('guard.mjs', rmEvent, { tool: 'vibe', env, cwd: project }).decision, 'deny', 'untrusted: Vibe ignores the project hooks');
  trust([fs.realpathSync(project)]);
  assert.equal(hook('guard.mjs', rmEvent, { tool: 'vibe', env, cwd: project }), null, 'trusted: the project copy guards instead');
  assert.equal(hook('guard.mjs', rmEvent, { tool: 'vibe', env, cwd: project, args: ['--project'] }).decision, 'deny', 'the project copy itself runs');
});
