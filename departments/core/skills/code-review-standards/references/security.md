# Security checklist (frontend focus)

- [ ] No `innerHTML`, `bypassSecurityTrust*` or `DomSanitizer` bypass on data that is not fully trusted.
- [ ] No secrets, API keys or tokens in source code, environment files committed to git, or Storybook stories.
- [ ] User input validated on the client for UX **and** assumed to be re-validated on the server; no security decisions made only in the client.
- [ ] Auth tokens not stored in `localStorage` when the project uses httpOnly cookies; follow the project's auth pattern.
- [ ] URLs built from user input are encoded; no open redirects (`window.location = userValue`).
- [ ] Route guards are a UX layer; protected data is still protected by the API.
- [ ] HTTP errors don't leak stack traces or internal details into the UI.
- [ ] New dependencies: maintained, widely used, license compatible, no known vulnerabilities (`npm audit`). Flag every new dependency in the review.
- [ ] `target="_blank"` links include `rel="noopener noreferrer"`.
- [ ] Third-party scripts/iframes have a justified origin and use `sandbox` where possible.
