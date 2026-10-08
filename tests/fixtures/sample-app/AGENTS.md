# Notes (sample app)

## Departments
frontend, backend

## Commands
- Dev server: `npm start` (http://localhost:3000)
- Tests: `npm test`

## Frontend
- Plain HTML, CSS and JavaScript modules in `public/`, no framework, no build step.
- Design tokens: CSS custom properties in `public/styles.css`.

## Backend
- Node's built-in `http` server in `server.mjs`, JSON API under `/api`, data kept in memory.

## Exceptions to the global rules
- No framework here: the Angular, SCSS and Storybook rules don't apply. Use plain CSS with the existing custom properties.
