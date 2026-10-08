# NestJS review checklist

## Structure
- [ ] Controllers only map HTTP to services; no business logic or queries in controllers.
- [ ] New code lives in the right feature module; no circular imports between modules (`forwardRef` is a smell).
- [ ] Configuration through `ConfigService`; no direct `process.env` reads in features.

## Input, output, errors
- [ ] Every body, query and param is validated (DTO + global `ValidationPipe` with `whitelist`, or Zod); IDs parsed with the right pipe.
- [ ] Responses are explicit DTOs; no entity returned whole; no internal fields leak.
- [ ] List endpoints are paginated with a maximum page size.
- [ ] Errors use HTTP exceptions or the project's exception filter; no stack traces or SQL in responses; no swallowed errors.

## Security
- [ ] New routes are protected by the global auth guard, or explicitly marked public with a reason.
- [ ] Object-level authorization: the service checks that the current user may access this record.
- [ ] No secrets in code or tests; configuration validated at startup.

## Data
- [ ] Multi-step writes in a transaction; no external calls inside it.
- [ ] No N+1 queries; relations loaded deliberately; selects limited to needed columns on hot paths.
- [ ] Schema changes come with a migration (see the `postgresql` skill).

## Tests
- [ ] Unit tests for new service logic; e2e tests for new endpoints including 400, 401/403 and 404 paths.
- [ ] Tests don't depend on order or shared mutable state.

## Version
- [ ] Code matches the project's NestJS version (NestJS 12: ESM imports with `.js`; Express 5 named wildcards).
