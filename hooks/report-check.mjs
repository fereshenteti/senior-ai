#!/usr/bin/env node
// senior-ai :: checker report check (when a subagent's result comes back)
// A senior-ai checker must start its report with "Verdict: PASS" or "Verdict: FAIL" (review-loop
// skill). If the verdict is missing, the calling agent is told how to proceed.
//   Claude Code: PostToolUse on the Agent tool · Vibe: post_tool on the task tool

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEvent, runHook, toolArg } from './lib.mjs';

// Written by the build from the agents whose role is "checker".
const CHECKERS = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'checkers.json'), 'utf8'));

await runHook(() => {
  const event = readEvent();
  const vibe = toolArg() === 'vibe';
  const input = event.tool_input ?? {};
  const agent = String((vibe ? input.agent : input.subagent_type) ?? '').replace(/^senior-ai:/, '');
  if (!CHECKERS.includes(agent)) return null;
  const response = vibe ? event.tool_output_text : event.tool_response;
  const report = typeof response === 'string' ? response : JSON.stringify(response ?? '');
  // Models often decorate it ("**Verdict:** PASS", "Verdict: **FAIL**"); the word is what matters.
  if (/Verdict\W{0,6}(?:PASS|FAIL)\b/.test(report)) return null;
  const context =
    `senior-ai: the ${agent} report has no "Verdict: PASS" or "Verdict: FAIL" line. Treat it as FAIL if it lists any ` +
    'Blocker or Major finding, PASS otherwise, and say which you assumed; or ask the checker again for its verdict.';
  return vibe
    ? { hook_specific_output: { additional_context: context } }
    : { hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: context } };
});
