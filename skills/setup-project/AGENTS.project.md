# <Project name>

<!--
Project facts and exceptions only. The general rules come from senior-ai (installed globally).
Anything written here overrides the global rules for this project.
Claude Code reads this file through CLAUDE.md (@AGENTS.md); Mistral Vibe reads it directly.
-->

## Stack
- Angular <version>, Storybook <version>, test runner: <Vitest | Jest | Karma>
- Package manager: <npm | pnpm | yarn>
- State management: <signals services | NgRx SignalStore | ...>

## Commands
- Dev server: `<npm start>`
- Storybook: `<npm run storybook>` (http://localhost:6006)
- Tests: `<npm test>`
- Lint: `<npm run lint>`
- Build: `<npm run build>`

## Design source
- Design spec: `DESIGN.md`
- Tokens: `<src/styles/_tokens.scss>`
- Reference images: `design/screens/<component>.png` (one image per component with all its states, scale <1x | 2x>)
- AllStates story id pattern: `components-<component>--all-states`

## Structure
- UI components: `<src/app/ui/<component>/>`
- Feature code: `<src/app/features/<feature>/>`
- Component prefix: `<app>`

## Exceptions to the global rules
<!-- Example: "Legacy area src/app/admin uses Bootstrap; keep it there, don't spread it." -->
- None.
