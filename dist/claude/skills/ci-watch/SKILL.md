---
name: ci-watch
description: Follow a CI run or a deployment until it finishes, then act on the result - read the failure logs, find the cause, route the fix to the right agent, and re-check. Use after pushing (when the user approved the push), after opening a pull request, after a deployment starts, or when the user asks to watch CI or a deploy.
user-invocable: true
---

# Watch CI and deployments

## 1. Find what to watch
- GitHub Actions: `gh run list --branch <branch> --limit 5` (or `--commit <sha>`) for the run IDs.
- Vercel: the deployment URL from the deploy output, or `vercel ls` (see the `vercel` skill).

## 2. Wait without wasting turns
Run the waiting command **in the background** when your tool supports background commands, and continue with other work or stop until it is notified. Otherwise run it once with a generous timeout. Never poll in a tight loop.
- GitHub Actions: `gh run watch <id> --exit-status` (exits non-zero when the run fails).
- Vercel: `vercel inspect <url> --wait` (returns when the deployment is Ready or Error).
- Long or external waits (a release pipeline, a queue): check back at the interval the pipeline actually needs, for example every few minutes, not every few seconds.

## 3. When it fails
1. **Read the failure:** `gh run view <id> --log-failed` for the failing step; `vercel inspect <url> --logs` for a failed build; `vercel logs <url>` for runtime errors.
2. **Classify:**
   - **Code** (a test, type or lint error): route to the agent that owns that code (frontend, backend) with the log excerpt and the failing test.
   - **Pipeline** (workflow configuration, caching, permissions, missing secret name): route to `ci-engineer`.
   - **Infrastructure** (image build, environment variable missing on the platform, quota, provider outage): route to `infra-engineer`, or report to the user when it needs their account (secrets, billing, permissions).
   - **Flaky** (passes on rerun, timing, network): rerun once with `gh run rerun <id> --failed`; if it passes, report it as flaky with the test name rather than calling it fixed.
3. **Fix and re-watch:** after the fix (and the user's approval for any push), watch the new run the same way. At most 3 rounds, then escalate with what was tried.

## 4. When it passes
Report briefly: what ran, how long it took, the deployment URL for previews. For production, confirm the deployment is Ready and the site answers (`vercel curl <url>` or a request to a health endpoint).

## 5. Recurring checks (opt-in)
Some teams want scheduled checks: a weekly dependency audit, a nightly end-to-end run against staging. Set these up only when the user asks, with the tool's scheduling feature (for example a scheduled GitHub Actions workflow, or the AI tool's own scheduled tasks), and say what each run will cost in CI minutes or usage.
