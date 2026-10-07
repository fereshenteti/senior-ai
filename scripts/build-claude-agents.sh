#!/usr/bin/env bash
# Builds the Claude Code plugin agents (agents/*.md) from adapters/claude/agents/ (frontmatter)
# and prompts/ (shared system prompts). Run after changing either, and commit the result.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
rm -rf "$REPO/agents"
mkdir -p "$REPO/agents"
for header in "$REPO"/adapters/claude/agents/*.md; do
  name="$(basename "$header" .md)"
  { cat "$header"; echo; cat "$REPO/prompts/$name.md"; } > "$REPO/agents/$name.md"
done
echo "Built $(ls "$REPO/agents" | wc -l | tr -d ' ') agents in agents/"
