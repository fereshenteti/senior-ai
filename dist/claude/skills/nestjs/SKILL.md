---
name: nestjs
description: NestJS backend development with current practices for the project's NestJS version - modules, controllers and services, DTO validation, configuration, authentication and authorization guards, errors, data access, OpenAPI and testing. Use for any NestJS endpoint, service, module, guard, pipe, interceptor or test.
user-invocable: true
---

# NestJS

## 1. Detect the context first
1. `package.json`: the `@nestjs/core` major version, the HTTP platform (`@nestjs/platform-express` or `-fastify`), the ORM (Prisma, TypeORM, MikroORM, Drizzle), the validation library (class-validator or Zod), the test runner (Jest or Vitest).
2. Look at two or three existing modules to learn the local structure, naming and error handling. The project's conventions win over this skill, except for deprecated or unsafe patterns.
3. Check the documentation for the detected version (Context7 when available, otherwise docs.nestjs.com). Notable differences:
   - **NestJS 12:** ESM-only packages and Node.js 20 or later; relative imports end in `.js` (`import { UsersService } from './users.service.js'`); `reflect-metadata` is a peer dependency.
   - **NestJS 11 and later** (Express 5, path-to-regexp): wildcard routes need a named parameter (`{*path}`, not `*`).

## 2. Structure
- One **feature module** per domain area (`users/`, `orders/`): controller, service, DTOs, entities or repository, and its tests together. Shared code in `common/` only when two or more modules use it.
- **Controllers** are thin: map HTTP to a service call; no business logic, no data access.
- **Services** hold the business rules and transactions. **Repositories** (or the ORM client behind a small data layer) hold queries.
- Dependencies through constructor injection; configuration through `ConfigService`, never `process.env` scattered in the code.

## 3. Input and output
- A global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`, or a Zod pipe if the project uses Zod. Every body, query and param has a DTO with validation; params are parsed (`ParseIntPipe`, `ParseUUIDPipe`).
- Responses are explicit **response DTOs** or serialized classes; never return ORM entities whole (password hashes, internal fields, relations).
- Pagination on every list endpoint, with a maximum page size.
- **Errors:** throw Nest's HTTP exceptions (`NotFoundException`, `ConflictException`, …) from services or map domain errors in one exception filter; clients get a consistent error shape without stack traces or SQL.
- OpenAPI with `@nestjs/swagger` when the project documents its API; keep decorators next to the DTOs.

## 4. Security
- Authentication in a **guard** (Passport strategies or a JWT guard), registered globally with an explicit `@Public()` decorator for open routes: deny by default.
- Authorization: role or policy guards for actions, plus **object-level checks** in the service (the current user owns or may access the record).
- Configuration validated at startup (`ConfigModule.forRoot({ validate })`): the app refuses to start with missing or malformed secrets.
- Rate limiting (`@nestjs/throttler`) on authentication and public endpoints; `helmet` and a strict CORS origin list.
- Load the `security` skill (backend checklist) for anything touching input, auth, permissions or personal data.

## 5. Data access
- Use the project's ORM and its migrations; no `synchronize: true` outside throwaway local databases.
- Transactions around multi-step writes; no network calls inside a transaction.
- Avoid N+1 queries: load relations explicitly (`include` / joins) or batch.
- Load the `postgresql` skill for schema, index and migration work.

## 6. Testing
- **Unit tests** for services with the dependencies mocked (`Test.createTestingModule` + `overrideProvider`).
- **End-to-end tests** for endpoints with `supertest` against `app.getHttpServer()`, covering validation errors, auth (401 and 403) and the happy path; against a real test database (Docker or Testcontainers) when the project has one.
- One behavior per test; test names describe the behavior.

## 7. Review
Reviewers use `references/review.md`.
