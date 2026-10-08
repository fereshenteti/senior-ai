#!/bin/sh
# senior-ai installer for macOS and Linux: runs install.mjs with Node.js (see install.mjs for options).
command -v node >/dev/null 2>&1 || { echo "Error: Node.js is required: https://nodejs.org" >&2; exit 2; }
exec node "$(dirname "$0")/install.mjs" "$@"
