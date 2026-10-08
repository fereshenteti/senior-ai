#!/usr/bin/env node
// senior-ai :: SessionStart (Claude Code)
// Injects the global senior-ai rules (AGENTS.md at the plugin root) into every session,
// so they apply without any @import in ~/.claude/CLAUDE.md. Never fails the session.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SETUP_HINT =
  'This project has no AGENTS.md or CLAUDE.md yet. Mention once that /senior-ai:setup-project integrates ' +
  'senior-ai into the project (shared plugin settings for the team and a project AGENTS.md with its stack ' +
  'and design source). Do not run it unasked.';

try {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  let context = fs.readFileSync(path.join(pluginRoot, 'AGENTS.md'), 'utf8').trimEnd();
  if (!context) process.exit(0);
  const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const hasProjectRules = ['AGENTS.md', 'CLAUDE.md'].some(name => fs.existsSync(path.join(projectRoot, name)));
  if (!hasProjectRules) context += `\n\n${SETUP_HINT}`;
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context } }));
} catch {
  // No rules file or unreadable project: start the session without them.
}
