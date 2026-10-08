#!/usr/bin/env bash
# Prepares a Claude Code plugin release: sets the version in both .claude-plugin manifests,
# rebuilds agents/ from prompts/ and validates the plugin. Commit and push afterwards.
#   scripts/release.sh 1.2.0
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${1:-}"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Usage: scripts/release.sh <major.minor.patch>" >&2; exit 2; }

cd "$REPO"
node - "$VERSION" <<'JS'
const fs = require('node:fs');
const version = process.argv[2];
const update = (file, apply) => {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  apply(json);
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
};
update('.claude-plugin/plugin.json', json => { json.version = version; });
update('.claude-plugin/marketplace.json', json => {
  const entry = json.plugins.find(plugin => plugin.name === 'senior-ai');
  if (!entry) throw new Error('senior-ai entry missing from marketplace.json');
  entry.version = version;
});
JS
echo "Version set to $VERSION in .claude-plugin/plugin.json and .claude-plugin/marketplace.json"

scripts/build-claude-agents.sh
claude plugin validate . >/dev/null && echo "Plugin valid"

cat <<MSG

Next:
  git commit -am "Release $VERSION" && git push
Each machine is then told about $VERSION within a day and shown how to update.
MSG
