---
name: review-loop
description: Maker-checker loop - after implementing a task, delegate it to the read-only checkers, fix their Blocker and Major findings, and re-check until every checker passes or three rounds are used, then escalate. Also defines the verdict line every checker report starts with. Use after every implementation task, and in every checker report.
user-invocable: false
---

# Review loop

Makers build, checkers verify, and the maker fixes what the checkers find. The user does not fix findings; the loop does.

## For makers
1. **Self-check first:** build, type-check, lint and run the tests of what you changed. Don't send broken work to review.
2. **Delegate to the task's checkers**, in parallel when they are independent. Give each: the scope (files, diff, component, story), the acceptance criteria that apply, and the reference (design image, ADR) if any. Use a mid-tier model unless the task is unusually hard.
3. **Read the verdicts.** Fix every **Blocker** and **Major** finding. Fix a Minor finding when it is cheap and safe; list the others in your report. Ignore nothing silently: a finding you disagree with gets a one-line reason.
4. **Re-check only what failed:** send the fixes back to the checkers that returned FAIL, with the list of findings you addressed.
5. **Stop** when every checker returns PASS, or after **3 rounds**. After 3 rounds, escalate to whoever called you (the orchestrator, or the user) with the remaining findings and why they are still open.
6. **Report:** rounds used, each checker's final verdict, findings fixed, findings left open with reasons. When an orchestrator called you, it records this in the story's review log.

When you run as a subagent and your tool doesn't let subagents start other agents (Mistral Vibe allows one level), don't review your own work: finish your self-checks and end your report with `Ready for review by:` and the checkers. The agent that called you runs them and sends you the findings as a new task; fix them and report again.

When delegation is not available at all, run the checkers' skills yourself, one after another, and say that the review was self-performed.

## For checkers: the verdict line
Every checker report starts with exactly one of these lines:
```
Verdict: PASS
Verdict: FAIL
```
- **FAIL** when there is at least one Blocker or Major finding; **PASS** otherwise (Minor and Nit findings can still be listed).
- Then the findings, most severe first, each with: severity (Blocker, Major, Minor, Nit), location (`file:line`, story or state), what is wrong, the concrete failure, and the fix.
- On a re-check, say for each previous finding whether it is fixed, and report only new findings in addition.
- Severity follows `code-review-standards`, with exactly these words: **Blocker**, **Major**, **Minor**, **Nit** (not Critical, High, Medium or Low): the maker and the hooks rely on them. Do not inflate severity to force a fix, and do not lower it to pass.
