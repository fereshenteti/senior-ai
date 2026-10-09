# Maintaining senior-ai

## Structure

```
senior-ai.json                  name, version, description (single source)
AGENTS.md                       global rules
departments/<dept>/
  agents/<name>.md              one agent: neutral frontmatter + instructions
  skills/<name>/SKILL.md        one skill (+ references/, scripts/, templates/)
hooks/                          hook scripts (Node) + registry.json
extras/<id>.json                optional MCP servers and companion plugins
build/                          generators: neutral sources → each tool's format
dist/claude/, dist/vibe/        generated, committed (Claude installs from GitHub)
.claude-plugin/marketplace.json generated: the feres marketplace
installer/ + install.mjs        the installer; install.sh and install.cmd start it
tests/                          unit, installer and hook tests; fixtures/; evals/
scripts/                        test runner, release, context measurement
```

Edit the sources, never `dist/`. After any change to agents, skills, hooks, rules or `senior-ai.json`:

```bash
node build/index.mjs
```

CI fails when `dist/` is out of date (`node build/index.mjs --check`).

`build/project.mjs` installs senior-ai into a project, in each tool's own folders, using the same generators; the `setup-project` skill runs it from the senior-ai found on the machine.

## Agent format

```markdown
---
name: architect                 # = file name
department: core                # = folder
description: …                  # when to use it; shown to the tools
role: maker                     # maker (edits files) | checker (read-only)
entry: subagent                 # main (Vibe: Shift+Tab) | subagent (delegated to) | both (Vibe gets a main and a <name>-subagent profile)
model: top                      # session | small | mid | top (Claude: inherit, haiku, sonnet, opus)
needs_vision: false             # true when it must read images
---
You are **architect**, …
```

Generated per tool: Claude gets `agents/<name>.md` (checkers get read-only tools); Vibe gets `agents/<name>.toml` + `prompts/<name>.md` (checkers can't edit or write), with Vibe-specific notes appended: main agents may delegate to every senior-ai subagent and run the review loop for subagent makers, which hand their work back with `Ready for review by:` (Vibe allows one level of delegation).

## Adding things

- **An agent:** a file in `departments/<dept>/agents/`. Add it to the routing table in the `orchestrate` skill and to `docs/team.md`. A checker must start its reports with the `review-loop` verdict line.
- **A skill:** a folder in `departments/<dept>/skills/<name>/` with `SKILL.md` (`name`, `description`, `user-invocable`). Keep it tool-neutral: say "run the command", never a tool-specific tool name, and don't set `allowed-tools`. Keep `SKILL.md` short and move details to `references/`. One skill per folder, directly under `skills/` (Vibe doesn't find nested skills).
- **A stack** (NestJS, PostgreSQL, Docker…): a skill in its department, loaded when a project uses that technology. Agents stay stack-neutral.
- **A department:** a folder in `departments/` with `agents/` and `skills/`. The generators pick it up.
- **A hook:** a Node script in `hooks/` using `lib.mjs`, and an entry in `hooks/registry.json` with a `claude` and/or `vibe` section. Hooks must fail open.
- **An extra:** a JSON file in `extras/` (see the existing ones). Validate a Vibe MCP entry with Vibe's own config model when you can.
- **An AI tool:** an entry in `installer/tools.mjs`, a generator in `build/`, and an install module in `installer/`.

## Tests

```bash
node scripts/test.mjs
```

Runs on every push on macOS, Linux and Windows (Node 22 and 24). Installer tests run `install.mjs` in a fake home with fake `claude` and `vibe` commands; hook tests run each generated hook with real event shapes.

**Evaluations** run real agents on a copy of `tests/fixtures/sample-app` and check what they produce. They use your AI tool's usage, so they run on demand:

```bash
node tests/evals/run.mjs
```

```bash
node tests/evals/run.mjs --tool vibe db-reviewer
```

Vibe evaluations use the installed senior-ai (re-run the installer first) and go through the orchestrator, since Vibe can't start a subagent directly.

**Context cost** of senior-ai per session:

```bash
node scripts/measure-context.mjs
```

## Trying changes before pushing

- Claude Code: `claude --plugin-dir dist/claude`, or `./install.sh --tool claude --link` (the plugin is read from this folder).
- Vibe: `./install.sh --tool vibe` (or `--link`).
- From a branch on GitHub: `SENIOR_AI_SOURCE='fereshenteti/senior-ai#<branch>' ./install.sh`.

## Releasing

```bash
node scripts/release.mjs 1.1.0
```

It sets the version in `senior-ai.json`, regenerates everything and validates the Claude plugin. Commit and push: every machine is told about the new version (Claude Code at session start, Vibe at most once a day) with the command to update. Claude Code only installs a change when the version number goes up.
