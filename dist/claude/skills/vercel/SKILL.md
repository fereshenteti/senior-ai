---
name: vercel
description: Deploying and operating projects on Vercel - project linking, preview and production deployments, environment variables, build logs, promote and rollback, CI with prebuilt deployments, domains. Uses the official Vercel plugin's tools when installed, otherwise the vercel CLI. Use for any Vercel deployment, configuration, environment variable or production issue.
user-invocable: true
---

# Vercel

## 1. Use the best tool available
- **Official Vercel plugin or MCP server installed** (an optional senior-ai extra): use its tools and skills first; they carry Vercel's current guidance.
- **Otherwise the `vercel` CLI** (`npm i -g vercel`, then `vercel login`). In agent or CI runs, pass `--non-interactive`; read only stdout for URLs and JSON.
- Check commands and options with `vercel <command> --help` or the official docs rather than memory.

## 2. Know which project you are acting on
- Before any consequential read or change, run `vercel project inspect --non-interactive` from the intended folder and confirm the owner and project. Stop on a link prompt or a mismatch instead of linking automatically.
- One app: `vercel link`. Monorepo with several projects: `vercel link --repo`.

## 3. Deploy
- **Preview:** `vercel deploy` (or a git push to a non-production branch when the Git integration is on).
- **Production:** `vercel deploy --prod`, or `vercel promote <preview-url>` to promote a tested preview without rebuilding. **Always ask the user before any production deployment, promote or rollback.**
- **CI:** `vercel pull --yes --environment=<env>` → `vercel build [--prod]` → `vercel deploy --prebuilt [--prod]`. A `vercel build` output is ignored without `--prebuilt`.
- **Wait and check:** `vercel inspect <url> --wait` until the deployment is Ready or Error; `vercel inspect <url> --logs` for build logs; `vercel logs <url>` for runtime logs (see the `ci-watch` skill).
- **Rollback:** `vercel rollback <previous-url>` (ask first).
- Protected previews: use `vercel curl <url>` to reach them; never disable deployment protection.

## 4. Environment variables
- Per environment (development, preview, production): `vercel env ls`, `vercel env add <name> <environment>`, `vercel env pull` for local development (into a git-ignored file).
- Never print secret values in logs, reports or chat; never write them to committed files. Tokens for CI go in the CI secret store as `VERCEL_TOKEN` (with `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`), never as a `--token` flag in a committed file.

## 5. Configuration
- Project settings in `vercel.json` (or `vercel.ts` where the project uses it): framework, build and output settings, functions, headers, redirects and rewrites, cron jobs.
- Security headers (HSTS, `X-Content-Type-Options`, CSP for HTML) and redirects here or in the framework, consistently in one place.

## 6. Production issues
Inspect the deployment, then logs, then the source: `vercel inspect <url>`, `vercel inspect <url> --logs`, `vercel logs <url>`. Report what failed, where, and the evidence; propose a rollback when production is broken and a fix isn't immediate.
