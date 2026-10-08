# The team

senior-ai organizes agents into departments. **Makers** can edit files; **checkers** are read-only and review the makers' work.

## Departments and agents

| Department | Agent | Role | Edits files | Delegates to |
|---|---|---|---|---|
| Core | `orchestrator` | Product manager: stories, acceptance criteria, tasks, delegation, follow-up, report | `.senior-ai/` files | every agent |
| Core | `architect` | Technology choices, decision records, architecture overview, technical approach | `.senior-ai/` documents | — |
| Core | `qa-engineer` | End-to-end acceptance tests with Playwright, final checker of a story | test files | — |
| Frontend | `ui-builder` | UI components from a design source, with Storybook stories | yes | frontend checkers |
| Frontend | `frontend-dev` | Pages, routing, forms, state, data fetching, services, unit tests | yes | frontend checkers |
| Frontend | `i18n-specialist` | Translatable text, ICU plurals, locale formatting, right-to-left, translation files | yes | frontend checkers |
| Frontend | `code-auditor` | Code review (TypeScript, Angular, SCSS) | no | — |
| Frontend | `a11y-auditor` | WCAG 2.2 AA accessibility audit | no | — |
| Frontend | `visual-reviewer` | Rendered component vs. reference design image | no | — |
| Frontend | `perf-auditor` | Core Web Vitals, bundle size, rendering, measured with Lighthouse and DevTools | no | — |
| Frontend | `frontend-security` | XSS, unsafe HTML, token storage, redirects, third-party scripts, secrets in client code | no | — |
| Backend | `api-developer` | Endpoints, services, validation, auth wiring, integrations, unit and e2e tests | yes | backend checkers |
| Backend | `db-engineer` | Schema, safe migrations, indexes, query optimization, seed data | yes | `db-reviewer` |
| Backend | `backend-reviewer` | Backend code review: structure, API contracts, errors, transactions, tests | no | — |
| Backend | `db-reviewer` | Schema, indexes, N+1 queries, migrations that lock, break code or lose data | no | — |
| Backend | `backend-security` | Injection, authentication, object-level authorization (IDOR), data exposure, secrets | no | — |

DevOps (Docker, Vercel, CI) is the next department. Until it exists, the orchestrator handles its tasks itself with the matching skills, or asks you.

## How a goal flows

1. **Orchestrator** writes the story with acceptance criteria (`.senior-ai/stories/S-001-….md`).
2. **Architect** gives the technical approach when the story touches technologies, data models, APIs, module boundaries, infrastructure or security, and records real decisions as ADRs.
3. **Orchestrator** splits the story into tasks: one agent, one deliverable, its checkers, its dependencies.
4. **Makers** build, then run the **review loop** with their checkers.
5. **QA engineer** tests every acceptance criterion end to end.
6. **Orchestrator** reports to you and updates the project memory.

## The review loop

Makers build, checkers verify, the maker fixes, until it passes:

1. The maker self-checks (build, lint, tests), then sends the work to its checkers.
2. Each checker answers with a report that starts with `Verdict: PASS` or `Verdict: FAIL`. FAIL means at least one **Blocker** or **Major** finding.
3. The maker fixes every Blocker and Major finding and sends the fixes back to the checkers that failed.
4. After **3 rounds**, what is still open is escalated to the orchestrator or to you, with the reasons.

You never have to fix a checker's findings yourself.

## Model choice

When an agent delegates, it picks the cheapest model that can do the task well: a small model (Haiku) for searching and mechanical work, a mid-tier model (Sonnet) for implementation and reviews, a top model (Opus) for hard reasoning and architecture. Claude Code supports this per delegation. Vibe runs each subagent on the model configured for it.

## Skills

Skills are instructions an agent loads when the topic comes up.

| Skill | Purpose |
|---|---|
| `orchestrate` | Product-manager workflow; callable as `/senior-ai:orchestrate <goal>` |
| `project-memory` | The `.senior-ai/` folder and its templates |
| `architecture` | Study a stack, choose technologies, write ADRs |
| `e2e-testing` | Acceptance tests with Playwright |
| `review-loop` | The maker-checker loop and the verdict line |
| `security` | OWASP-based checklists for frontend, backend and infrastructure |
| `code-review-standards` | Review method, severity levels, TypeScript/Angular/SCSS checklists |
| `clean-code` | General coding standards |
| `setup-project` | Integrate senior-ai into a project |
| `angular` | Current Angular practices for the project's version |
| `scss-styling` | SCSS with design tokens, no CSS frameworks |
| `design-fidelity` | Follow the design source strictly |
| `storybook` | Stories, including the `AllStates` story |
| `visual-check` | Pixel comparison of a story with its reference image |
| `a11y` | WCAG 2.2 AA build rules and audit method |
| `i18n` | Translatable text, ICU messages, locale formatting, right-to-left |
| `web-performance` | Core Web Vitals, bundles, loading, images, rendering, measurement |
| `nestjs` | NestJS structure, validation, configuration, guards, errors, testing (version-aware) |
| `postgresql` | Schema design, indexes, queries, safe migrations on live data |

## Autonomy

Agents work freely inside the project: reading, editing, building, testing, running local servers. They **ask you first** before committing, pushing, opening or merging pull requests, deploying, deleting data, adding dependencies, and anything that leaves your machine or costs money. In Claude Code the [safety hooks](hooks.md) enforce this.
