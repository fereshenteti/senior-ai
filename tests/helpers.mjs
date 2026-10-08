// Test helpers: temporary homes and fake CLIs on a controlled PATH.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const IS_WINDOWS = process.platform === 'win32';

export function tempDir(prefix = 'senior-ai-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// Creates an executable `name` in binDir that prints `output` and exits with `code`.
// It also appends its arguments to <binDir>/<name>.log so tests can assert on calls.
export function fakeCli(binDir, name, { output = '', code = 0 } = {}) {
  fs.mkdirSync(binDir, { recursive: true });
  const log = path.join(binDir, `${name}.log`);
  if (IS_WINDOWS) {
    const lines = ['@echo off', `echo %*>>"${log}"`];
    if (output) lines.push(`echo ${output}`);
    lines.push(`exit /b ${code}`);
    fs.writeFileSync(path.join(binDir, `${name}.cmd`), lines.join('\r\n') + '\r\n');
  } else {
    const script = ['#!/bin/sh', `echo "$*" >> "${log}"`, output ? `echo "${output}"` : '', `exit ${code}`].join('\n');
    fs.writeFileSync(path.join(binDir, name), script + '\n', { mode: 0o755 });
  }
  return log;
}

// Runs fn with PATH limited to binDir (plus the directory of the running node binary).
export async function withPath(binDir, fn) {
  const saved = process.env.PATH;
  process.env.PATH = [binDir, path.dirname(process.execPath), IS_WINDOWS ? process.env.SystemRoot + '\\System32' : '/usr/bin:/bin'].join(path.delimiter);
  try {
    return await fn();
  } finally {
    process.env.PATH = saved;
  }
}
