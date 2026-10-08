#!/usr/bin/env node
// senior-ai :: checker report check (Claude Code, when a subagent's result comes back)
// A senior-ai checker must start its report with "Verdict: PASS" or "Verdict: FAIL" (review-loop
// skill). If the verdict is missing, the calling agent is told how to proceed.
//   Claude Code: PostToolUse on the Agent tool

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEvent, runHook } from './lib.mjs';

// Written by the build from the agents whose role is "checker".
const CHECKERS = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'checkers.json'), 'utf8'));

await runHook(() => {
  const event = readEvent();
  const agent = String(event.tool_input?.subagent_type ?? '').replace(/^senior-ai:/, '');
  if (!CHECKERS.includes(agent)) return null;
  const report = typeof event.tool_response === 'string' ? event.tool_response : JSON.stringify(event.tool_response ?? '');
  if (/Verdict:\s*(?:PASS|FAIL)\b/.test(report)) return null;
  return {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext:
        `senior-ai: the ${agent} report has no "Verdict: PASS" or "Verdict: FAIL" line. Treat it as FAIL if it lists any ` +
        'Blocker or Major finding, PASS otherwise, and say which you assumed; or ask the checker again for its verdict.',
    },
  };
});
