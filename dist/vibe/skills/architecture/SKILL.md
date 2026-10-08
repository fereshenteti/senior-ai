---
name: architecture
description: Software architecture method - study an existing stack, choose technologies and tools (database, framework, hosting, libraries) with explicit trade-offs, record decisions as ADRs, keep the architecture overview current, and review the technical approach of a task. Use when a project starts, when a technology must be chosen or changed, or before work that touches data models, APIs, module boundaries, infrastructure or security.
user-invocable: true
---

# Architecture

## 1. Study before proposing
- Read `.senior-ai/architecture.md` and `.senior-ai/decisions/` (`project-memory` skill) and the project's `AGENTS.md`.
- Inspect the real stack: package manifests and lockfiles (`package.json`, `pom.xml`, `requirements*.txt`, …), framework configs, `Dockerfile` / compose files, CI workflows, infrastructure files, environment examples (`.env.example`, never real `.env` values), database schemas and migrations.
- Check current versions and recommended practices in up-to-date documentation (the Context7 MCP server when available, otherwise the official docs). Never rely on memory for versions, APIs or deprecations.
- Write down what exists before suggesting change: stack, structure, conventions, constraints, debt.

## 2. Choosing a technology
1. **Requirements first:** functional needs, data shape and volume, consistency, latency, scale, team skills, budget, hosting constraints, compliance (personal data, data location), time to market.
2. **Candidates:** 2-4 realistic options, including "keep what we have" when it applies. Prefer boring, well-supported, actively maintained technology that the team already knows; a new technology must earn its place.
3. **Compare** in a table: fit to requirements, maturity and community, operational cost, learning cost, lock-in, security track record, licence.
4. **Decide** and record an ADR (template in the `project-memory` skill). For a project already in production, include the migration path and its risk.
5. **Defaults** when nothing in the requirements argues otherwise: PostgreSQL for relational data, a managed service over self-hosting, the framework's official tooling over third-party wrappers. Say so when you apply a default.

## 3. Architecture overview
Keep `.senior-ai/architecture.md` current (template in `project-memory`): overview with a small Mermaid diagram, stack table with versions, structure, conventions, constraints and risks. Update it with every accepted ADR.

## 4. Reviewing a task's technical approach
Given a story or task, answer briefly:
- **Approach:** components to change or add, data model and API changes, where the code goes.
- **Contracts:** request/response shapes, events, migrations, and how compatibility is kept.
- **Cross-cutting:** security (authentication, authorization, input validation, secrets), performance, accessibility and i18n for UI, observability, testability.
- **Risks** and what to verify.
- **ADR needed?** Yes when the decision is hard to reverse, affects several modules or introduces a technology.

## 5. Output
- Decisions: an ADR file plus a 3-5 line summary for the orchestrator.
- Reviews: the approach as a short structured note the makers can follow.
- Mark anything you could not verify (missing access, unknown requirement) as an open question instead of guessing.
