---
name: review-loop
description: Maker-checker loop - after implementing a task, run one review pass with the fewest read-only checkers that cover the risk, fix their Blocker and Major findings, verify the fixes yourself and report back instead of re-reviewing. Also defines the verdict line every checker report starts with. Use after every implementation task, and in every checker report.
user-invocable: false
---

# Review loop

Makers build, one review pass checks the work, and the maker fixes what it finds. The loop is deliberately short: every extra round and every extra checker costs the user's plan budget.

## For makers
1. **Self-check first:** build, type-check and lint what you changed, and run only the new or changed tests once (not the full suite). Don't send broken work to review.
2. **Per task: one review pass, with the fewest checkers that cover the risk:**
   - Default: the department's code checker only (`code-auditor` or `backend-reviewer`).
   - Add the security checker (`frontend-security`, `backend-security`, `infra-reviewer`) only when the task touches authentication, authorization, tokens, user input handling, HTML rendering, personal data, secrets, dependencies or CI.
   - Add `db-reviewer` only for schema, migration or data-backfill changes, and `visual-reviewer` only for a UI component with a design reference.
   - `a11y-auditor`, `perf-auditor`, the i18n pass and the full test suite do **not** run per task: they belong to the feature gate below. While working, still apply the `a11y` and `i18n` skills to the code you write.
   - Small changes (a few lines, no security impact) need no review agent: self-check and say so.
3. **Fix** every **Blocker** and **Major** finding, and a Minor one when it is cheap and safe. A finding you disagree with gets a one-line reason.
4. **Verify the fixes yourself** (tests, re-reading the changed lines). Do not send the work back for a second review round.
5. **Report back instead of looping** when a Blocker can't be fixed, a fix changes the design, or you are unsure the fix is right: hand the remaining findings to whoever called you (the orchestrator or the user), who decides whether a second review is worth it.
6. **Report** in a few lines: checkers used, verdicts, what was fixed, what is left open and why.

## Feature gate
The broad checks run **once**, not per task, at these moments only:
- a big feature or story is finished (the orchestrator runs it before QA acceptance; without an orchestrator, the maker of the last task does);
- the user asks for them;
- the user asks to commit or push and these checks have not run on the changes yet.

The gate runs, as far as the change needs them: the **full test suite**, `a11y-auditor` (when markup changed), the `i18n-specialist` pass (when the project is multilingual and text changed), `perf-auditor` (new routes, large lists, heavy dependencies) and `visual-reviewer` for components not yet checked. One pass, fixes verified by the maker, no second round.

When you run as a subagent and your tool doesn't let subagents start other agents, don't review your own work: finish your self-checks and end your report with `Ready for review by:` and the checkers. The caller runs them once and sends you the findings as a new task.

When delegation is not available at all, apply the checkers' skills yourself and say that the review was self-performed.

## For checkers: the verdict line
Every checker report starts with exactly one of these lines:
```
Verdict: PASS
Verdict: FAIL
```
- **FAIL** when there is at least one Blocker or Major finding; **PASS** otherwise (Minor and Nit findings can still be listed).
- Then the findings, most severe first, each with: severity (Blocker, Major, Minor, Nit), location (`file:line`, story or state), what is wrong, the concrete failure, and the fix.
- On a re-check (only when the caller explicitly asks for one), say for each previous finding whether it is fixed, and report only new findings in addition.
- Keep the report short: findings only, no summary of what is fine beyond one line.
- Severity follows `code-review-standards`, with exactly these words: **Blocker**, **Major**, **Minor**, **Nit** (not Critical, High, Medium or Low): the maker and the hooks rely on them. Do not inflate severity to force a fix, and do not lower it to pass.
