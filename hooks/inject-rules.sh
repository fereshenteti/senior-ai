#!/usr/bin/env bash
# senior-ai :: SessionStart
# Injects the global senior-ai rules (AGENTS.md at the plugin root) into every session,
# so they apply without any @import in ~/.claude/CLAUDE.md. Never fails the session.

set -uo pipefail

rules="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}/AGENTS.md"
[ -f "$rules" ] || exit 0

out="$(cat "$rules")"
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
if [ ! -f "$root/AGENTS.md" ] && [ ! -f "$root/CLAUDE.md" ]; then
  out="${out}"$'\n\n'"This project has no AGENTS.md or CLAUDE.md yet. Mention once that /senior-ai:init integrates senior-ai into the project (shared plugin settings for the team and a project AGENTS.md with its stack and design source). Do not run it unasked."
fi

esc="$(printf '%s' "$out" | perl -0777 -pe '
  s/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g; s/\r/\\r/g; s/\t/\\t/g;
  s/([\x00-\x1f])/sprintf("\\u%04x",ord($1))/ge;
')"
printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$esc"
exit 0
