#!/usr/bin/env bash
# senior-ai :: update notice
# Tells the user when GitHub has a newer senior-ai version, with the command to update.
# It never updates anything. GitHub is checked at most once a day; any failure stays silent.
#   check-update.sh --tool claude   Claude Code SessionStart hook
#   check-update.sh --tool vibe     Vibe post_agent hook (shows the notice once per session)

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

if [ "$TOOL" = vibe ]; then
  session="$(sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
  notified="$STATE_DIR/vibe-notified-session"
  [ -n "$session" ] && [ "$session" = "$(cat "$notified" 2>/dev/null)" ] && exit 0
fi

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
  mkdir -p "$STATE_DIR" && printf '%s\n' "$session" > "$notified"
  printf '{"system_message":"%s"}\n' "$(json_string "$notice")"
fi
exit 0
