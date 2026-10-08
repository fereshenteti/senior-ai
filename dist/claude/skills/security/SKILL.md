---
name: security
description: Application security checklists (OWASP-based) for frontend, backend and infrastructure - injection, authentication and authorization, data exposure, secrets, dependencies, CI and cloud configuration. Use when writing or reviewing code that handles user input, authentication, permissions, personal data, secrets, dependencies, HTTP, storage, CI or deployment.
user-invocable: true
---

# Security

## Load the checklist for the area
- `references/frontend.md`: browser code (XSS, unsafe HTML, token storage, redirects, third-party scripts).
- `references/backend.md`: APIs and services (injection, authentication, authorization, validation, data exposure, rate limiting, logging).
- `references/infra.md`: secrets, dependencies and supply chain, containers, CI/CD, cloud and hosting configuration.

A change often touches several areas: a login feature needs all three.

## Method
1. **Find the trust boundaries** in the change: where data comes from the user, another system or the network, and where it ends up (HTML, SQL, shell, file system, logs, responses, third parties).
2. **Check each boundary** against the checklist: validate input where it enters, encode or parameterize where it is used, authorize every access to data or actions on the server.
3. **Look for secrets** in code, config, tests, fixtures and logs. A secret found in the repository is a Blocker even when the code is fine: it must be revoked, not only deleted.
4. **Check dependencies** that the change adds or upgrades: maintained, widely used, licence compatible, no known vulnerabilities (`npm audit`, or the ecosystem's equivalent).
5. **Report** with the `review-loop` verdict line. Severity: an exploitable vulnerability (injection, missing authorization, auth bypass, exposed secret, XSS with user data) is a **Blocker**; a weakness that needs other conditions (missing rate limit, verbose errors, weak headers) is **Major**; hardening is **Minor**.

## Rules
- Never write real secrets anywhere, including examples and tests: use obvious placeholders and environment variables.
- The client is never a security boundary: every check that matters is repeated on the server.
- Prefer the framework's built-in protections (template escaping, ORM parameters, CSRF tokens, auth guards) over custom code.
- When unsure whether something is exploitable, report it with the uncertainty stated rather than dropping it.
