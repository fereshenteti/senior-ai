# <Project name>

<!--
Project facts and exceptions only. The general rules come from senior-ai (installed globally).
Anything written here overrides the global rules for this project.
Claude Code reads this file through CLAUDE.md (@AGENTS.md); Mistral Vibe reads it directly.
Delete the sections this project doesn't have.
-->

## Departments
<frontend, backend, devops>: the senior-ai departments this project uses.

## Commands
- Install: `<npm ci>`
- Dev server: `<npm start>`
- Tests: `<npm test>`
- End-to-end tests: `<npx playwright test>`
- Lint: `<npm run lint>`
- Build: `<npm run build>`
- Storybook: `<npm run storybook>` (http://localhost:6006)

## Frontend
- Framework: <Angular 20>, test runner: <Vitest | Jest | Karma>, Storybook <version | none>
- Package manager: <npm | pnpm | yarn>
- State management: <signals services | NgRx SignalStore | …>
- Design spec: `<DESIGN.md>` · tokens: `<src/styles/_tokens.scss>`
- Reference images: `design/screens/<component>.png` (one image per component with all its states, scale <1x | 2x>)
- UI components: `<src/app/ui/<component>/>` · features: `<src/app/features/<feature>/>` · prefix: `<app>`

## Backend
- Framework: <NestJS 11>, language: <TypeScript>, ORM: <Prisma | TypeORM | …>
- Database: <PostgreSQL 17> · migrations: `<command>`
- API style: <REST | GraphQL>, docs: `<path or URL>`
- Modules: `<src/modules/<module>/>`

## DevOps
- Hosting: <Vercel | Docker on … >, environments: <preview, staging, production>
- CI: <GitHub Actions>, workflows in `.github/workflows/`
- Secrets: <where they live, never their values>

## Exceptions to the global rules
<!-- Example: "Legacy area src/app/admin uses Bootstrap; keep it there, don't spread it." -->
- None.
