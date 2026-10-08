# Security checklist: backend

## Input and injection
- [ ] Every input (body, query, params, headers, files, messages) is validated at the boundary with a schema or DTO validation: type, length, format, allowed values. Unknown fields are rejected or stripped.
- [ ] SQL through the ORM or parameterized queries only; no string-built SQL with user data (including `ORDER BY` and column names, which go through an allow-list).
- [ ] No user data in shell commands, file paths (path traversal), template engines, regexes built at runtime (ReDoS) or deserialization of untrusted formats.
- [ ] Uploaded files: size limit, type checked by content, stored outside the web root with generated names.
- [ ] Outgoing requests to URLs derived from user input are restricted (SSRF): allow-list of hosts, no internal addresses.

## Authentication and sessions
- [ ] Passwords hashed with a slow, salted algorithm (argon2id or bcrypt); never encrypted or logged.
- [ ] Tokens: signed and verified (algorithm pinned, expiry checked), short-lived access tokens, refresh tokens revocable. Session cookies are `HttpOnly`, `Secure`, `SameSite`.
- [ ] Login, password reset and sign-up are rate-limited and don't reveal whether an account exists.
- [ ] Reset and verification tokens are single-use, random and expiring.

## Authorization
- [ ] Every endpoint has an explicit access rule (guard, policy, decorator); deny by default.
- [ ] Object-level checks: a user can only read or change the records they own or are allowed to (no IDOR through IDs in the URL or body).
- [ ] Role and tenant checks happen on the server, from the authenticated identity, never from a client-sent field.

## Data exposure
- [ ] Responses return explicit DTOs; no entity serialized whole (password hashes, internal flags, other users' data).
- [ ] Errors return generic messages to clients; stack traces and SQL errors only in server logs.
- [ ] Personal data is minimized, protected in transit (TLS) and at rest where required, and deletable.
- [ ] Logs contain no passwords, tokens, full card numbers or unnecessary personal data.

## HTTP and API
- [ ] CORS allows only the known front-end origins; credentials only when needed.
- [ ] Security headers set (HSTS, `X-Content-Type-Options`, a CSP for served HTML).
- [ ] CSRF protection when authentication relies on cookies.
- [ ] Rate limiting and request size limits on public endpoints; pagination limits on list endpoints.
