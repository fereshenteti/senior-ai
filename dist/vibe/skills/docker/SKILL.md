---
name: docker
description: Containers with Docker and Docker Compose - small, secure, reproducible images (multi-stage builds, pinned bases, non-root user, .dockerignore, health checks, build secrets) and Compose setups for local development and tests. Use when writing or reviewing a Dockerfile, compose.yaml, container configuration, or a container build in CI.
user-invocable: true
---

# Docker

## 1. Dockerfile
- **Multi-stage:** a build stage with the toolchain and dev dependencies, a runtime stage with only what runs. Sources, tests and build tools don't ship.
- **Base image:** official, minimal and **pinned**: a specific version tag (`node:22.x-slim`, `node:22-alpine` when the app works with musl), ideally with its digest (`@sha256:…`). Never `latest`.
- **Layers for cache:** copy the lockfile first, install (`npm ci --omit=dev` in the runtime stage), then copy the sources. Combine `apt-get update && apt-get install` in one `RUN` with `--no-install-recommends` and clean the lists.
- **`.dockerignore`:** `node_modules`, `.git`, `.env*`, build output, test and coverage folders, so they never enter the build context.
- **Non-root:** `USER node` (or a dedicated user) in the runtime stage; files owned by root and read-only where possible.
- **Secrets:** never in `ENV`, `ARG` or a copied file; they stay in image layers forever. Build-time secrets use BuildKit (`RUN --mount=type=secret,id=npm_token …`); runtime secrets come from the platform's environment variables.
- **Runtime:** `EXPOSE` the real port, `HEALTHCHECK` (or the orchestrator's equivalent), exec-form `CMD ["node", "dist/main.js"]` so signals reach the process, `NODE_ENV=production`.
- **Reproducible:** lockfile installs only; no `curl | sh` without a pinned version and checksum.

## 2. Compose for local development and tests
- File named `compose.yaml` (no top-level `version:` key).
- Services for the app's dependencies (PostgreSQL, Redis…) with pinned image versions, named volumes for data, and `healthcheck` + `depends_on: condition: service_healthy` so the app starts after its database.
- Development credentials come from a git-ignored `.env` file, with a committed `.env.example`; never real or production credentials.
- Ports bound to `127.0.0.1` for local-only services.

## 3. Verify
- `docker build` succeeds from a clean cache; the runtime image starts, passes its health check and serves a request.
- Image size checked (`docker image ls`), and scanned when a scanner is available (`docker scout cves`, Trivy). Critical vulnerabilities in the base image mean updating the base, not ignoring them.

## 4. Review checklist
- [ ] Multi-stage; runtime stage has no build tools, sources or dev dependencies.
- [ ] Base image pinned (no `latest`); minimal variant.
- [ ] `.dockerignore` excludes `.env*`, `.git`, `node_modules`, build output.
- [ ] Runs as a non-root user.
- [ ] No secrets in `ENV`, `ARG`, copied files or layers; BuildKit secrets for build-time tokens.
- [ ] Health check; exec-form `CMD`; only needed ports exposed.
- [ ] Compose: pinned images, health checks, credentials from a git-ignored `.env`.
