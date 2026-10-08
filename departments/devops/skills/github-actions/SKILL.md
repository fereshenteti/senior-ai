---
name: github-actions
description: CI/CD with GitHub Actions - workflows for tests, builds, previews and releases that are fast (caching, concurrency, path filters), reliable (required checks, matrix) and secure (least-privilege permissions, pinned actions, secrets, OIDC, safe pull-request triggers). Use when writing, changing, debugging or reviewing workflows in .github/workflows.
user-invocable: true
---

# GitHub Actions

## 1. Workflow shape
- One workflow per purpose: `ci.yml` (lint, type-check, test, build on every push and pull request), `deploy.yml` / `release.yml` (on the main branch or tags).
- Triggers: `pull_request` for checks on PRs; `push` on `main`; `workflow_dispatch` for manual runs. Path filters only when they can't skip a required check.
- `concurrency` with `cancel-in-progress: true` for PR checks, so a new push cancels the old run; never cancel production deploys mid-way.
- Jobs in parallel when independent (`lint`, `test`, `build`), `needs:` for real dependencies; `timeout-minutes` on every job.
- Matrix for the OSes and runtime versions the project supports, with `fail-fast: false` when every result matters.

## 2. Speed
- Dependency cache through the setup action (`actions/setup-node` with `cache: npm`) and `npm ci`.
- Build once, reuse: upload the build as an artifact for later jobs instead of rebuilding.
- Run the slowest suites (end-to-end) in their own job, in parallel shards when long.

## 3. Security
- Top-level `permissions:` read-only (`contents: read`); grant more per job only where needed (`pull-requests: write`, `id-token: write` for OIDC).
- **Pin third-party actions to a full commit SHA** (with the version in a comment); official `actions/*` to at least a major version.
- Secrets only through `secrets.*` and environment secrets; never echo them; mask derived values (`::add-mask::`).
- **Untrusted pull requests:** never combine `pull_request_target` (or `workflow_run`) with a checkout of the PR's code and access to secrets. Use `pull_request` for running PR code.
- Don't interpolate untrusted input (`${{ github.event.pull_request.title }}`, branch names, issue bodies) directly in `run:` scripts; pass it through `env:` and quote it.
- Cloud deployments use OIDC (`id-token: write`) instead of long-lived cloud keys where the provider supports it.
- Production deploys run from `main` only, behind a GitHub **environment** with required reviewers when the team wants an approval step.

## 4. Reliability
- The checks that guard `main` are marked required in branch protection; their job names stay stable.
- Flaky tests are fixed or quarantined with an issue, not retried silently.
- Dependabot or Renovate keeps actions and dependencies updated.

## 5. Debugging a failed run
`gh run list`, `gh run view <id> --log-failed` for the failing step's log, `gh run rerun <id> --failed` after a fix or for infrastructure flakiness. Reproduce locally with the same commands and versions before changing the workflow.

## 6. Review checklist
- [ ] `permissions` least-privilege at the top and per job.
- [ ] Third-party actions pinned to a commit SHA.
- [ ] No `pull_request_target` with PR code checkout and secrets; no untrusted input interpolated in `run:`.
- [ ] Secrets only via `secrets.*`; nothing printed.
- [ ] `concurrency`, `timeout-minutes`, caching in place.
- [ ] Deploys gated to `main` / environments; production approval when required.
