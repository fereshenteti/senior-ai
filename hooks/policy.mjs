// The safety policy shared by the hooks of every tool: what is never allowed, and what needs
// the user's approval first. Pure functions, so they are easy to test and to reason about.

// High-confidence secret formats only: a false alarm on every edit would be ignored.
const SECRET_PATTERNS = [
  ['a private key', /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/],
  ['an AWS access key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['a GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/],
  ['a GitLab token', /\bglpat-[A-Za-z0-9_-]{20,}\b/],
  ['a Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ['a Stripe live key', /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b/],
  ['a Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['an OpenAI or Anthropic API key', /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{32,}\b/],
  ['a JSON Web Token', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  ['a database URL with a password', /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:/@]+:[^\s@/]{3,}@/],
];

// Local secret files are where secrets belong; they must be git-ignored, not secret-free.
const LOCAL_SECRET_FILE = /(?:^|[\\/])\.env(?:\.(?!example$|sample$|template$)[\w.-]+)?$|(?:^|[\\/])\.dev\.vars$/;

export function findSecret(text) {
  for (const [label, pattern] of SECRET_PATTERNS) if (pattern.test(text)) return label;
  return null;
}

export function checkWrite(filePath, text) {
  if (!text || LOCAL_SECRET_FILE.test(filePath ?? '')) return { decision: 'allow' };
  const secret = findSecret(text);
  if (!secret) return { decision: 'allow' };
  return {
    decision: 'deny',
    reason:
      `senior-ai safety guard: this content contains what looks like ${secret}. Secrets never go into project files. ` +
      'Read it from an environment variable (and put the real value in a git-ignored .env file), ' +
      'or use an obvious placeholder in examples and tests.',
  };
}

// Commands that can destroy work or systems: refused outright.
const DESTRUCTIVE = [
  ['format or overwrite a disk', /\b(?:mkfs(?:\.\w+)?|dd\s+[^|;]*\bof=\/dev\/(?!null\b))/],
  ['force-push to the main branch', /\bgit\s+push\b(?=[^;&|]*(?:\s-f\b|--force\b|--force-with-lease\b))(?=[^;&|]*\b(?:main|master)\b)/],
  ['drop a database or schema', /\bdrop\s+(?:database|schema)\b/i],
  ['make the whole file system world-writable', /\bchmod\s+(?:-R\s+)?0?777\s+\/(?:\s|$)/],
];

// Actions that leave the machine, are hard to undo or cost money: the user approves each one.
const NEEDS_APPROVAL = [
  ['commit', /\bgit\s+commit\b/],
  ['push to a remote', /\bgit\s+push\b/],
  ['rewrite git history', /\bgit\s+(?:reset\s+--hard|rebase\b|filter-branch|filter-repo|clean\s+-[a-zA-Z]*f)/],
  ['open, merge or close a pull request', /\bgh\s+pr\s+(?:create|merge|close)\b/],
  ['publish a package', /\b(?:npm|pnpm|yarn)\s+publish\b/],
  // Bare `vercel` (with flags only) deploys; read-only subcommands (inspect, logs, ls, build, env ls…) don't ask.
  ['deploy', /\bvercel(?:\s+-{1,2}[\w=.-]+)*\s*(?:$|[;&|])|\bvercel\s+(?:deploy|promote|rollback|redeploy|remove|rm|alias)\b|\b(?:netlify\s+deploy|fly\s+deploy|firebase\s+deploy|terraform\s+(?:apply|destroy)|kubectl\s+(?:apply|delete|rollout)|helm\s+(?:install|upgrade|uninstall))\b/],
  ['change production settings (environment variables, domains, DNS)', /\bvercel\s+(?:env\s+(?:add|rm|remove|update)|domains\s+(?:add|rm|remove|move)|dns\s+(?:add|rm|remove))\b/],
  ['push an image', /\bdocker\s+push\b/],
  ['install or upgrade dependencies', /\b(?:npm\s+(?:i|install|add|update|upgrade)\s+\S|pnpm\s+(?:add|update|up)\b|yarn\s+(?:add|upgrade)\b|pip\s+install\s+(?!-r\b)\S|uv\s+add\b)/],
  ['run a database migration', /\b(?:prisma\s+migrate\s+(?:deploy|reset)|typeorm\s+migration:run|migrate\s+up)\b/],
];

// Targets that make a recursive rm wipe far more than a task ever needs.
const RM_DANGEROUS_TARGETS = new Set(['/', '/*', '~', '~/', '~/*', '$HOME', '$HOME/', '$HOME/*', '*', '.', './', './*', '..', '../', '../*']);

// True when one part of the command is a recursive rm aimed at /, ~, the current or parent folder.
function isDangerousRm(command) {
  for (const part of command.split(/;|&&|\|\||\|/)) {
    const tokens = part.trim().split(/\s+/).map(token => token.replace(/^["']|["']$/g, ''));
    const start = tokens.indexOf('rm');
    if (start === -1) continue;
    const args = tokens.slice(start + 1);
    const recursive = args.some(arg => arg === '--recursive' || /^-[a-zA-Z]*[rR]/.test(arg));
    if (recursive && args.some(arg => RM_DANGEROUS_TARGETS.has(arg))) return true;
  }
  return false;
}

export function checkCommand(command) {
  if (!command) return { decision: 'allow' };
  if (isDangerousRm(command)) {
    return { decision: 'deny', reason: 'senior-ai safety guard: refused, this command would delete the root, home, current or parent folder. If it is really needed, the user must run it themselves.' };
  }
  for (const [what, pattern] of DESTRUCTIVE) {
    if (pattern.test(command)) {
      return { decision: 'deny', reason: `senior-ai safety guard: refused, this command would ${what}. If it is really needed, the user must run it themselves.` };
    }
  }
  const secret = findSecret(command);
  if (secret) {
    return { decision: 'deny', reason: `senior-ai safety guard: the command contains what looks like ${secret}. Pass secrets through environment variables, never on the command line.` };
  }
  for (const [what, pattern] of NEEDS_APPROVAL) {
    if (pattern.test(command)) return { decision: 'ask', reason: `senior-ai: the agent wants to ${what}. Approve only if you expect it.` };
  }
  return { decision: 'allow' };
}

// Tool names of Claude Code, Vibe, and Vibe's Unified Harness (namespaced: file_system.*, process.*).
const SHELL_TOOLS = ['bash', 'git_bash', 'powershell', 'shell', 'file_system.bash', 'process.start'];
const WRITE_TOOLS = ['write', 'write_file', 'file_system.write_file'];
const EDIT_TOOLS = ['edit', 'multiedit', 'file_system.search_replace'];

// The text an edit adds: Claude/Vibe `new_string`, Claude `edits[]`, Unified Harness `content[].new_str`.
function addedText(input) {
  if (typeof input.new_string === 'string') return input.new_string;
  const changes = Array.isArray(input.edits) ? input.edits : Array.isArray(input.content) ? input.content : [];
  return changes.map(change => change.new_string ?? change.new_str ?? '').join('\n');
}

export const editedFile = input => input.file_path ?? input.path;

// One decision for a tool call from Claude Code or Vibe.
export function checkToolCall(toolName, input = {}) {
  const tool = String(toolName).toLowerCase();
  if (SHELL_TOOLS.includes(tool)) return checkCommand(input.command);
  if (WRITE_TOOLS.includes(tool)) return checkWrite(editedFile(input), input.content);
  if (EDIT_TOOLS.includes(tool)) return checkWrite(editedFile(input), addedText(input));
  return { decision: 'allow' };
}
