#!/usr/bin/env bash
# senior-ai installer for Mistral Vibe and/or Claude Code. Safe to re-run.
#   Vibe: copies (or symlinks) the shared skills, prompts, agents and rules into ~/.vibe; existing files are backed up.
#   Claude Code: installs the senior-ai plugin from the feres marketplace (this repo).
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="${SENIOR_AI_STATE_DIR:-$HOME/.senior-ai}"
VIBE_DIR="${SENIOR_AI_VIBE_DIR:-$HOME/.vibe}"
MARK_START='<!-- senior-ai:start -->'
MARK_END='<!-- senior-ai:end -->'
TOML_MARK_START='# senior-ai:start'
TOML_MARK_END='# senior-ai:end'
MARKETPLACE="feres"
PLUGIN="senior-ai@$MARKETPLACE"
GITHUB_REPO="fereshenteti/senior-ai"
BACKUP_ROOT="$STATE_DIR/backups/$(date +%Y%m%d-%H%M%S)"

TOOL=""
MODE="copy"
ACTION="install"
DRY_RUN=0
CURRENT_TOOL=""

usage() {
  cat <<EOF
Usage: ./install.sh [--tool vibe|claude|both] [--link] [--uninstall] [--dry-run]

  --tool <name>   Which AI tool to install for: vibe, claude or both (default: both).
                  Without --tool, you are asked interactively.
  --link          Use this folder directly instead of a copy. Vibe: symlinks into ~/.vibe.
                  Claude Code: the plugin is read from this folder instead of GitHub.
                  Edits and 'git pull' apply immediately, but the repo must stay in place.
  --uninstall     Remove everything senior-ai installed and restore backups.
  --dry-run       Show what would happen without changing anything.
EOF
}

die() { echo "Error: $*" >&2; exit 2; }
say() { echo "$*"; }
pretty() { echo "${1/#$HOME/~}"; }

run() {
  if [ "$DRY_RUN" = 1 ]; then
    echo "  [dry-run] $*"
  else
    "$@"
  fi
}

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --tool)
        [ $# -ge 2 ] || die "--tool needs a value (vibe, claude or both)"
        TOOL="$2"; shift 2 ;;
      --tool=*) TOOL="${1#*=}"; shift ;;
      --link) MODE="link"; shift ;;
      --uninstall) ACTION="uninstall"; shift ;;
      --dry-run) DRY_RUN=1; shift ;;
      -h|--help) usage; exit 0 ;;
      *) usage >&2; die "unknown option: $1" ;;
    esac
  done
}

choose_tool() {
  if [ -z "$TOOL" ]; then
    if [ -t 0 ]; then
      say "Which AI tool should senior-ai be ${ACTION}ed for?"
      say "  1) Both Mistral Vibe and Claude Code (default)"
      say "  2) Mistral Vibe only"
      say "  3) Claude Code only"
      printf "Choice [1]: "
      read -r choice
      case "${choice:-1}" in
        1|both) TOOL="both" ;;
        2|vibe) TOOL="vibe" ;;
        3|claude) TOOL="claude" ;;
        *) die "invalid choice: $choice" ;;
      esac
    else
      TOOL="both"
    fi
  fi
  case "$TOOL" in
    both) TOOLS="vibe claude" ;;
    vibe|claude) TOOLS="$TOOL" ;;
    *) die "--tool must be vibe, claude or both (got: $TOOL)" ;;
  esac
}

# --- manifest: one line per installed item, "<dest><TAB><backup or empty>" ------------

manifest() { echo "$STATE_DIR/$1.manifest"; }

record() {
  [ "$DRY_RUN" = 1 ] && return 0
  mkdir -p "$STATE_DIR"
  printf '%s\t%s\n' "$1" "$2" >> "$(manifest "$CURRENT_TOOL")"
}

# Backup recorded for <dest> by a previous install of the current tool (kept across re-installs).
previous_backup() {
  local prev
  prev="$(manifest "$CURRENT_TOOL").prev"
  [ -f "$prev" ] || return 0
  awk -F '\t' -v d="$1" '$1 == d { print $2; exit }' "$prev"
}

backup_path() {
  local dest="$1" rel
  case "$dest" in
    "$HOME"/*) rel="${dest#"$HOME"/}" ;;
    *) rel="${dest#/}" ;;
  esac
  echo "$BACKUP_ROOT/$CURRENT_TOOL/$rel"
}

# place <src> <dest> [copy]: symlink (or copy) src to dest, backing up whatever is there.
place() {
  local src="$1" dest="$2" how="${3:-$MODE}" backup
  backup="$(previous_backup "$dest")"
  if [ -e "$dest" ] || [ -L "$dest" ]; then
    backup="$(backup_path "$dest")"
    run mkdir -p "$(dirname "$backup")"
    run mv "$dest" "$backup"
    say "  backed up existing $(pretty "$dest") → $(pretty "$backup")"
  fi
  run mkdir -p "$(dirname "$dest")"
  if [ "$how" = "link" ]; then
    run ln -s "$src" "$dest"
  else
    run cp -R "$src" "$dest"
  fi
  record "$dest" "$backup"
}

# --- marked blocks inside files the user owns (CLAUDE.md, an existing AGENTS.md) ---------

strip_block() {
  local file="$1" tmp
  [ -f "$file" ] || return 0
  grep -qF "$MARK_START" "$file" || return 0
  [ "$DRY_RUN" = 1 ] && { echo "  [dry-run] remove senior-ai block from $(pretty "$file")"; return 0; }
  tmp="$(mktemp)"
  # Drop the block and any trailing blank lines it leaves behind.
  awk -v s="$MARK_START" -v e="$MARK_END" '
    $0 == s { skip = 1; next }
    $0 == e { skip = 0; next }
    skip { next }
    /^[[:space:]]*$/ { blank = blank $0 "\n"; next }
    { printf "%s", blank; blank = ""; print }
  ' "$file" > "$tmp"
  cat "$tmp" > "$file"
  rm -f "$tmp"
}

# add_block <file> <content-file>: append content between markers; records "block:<file>".
add_block() {
  local file="$1" content="$2" created=""
  [ -f "$file" ] || created="created"
  if [ "$DRY_RUN" = 1 ]; then
    echo "  [dry-run] add senior-ai block to $(pretty "$file")"
    return 0
  fi
  mkdir -p "$(dirname "$file")"
  strip_block "$file"
  {
    [ -s "$file" ] && echo
    echo "$MARK_START"
    cat "$content"
    echo "$MARK_END"
  } >> "$file"
  record "${BLOCK_KIND:-block}:$file" "$created"
}

remove_block() {
  local file="$1" created="$2"
  strip_block "$file"
  if [ "$created" = "created" ] && [ -f "$file" ] && ! grep -q '[^[:space:]]' "$file"; then
    run rm -f "$file"
  fi
}

# --- uninstall ----------------------------------------------------------------------------

# remove_installed <tool> <restore 0|1>
remove_installed() {
  local tool="$1" restore="$2" file dest backup
  file="$(manifest "$tool")"
  [ -f "$file" ] || return 0
  while IFS="$(printf '\t')" read -r dest backup; do
    [ -n "$dest" ] || continue
    case "$dest" in
      block:*) remove_block "${dest#block:}" "$backup"; continue ;;
      tomlblock:*) MARK_START="$TOML_MARK_START" MARK_END="$TOML_MARK_END" remove_block "${dest#tomlblock:}" "$backup"; continue ;;
      plugin:*) remove_plugin; continue ;;
    esac
    if [ -e "$dest" ] || [ -L "$dest" ]; then
      run rm -rf "$dest"
    fi
    if [ "$restore" = 1 ] && [ -n "$backup" ] && [ -e "$backup" ]; then
      run mv "$backup" "$dest"
      say "  restored $(pretty "$dest")"
    fi
  done < "$file"
}

# After a re-install, restore backups of items that are no longer part of senior-ai.
restore_orphans() {
  local prev dest backup
  prev="$(manifest "$CURRENT_TOOL").prev"
  [ -f "$prev" ] || return 0
  while IFS="$(printf '\t')" read -r dest backup; do
    case "$dest" in block:*|tomlblock:*|plugin:*|"") continue ;; esac
    if [ -n "$backup" ] && [ -e "$backup" ] && [ ! -e "$dest" ] && [ ! -L "$dest" ]; then
      run mv "$backup" "$dest"
      say "  restored $(pretty "$dest") (no longer provided by senior-ai)"
    fi
  done < "$prev"
  [ "$DRY_RUN" = 1 ] || rm -f "$prev"
}

begin_tool() {
  CURRENT_TOOL="$1"
  local file
  file="$(manifest "$CURRENT_TOOL")"
  if [ -f "$file" ]; then
    remove_installed "$CURRENT_TOOL" 0
    [ "$DRY_RUN" = 1 ] || mv "$file" "$file.prev"
  fi
}

# --- per-tool installs --------------------------------------------------------------------

install_skills() {
  local target="$1" dir name
  for dir in "$REPO"/skills/*/; do
    name="$(basename "$dir")"
    place "${dir%/}" "$target/skills/$name"
  done
}

install_vibe() {
  begin_tool vibe
  say "Mistral Vibe → $(pretty "$VIBE_DIR")"
  [ -d "$VIBE_DIR" ] || say "  note: $(pretty "$VIBE_DIR") does not exist yet; creating it."

  install_skills "$VIBE_DIR"

  local f
  for f in "$REPO"/prompts/*.md; do
    place "$f" "$VIBE_DIR/prompts/$(basename "$f")"
  done
  for f in "$REPO"/adapters/vibe/agents/*.toml; do
    place "$f" "$VIBE_DIR/agents/$(basename "$f")"
  done

  # Global rules: install AGENTS.md, or append to the user's own AGENTS.md if they have one.
  local agents="$VIBE_DIR/AGENTS.md"
  if [ -f "$agents" ] && [ ! -L "$agents" ] && [ -z "$(previous_backup "$agents")" ]; then
    add_block "$agents" "$REPO/AGENTS.md"
    say "  appended senior-ai rules to your existing $(pretty "$agents") (re-run the installer after updating AGENTS.md)"
  else
    place "$REPO/AGENTS.md" "$agents"
  fi

  # Update notice: a post_agent hook that tells the user when GitHub has a newer version.
  local notice_dir="$VIBE_DIR/senior-ai" tmpdir
  tmpdir="$(mktemp -d)"
  json_field version < "$REPO/.claude-plugin/plugin.json" > "$tmpdir/VERSION"
  echo "$REPO" > "$tmpdir/SOURCE"
  cat > "$tmpdir/hooks.toml" <<TOML
[[hooks]]
name = "senior-ai-update-check"
type = "post_agent"
command = "bash '$notice_dir/check-update.sh' --tool vibe"
timeout = 10.0
description = "Tell the user when a newer senior-ai version is available."
TOML
  place "$REPO/hooks/check-update.sh" "$notice_dir/check-update.sh" copy
  place "$tmpdir/VERSION" "$notice_dir/VERSION" copy
  place "$tmpdir/SOURCE" "$notice_dir/SOURCE" copy
  BLOCK_KIND=tomlblock MARK_START="$TOML_MARK_START" MARK_END="$TOML_MARK_END" \
    add_block "$VIBE_DIR/hooks.toml" "$tmpdir/hooks.toml"
  rm -rf "$tmpdir"
  restore_orphans
}

json_field() { sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\\1/p" | head -1; }

claude_cli() {
  command -v claude >/dev/null 2>&1 || die "the 'claude' CLI is not on your PATH; install Claude Code first."
  run claude plugin "$@"
}

remove_plugin() {
  claude_cli uninstall "$PLUGIN" >/dev/null 2>&1 || true
  claude_cli marketplace remove "$MARKETPLACE" >/dev/null 2>&1 || true
}

install_claude() {
  begin_tool claude
  local source="$GITHUB_REPO"
  [ "$MODE" = "link" ] && source="$REPO"
  say "Claude Code → plugin $PLUGIN from $(pretty "$source")"

  # Re-register the marketplace so a switch between GitHub and this folder takes effect.
  claude_cli marketplace remove "$MARKETPLACE" >/dev/null 2>&1 || true
  claude_cli marketplace add "$source"
  claude_cli install "$PLUGIN"
  record "plugin:$PLUGIN" ""
  restore_orphans
}

next_steps() {
  say ""
  say "Done. Next steps:"
  case " $TOOLS " in
    *" vibe "*)
      say "  Vibe:   merge adapters/vibe/config.example.toml into $(pretty "$VIBE_DIR")/config.toml (MCP servers),"
      say "          then start with: vibe --agent ui-builder" ;;
  esac
  case " $TOOLS " in
    *" claude "*)
      say "  Claude: add MCP servers with the commands in adapters/claude/mcp.md,"
      say "          then start with: claude --agent ui-builder"
      say "          Updates: claude plugin update $PLUGIN (you are told when one is available)" ;;
  esac
  say "  Per project: run /senior-ai:setup-project (Claude Code) or the setup-project skill (Vibe) from the project root."
  case " $TOOLS " in
    *" vibe "*) [ "$MODE" = "copy" ] && say "  Vibe files were copied: re-run ./install.sh after changing anything in this repo (or install with --link)." ;;
  esac
  return 0
}

main() {
  parse_args "$@"
  choose_tool
  [ "$DRY_RUN" = 1 ] && say "(dry run: nothing will be changed)"

  if [ "$ACTION" = "uninstall" ]; then
    local t
    for t in $TOOLS; do
      say "Uninstalling senior-ai from $t"
      remove_installed "$t" 1
      [ "$DRY_RUN" = 1 ] || rm -f "$(manifest "$t")"
      # Folders senior-ai created; rmdir only removes them if nothing else is inside.
      if [ "$t" = vibe ] && [ "$DRY_RUN" = 0 ]; then
        rmdir "$VIBE_DIR"/{senior-ai,skills,agents,prompts} 2>/dev/null || true
      fi
    done
    say "Done."
    return 0
  fi

  say "Installing senior-ai ($MODE mode) from $(pretty "$REPO")"
  case " $TOOLS " in *" vibe "*) install_vibe ;; esac
  case " $TOOLS " in *" claude "*) install_claude ;; esac
  next_steps
}

main "$@"
