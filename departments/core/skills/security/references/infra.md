# Security checklist: infrastructure, dependencies and CI

## Secrets
- [ ] No secrets in the repository: code, config, `.env` files, Docker files, CI files, tests, fixtures, documentation. `.env` and similar files are git-ignored; only `.env.example` with placeholders is committed.
- [ ] Secrets come from the platform's secret store (CI secrets, Vercel/cloud environment variables, a vault) and are scoped to the environments that need them.
- [ ] A secret that was ever committed or printed in a log is revoked and rotated, not just removed.

## Dependencies and supply chain
- [ ] Lockfile committed; installs in CI use it (`npm ci`).
- [ ] No known high or critical vulnerabilities (`npm audit --omit=dev`, or the ecosystem's equivalent), or each one is documented with why it does not apply.
- [ ] New dependencies are maintained, widely used and licence compatible; no install scripts from unknown packages.
- [ ] Automated update PRs (Dependabot or Renovate) enabled for security fixes.

## Containers
- [ ] Minimal, pinned base images; multi-stage builds so build tools and sources don't ship.
- [ ] Containers run as a non-root user; no secrets baked into image layers or build args.
- [ ] Only the needed ports exposed; health checks defined.

## CI/CD
- [ ] Workflows use the least privileges (`permissions:` set explicitly, read-only by default).
- [ ] Third-party actions pinned to a version or commit SHA.
- [ ] Untrusted pull requests cannot reach secrets (no `pull_request_target` with checkout of PR code).
- [ ] Production deploys require the main branch and passing checks; manual approval for production when the team wants it.

## Cloud and hosting
- [ ] HTTPS everywhere; HSTS on production domains.
- [ ] Databases and internal services not reachable from the public internet; access by private network or allow-listed IPs.
- [ ] Backups enabled and restore tested for production data.
- [ ] Preview and staging environments don't use production data or production secrets.
