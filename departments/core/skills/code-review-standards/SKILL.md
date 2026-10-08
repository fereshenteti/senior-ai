---
name: code-review-standards
description: How to review code - scope, method, severity levels and report format, with language and framework checklists (Angular, TypeScript, SCSS) and the security skill. Use when reviewing a diff, branch, PR or files.
user-invocable: true
---

# Code review standards

## 1. Scope
- Default scope: the current uncommitted changes (`git diff` + `git diff --staged`). If clean, the current branch against its base (`git diff <base>...HEAD`). Otherwise the files or PR the user names.
- Review the **changed code and its direct impact** (callers, tests, stories). Do not review the whole codebase.
- Read the project `AGENTS.md` / `CLAUDE.md` first: project conventions override generic preferences.

## 2. Method
1. Understand the intent (commit messages, ticket, user request) before judging the code.
2. Read every changed file fully, then the relevant parts of the files it touches.
3. Load only the checklists that apply:
   - `references/typescript.md` for any `.ts` file
   - `references/angular.md` for Angular code
   - `references/scss.md` for styles
   - the `security` skill (its frontend, backend or infra checklist) when the change touches input handling, auth, permissions, HTML rendering, HTTP, storage, secrets, dependencies or CI
   - For UI changes, accessibility is covered by the `a11y` skill.
4. Verify each finding before reporting it: point at the exact line and explain the concrete failure (input → wrong result). Drop findings you cannot justify.
5. If available, run the project's lint, type-check and tests on the changed area and include failures.

## 3. Severity
| Level | Meaning | Examples |
|---|---|---|
| **Blocker** | Wrong behavior, data loss, security hole, broken build | unhandled null crash, XSS, missing await |
| **Major** | Will cause bugs or real maintenance cost soon | memory leak, race condition, design-token violation, missing a11y on interactive element |
| **Minor** | Quality issue with low risk | unclear naming, duplicated logic, missing test for an edge case |
| **Nit** | Taste; optional | formatting the linter doesn't catch |

Do not inflate severity. Prefer few verified findings over many speculative ones.

## 4. Report format
```
Verdict: PASS | FAIL
## Review: <scope>

### Blocker
- `path/file.ts:42`: <what is wrong>. <concrete failure scenario>. Fix: <specific suggestion>.

### Major / Minor / Nit
- ...

### Good
- <1-3 things done well, only if genuinely notable>
```
The first line is the `review-loop` verdict: FAIL when there is any Blocker or Major finding. Read-only by default: report, do not edit files unless asked to apply fixes.
