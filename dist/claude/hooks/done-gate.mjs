#!/usr/bin/env node
// senior-ai :: done gate (when the agent is about to finish its answer)
// If code files changed during the answer but nothing was built, linted, tested or reviewed, the
// agent is sent back once to verify, or to say why verification is not possible.
//   Claude Code: Stop, reading the session transcript (feedback, once thanks to stop_hook_active)
//   Vibe: post_tool records edits and checks; post_agent decides (Vibe re-prompts on "deny")

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CODE_FILE, isCheck, isVerifyingAgent } from './checks.mjs';
import { readEvent, runHook, toolArg } from './lib.mjs';
import { editedFile } from './policy.mjs';

const MESSAGE = count =>
  `senior-ai done gate: ${count} code file${count > 1 ? 's' : ''} changed in this turn, but no build, type-check, lint, ` +
  'test or review ran. Run the checks that apply now, or state clearly why they cannot run, before finishing.';

// --- Claude Code: read the transcript ---------------------------------------------------------

const CLAUDE_EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

// Tool calls made since the user's last message.
function toolCallsThisTurn(transcriptPath) {
  const calls = [];
  for (const line of fs.readFileSync(transcriptPath, 'utf8').split('\n')) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const content = entry.message?.content;
    if (entry.type === 'user' && !entry.isMeta) {
      const isPrompt = typeof content === 'string' || (Array.isArray(content) && !content.some(part => part.type === 'tool_result'));
      if (isPrompt) calls.length = 0;
    } else if (entry.type === 'assistant' && Array.isArray(content)) {
      for (const part of content) if (part.type === 'tool_use') calls.push(part);
    }
  }
  return calls;
}

function claudeGate(event) {
  if (event.stop_hook_active || !event.transcript_path || !fs.existsSync(event.transcript_path)) return null;
  const calls = toolCallsThisTurn(event.transcript_path);
  const changed = new Set(
    calls
      .filter(call => CLAUDE_EDIT_TOOLS.has(call.name) && CODE_FILE.test(call.input?.file_path ?? call.input?.notebook_path ?? ''))
      .map(call => call.input.file_path ?? call.input.notebook_path),
  );
  if (!changed.size) return null;
  const verified = calls.some(
    call =>
      (['Bash', 'PowerShell'].includes(call.name) && isCheck(call.input?.command ?? '')) ||
      (['Agent', 'Task'].includes(call.name) && isVerifyingAgent(call.input?.subagent_type)),
  );
  return verified ? null : { hookSpecificOutput: { hookEventName: 'Stop', additionalContext: MESSAGE(changed.size) } };
}

// --- Vibe: record during the answer, decide at its end ---------------------------------------

// Legacy Vibe tool names and their Unified Harness equivalents.
const VIBE_EDIT_TOOLS = new Set(['write_file', 'edit', 'file_system.write_file', 'file_system.search_replace']);
const VIBE_SHELL_TOOLS = new Set(['bash', 'git_bash', 'powershell', 'file_system.bash', 'process.start']);
const VIBE_DELEGATION_TOOLS = new Set(['task', 'subagent.spawn']);

// One record per working folder: the hook runs as a new process for every event.
function turnFile(cwd) {
  const dir = path.join(process.env.SENIOR_AI_STATE_DIR || path.join(os.homedir(), '.senior-ai'), 'vibe-turns');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${crypto.createHash('sha1').update(path.resolve(cwd || '.')).digest('hex').slice(0, 16)}.json`);
}

function vibeGate(event) {
  const record = turnFile(event.cwd);
  const turn = fs.existsSync(record) ? JSON.parse(fs.readFileSync(record, 'utf8')) : { changed: [], verified: false };

  if (event.hook_event_name === 'post_tool') {
    const input = event.tool_input ?? {};
    const edited = editedFile(input) ?? '';
    if (VIBE_EDIT_TOOLS.has(event.tool_name) && CODE_FILE.test(edited) && !turn.changed.includes(edited)) turn.changed.push(edited);
    if (VIBE_SHELL_TOOLS.has(event.tool_name) && isCheck(input.command ?? '')) turn.verified = true;
    if (VIBE_DELEGATION_TOOLS.has(event.tool_name) && isVerifyingAgent(input.agent)) turn.verified = true;
    fs.writeFileSync(record, JSON.stringify(turn));
    return null;
  }

  // post_agent: the answer is over; start the next one from scratch whatever happens.
  fs.rmSync(record, { force: true });
  return turn.changed.length && !turn.verified ? { decision: 'deny', reason: MESSAGE(turn.changed.length) } : null;
}

await runHook(() => {
  const event = readEvent();
  return toolArg() === 'vibe' ? vibeGate(event) : claudeGate(event);
});
