// Runs external commands the same way on macOS, Linux and Windows.

import { spawnSync } from 'node:child_process';

export const IS_WINDOWS = process.platform === 'win32';

// On Windows, CLIs are often .cmd shims (npm, uv) that only start through a shell,
// so arguments with spaces or quotes are quoted for cmd.exe.
function quoteForShell(arg) {
  return IS_WINDOWS && /[\s"&|<>^]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
}

// Returns { ok, status, stdout, stderr, missing, timedOut } and never throws.
export function runCommand(command, args = [], { inherit = false, timeout = 120_000, env } = {}) {
  const result = spawnSync(command, IS_WINDOWS ? args.map(quoteForShell) : args, {
    encoding: 'utf8',
    shell: IS_WINDOWS,
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
    timedOut: result.error?.code === 'ETIMEDOUT',
  };
}
