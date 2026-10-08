#!/usr/bin/env node
// senior-ai :: safety guard (before every shell command, file write and edit)
// Refuses destructive commands and secrets in files; asks the user before commits, pushes,
// deploys, publishing, new dependencies and migrations. Rules: policy.mjs.
//   Claude Code: PreToolUse  · Vibe: pre_tool

import { readEvent, runHook, toolArg } from './lib.mjs';
import { checkToolCall } from './policy.mjs';

await runHook(() => {
  const event = readEvent();
  const { decision, reason } = checkToolCall(event.tool_name, event.tool_input);
  if (decision === 'allow') return null;

  if (toolArg() === 'vibe') {
    // Vibe cannot ask from a hook; its own approval prompt covers commands that need consent.
    return decision === 'deny' ? { decision: 'deny', reason } : null;
  }
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision, permissionDecisionReason: reason } };
});
