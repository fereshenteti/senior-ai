#!/usr/bin/env bash
# senior-ai :: update notice
# Tells the user when GitHub has a newer senior-ai version, with the command to update.
# It never updates anything. GitHub is checked at most once a day; any failure stays silent.
#   check-update.sh --tool claude   Claude Code SessionStart hook
#   check-update.sh --tool vibe     Vibe post_agent hook (runs after every answer; shows the notice at most once a day)

set -uo pipefail

LATEST_URL="https://raw.githubusercontent.com/fereshenteti/senior-ai/main/.claude-plugin/plugin.json"
STATE_DIR="${SENIOR_AI_STATE_DIR:-$HOME/.senior-ai}"
HERE="$(cd "$(dirname "$0")" && pwd)"
TOOL="${2:-}"
[ "${1:-}" = "--tool" ] && { [ "$TOOL" = claude ] || [ "$TOOL" = vibe ]; } || exit 0

json_version() { sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1; }

# Vibe installs record the version in VERSION; the Claude plugin reads its own manifest.
installed_version() {
  if [ -f "$HERE/VERSION" ]; then
    cat "$HERE/VERSION"
  else
    json_version 2>/dev/null < "$HERE/../.claude-plugin/plugin.json"
  fi
}

latest_version() {
  local cache="$STATE_DIR/latest-version" fetched
  if [ -n "$(find "$cache" -mmin -1440 2>/dev/null)" ]; then
    cat "$cache"
    return
  fi
  fetched="$(curl -fsS --max-time 3 "$LATEST_URL" 2>/dev/null | json_version)"
  if [ -n "$fetched" ]; then
    mkdir -p "$STATE_DIR" && printf '%s\n' "$fetched" > "$cache"
    echo "$fetched"
  elif [ -f "$cache" ]; then
    cat "$cache"
  fi
}

# version_gt A B: true when A is a higher major.minor.patch than B.
version_gt() {
  local IFS=. i
  local -a a=($1) b=($2)
  for i in 0 1 2; do
    [ "${a[i]:-0}" -gt "${b[i]:-0}" ] 2>/dev/null && return 0
    [ "${a[i]:-0}" -lt "${b[i]:-0}" ] 2>/dev/null && return 1
  done
  return 1
}

json_string() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

# Vibe has no session-start hook and does not always send a session id, so it is throttled by time.
vibe_notified="$STATE_DIR/vibe-notified"
[ "$TOOL" = vibe ] && [ -n "$(find "$vibe_notified" -mmin -1440 2>/dev/null)" ] && exit 0

installed="$(installed_version)"
latest="$(latest_version)"
[ -n "$installed" ] && [ -n "$latest" ] && version_gt "$latest" "$installed" || exit 0

notice="senior-ai $latest is available (you have $installed)."
if [ "$TOOL" = claude ]; then
  notice="$notice To update, run in a terminal: claude plugin update senior-ai@feres, then restart Claude Code."
  printf '{"systemMessage":"%s"}\n' "$(json_string "$notice")"
else
  source_dir="$(cat "$HERE/SOURCE" 2>/dev/null || echo "<your senior-ai clone>")"
  notice="$notice To update, run: cd \"$source_dir\" && git pull && ./install.sh --tool vibe"
  mkdir -p "$STATE_DIR" && touch "$vibe_notified"
  printf '{"system_message":"%s"}\n' "$(json_string "$notice")"
fi
exit 0
