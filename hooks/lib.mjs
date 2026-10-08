// Shared plumbing for senior-ai hooks: read the event, answer in the calling tool's format.
// Hooks never break a session: any unexpected error ends silently with "no opinion".

import fs from 'node:fs';

export function readEvent() {
  try {
    const text = fs.readFileSync(0, 'utf8');
    return text.trim() ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export function toolArg() {
  const i = process.argv.indexOf('--tool');
  const tool = i === -1 ? 'claude' : process.argv[i + 1];
  return tool === 'vibe' ? 'vibe' : 'claude';
}

export function emit(output) {
  if (output) process.stdout.write(JSON.stringify(output) + '\n');
}

export async function runHook(main) {
  try {
    emit(await main());
  } catch {
    // Fail open: a broken hook must not block the user's work.
  }
}
