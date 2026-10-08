# Safety hooks

Hooks are small scripts the AI tool runs automatically at certain moments. They enforce what the rules only ask for.

| Hook | When | What it does | Claude Code | Vibe |
|---|---|---|---|---|
| Session context | Session start, resume, `/clear`, compaction | Loads the global rules and the project's `.senior-ai/status.md` | ✓ | rules are in `AGENTS.md` |
| Safety guard | Before every shell command, file write and edit | Refuses destructive commands and secrets in files; asks you before sensitive actions | ✓ refuses and asks | ✓ refuses; Vibe's own approval prompt asks |
| Format and lint | After every file write or edit | Formats the file with the project's Prettier, sends its ESLint errors back to the agent | ✓ | ✓ |
| Done gate | When the agent is about to finish | If code changed and nothing was built, tested, linted or reviewed, sends the agent back once to verify or explain | ✓ | — |
| Report check | When a reviewer's report comes back | Makes sure the report has its `Verdict: PASS` or `Verdict: FAIL` line | ✓ | — |
| Update notice | Session start (Claude), after an answer at most once a day (Vibe) | Tells you when a newer senior-ai is on GitHub, with the update command | ✓ | ✓ |

All hooks run with Node (`node <script>`), the same way on macOS, Linux and Windows. A hook that fails for an unexpected reason stays silent: it never blocks your work.

## Refused

- Recursive deletion of the root, home, current or parent folder (`rm -rf /`, `rm -rf ~`, `rm -rf .`, …)
- Formatting or overwriting disks (`mkfs`, `dd … of=/dev/…`)
- Force-pushing to `main` or `master`
- Dropping a database or schema
- Secrets written into project files or passed on a command line: private keys, AWS, GitHub, GitLab, Slack, Stripe live, Google, OpenAI and Anthropic keys, JSON Web Tokens, database URLs with a password. Local secret files (`.env`, `.env.local`, …) are allowed; `.env.example` is not.

If one of these is really needed, run it yourself.

## Needs your approval (Claude Code asks; in Vibe, its own approval prompt does)

`git commit`, `git push`, history rewrites (`git reset --hard`, `rebase`), opening, merging or closing pull requests, publishing packages, deploying (Vercel, Netlify, Fly, Firebase, Terraform, Kubernetes, Helm), pushing Docker images, installing or upgrading dependencies, running database migrations.

## Format and lint

Only the project's own tools are used (`node_modules/.bin/prettier` and `node_modules/.bin/eslint`); nothing is installed. Files in `node_modules`, `dist`, `build`, `coverage`, `.git` and `.senior-ai` are skipped.

## Where they live

- Source: `hooks/` in this repo; `hooks/registry.json` says which hook runs where.
- Claude Code: generated into the plugin's `hooks/hooks.json`.
- Vibe: a marked block in `~/.vibe/hooks.toml`, scripts in `~/.vibe/senior-ai/`.
