#!/usr/bin/env node
// senior-ai :: done gate (Claude Code, when the agent is about to finish its turn)
// If code files changed in this turn but nothing was built, linted, tested or reviewed, the agent
// is sent back once to verify, or to say why verification is not possible.
//   Claude Code: Stop (feedback, not an error; runs once thanks to stop_hook_active)

import fs from 'node:fs';
import { readEvent, runHook } from './lib.mjs';

const CODE_FILE = /\.(?:[cm]?[jt]sx?|vue|svelte|html|s?css|less|py|go|rs|java|kt|cs|php|rb|swift|sql)$/i;
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
// A check command at the start of one part of a shell command (so `git commit -m test` is not one).
const CHECK_COMMAND = new RegExp(
  '^(?:\\w+=\\S+\\s+)*(?:npx\\s+|bunx\\s+|pnpm\\s+(?:exec|dlx)\\s+|yarn\\s+dlx\\s+)?(?:' +
    [
      '(?:npm|pnpm|yarn|bun)\\s+(?:run\\s+)?(?:test|lint|build|typecheck|type-check|check|e2e|verify)\\b',
      '(?:tsc|vitest|jest|karma|eslint|playwright|cypress|pytest|mvn|gradle|\\.\\/gradlew)\\b',
      'make\\s+(?:test|check|lint|build)\\b',
      'ng\\s+(?:test|build|lint|e2e)\\b',
      'nx\\s+(?:test|build|lint|affected|run)\\b',
      'node\\s+--test\\b',
      'go\\s+(?:test|build|vet)\\b',
      'cargo\\s+(?:test|build|check|clippy)\\b',
      'dotnet\\s+(?:test|build)\\b',
    ].join('|') +
    ')',
);
const isCheck = command => command.split(/&&|\|\||;|\|/).some(part => CHECK_COMMAND.test(part.trim()));
const VERIFYING_AGENT = /(?:auditor|reviewer|qa-engineer|test)/;

// Tool calls made since the user's last message.
function toolCallsThisTurn(transcriptPath) {
  const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
  const calls = [];
  for (const line of lines) {
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

await runHook(() => {
  const event = readEvent();
  if (event.stop_hook_active || !event.transcript_path || !fs.existsSync(event.transcript_path)) return null;

  const calls = toolCallsThisTurn(event.transcript_path);
  const changed = new Set(
    calls
      .filter(call => EDIT_TOOLS.has(call.name) && CODE_FILE.test(call.input?.file_path ?? call.input?.notebook_path ?? ''))
      .map(call => call.input.file_path ?? call.input.notebook_path),
  );
  if (!changed.size) return null;
  const verified = calls.some(
    call =>
      (['Bash', 'PowerShell'].includes(call.name) && isCheck(call.input?.command ?? '')) ||
      (['Agent', 'Task'].includes(call.name) && VERIFYING_AGENT.test(call.input?.subagent_type ?? '')),
  );
  if (verified) return null;

  return {
    hookSpecificOutput: {
      hookEventName: 'Stop',
      additionalContext:
        `senior-ai done gate: ${changed.size} code file${changed.size > 1 ? 's' : ''} changed in this turn, but no build, ` +
        'type-check, lint, test or review ran. Run the checks that apply now, or state clearly why they cannot run, before finishing.',
    },
  };
});
