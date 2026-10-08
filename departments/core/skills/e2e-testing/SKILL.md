---
name: e2e-testing
description: End-to-end acceptance testing with Playwright - turn a story's acceptance criteria into browser tests that use the app like a user, run them, and report pass or fail per criterion with evidence. Use when a story is ready for acceptance, when end-to-end tests are requested, or to reproduce a user-facing bug.
user-invocable: true
---

# End-to-end testing

## 1. Detect the setup
- Look for `playwright.config.*` and existing e2e tests (`e2e/`, `tests/e2e/`, `*.e2e.*`, `*.spec.ts` next to it). Follow their folder, naming, fixtures and base URL.
- No Playwright yet: propose adding it (`npm init playwright@latest`, or `@playwright/test` as a dev dependency) and **ask the user before installing**. If they decline, verify the criteria manually with the Playwright MCP server when it is available, and say that the result is not automated.
- Find how the app starts (`npm start`, Docker Compose) and whether tests need seed data or a test account. Never use production data or real user credentials.

## 2. From criteria to tests
- One `test()` per acceptance criterion, named after it: `test('S-012 #2: shows an error when the email is invalid', …)`.
- Act like a user: navigate, click, type. Locate elements by role, label or visible text (`getByRole`, `getByLabel`, `getByText`); use test ids only when nothing user-visible is stable.
- Assert the observable outcome from the criterion (text, URL, visible state, a request's effect), with Playwright's auto-waiting assertions (`await expect(…).toBeVisible()`), never fixed sleeps.
- Each test sets up and cleans up its own data, so tests run in any order and in parallel.
- Cover the error path when the criterion implies one (invalid input, no permission, server error).

## 3. Run
- Run only the new or affected tests first, then the whole e2e suite if it is fast enough.
- On failure, collect the evidence: error message, screenshot or trace path. Re-run once to separate a real failure from flakiness; a test that passes only sometimes is reported as flaky, not as passing.

## 4. Report (as the acceptance checker)
```
Acceptance S-<NNN>: PASS | FAIL
| Criterion | Result | Test | Evidence |
|---|---|---|---|
| 1 | pass | e2e/contact-form.spec.ts:12 | |
| 2 | fail | e2e/contact-form.spec.ts:28 | expected error "Invalid email", got none; trace: test-results/…/trace.zip |
Flaky: <tests, if any>
Not automated: <criteria verified manually, and why>
```
A failed criterion names the likely owner (frontend, backend) so the orchestrator can route the fix.
