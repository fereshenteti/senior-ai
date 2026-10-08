// Runs external commands the same way on macOS, Linux and Windows.

import { spawnSync } from 'node:child_process';

export const IS_WINDOWS = process.platform === 'win32';

// On Windows, CLIs are often .cmd shims (npm, uv) that only start through a shell. Node warns
// (DEP0190) when an argument list is passed together with `shell: true`, because it doesn't escape
// them; so on Windows we build and quote the whole command line ourselves and pass one string.
function quoteForCmd(arg) {
  return /[\s"&|<>^]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
}

export const windowsCommandLine = (command, args) => [command, ...args].map(quoteForCmd).join(' ');

// spawnSync that starts .cmd shims on Windows without the DEP0190 warning, and runs directly elsewhere.
export function spawnPortable(command, args = [], options = {}) {
  return IS_WINDOWS
    ? spawnSync(windowsCommandLine(command, args), { ...options, shell: true })
    : spawnSync(command, args, options);
}

// Returns { ok, status, stdout, stderr, missing } and never throws.
export function runCommand(command, args = [], { inherit = false, timeout = 120_000, env } = {}) {
  const result = spawnPortable(command, args, {
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : 'pipe',
    timeout,
    env: env ?? process.env,
  });
  const missing = result.error?.code === 'ENOENT' || (IS_WINDOWS && result.status === 1 && /not recognized/i.test(result.stderr ?? ''));
  return {
    ok: !result.error && result.status === 0,
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    missing,
  };
}
