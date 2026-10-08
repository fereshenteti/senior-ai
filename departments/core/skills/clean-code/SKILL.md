---
name: clean-code
description: Pragmatic coding standards for any language - clear naming, small focused units, no over-engineering, no noise comments. Use when writing or refactoring code.
user-invocable: true
---

# Clean code

## Principles
- **Single responsibility:** a function, class or component does one thing.
- **KISS / YAGNI:** the simplest solution that meets today's requirement. No speculative options, flags or abstractions.
- **DRY with judgment:** extract on the third repetition, not the first. Two similar blocks are cheaper than a wrong abstraction.
- **Leave it cleaner:** fix small issues in code you touch, but do not refactor unrelated code.

## Naming
- Names reveal intent: `activeUserCount`, not `n` or `data`.
- Functions are verb + noun: `loadInvoices()`, `formatPrice()`.
- Booleans read as questions: `isOpen`, `hasError`, `canSubmit`.
- Constants: follow the project convention; otherwise `SCREAMING_SNAKE_CASE` for true constants.
- If a name needs a comment to be understood, rename it.

## Structure
- Guard clauses and early returns instead of deep nesting (max ~2 levels).
- Small functions with one level of abstraction each; prefer 0-3 parameters (use an options object beyond that).
- No hidden side effects: do not mutate inputs; make state changes explicit.
- Keep related code together. Do not create `utils` files for a single function; put it where it is used.
- Named constants instead of magic numbers and strings.

## Comments
- Comment **why**, never **what**. Delete comments that restate the code.
- Public APIs get a short doc comment when their contract is not obvious from types.
- No commented-out code; version control remembers it.

## Errors
- Handle errors where you can act on them; otherwise let them propagate.
- Never swallow errors silently. Never use empty `catch` blocks.
- User-facing error messages are clear and actionable; logs carry the technical detail.

## Before you edit a file
1. Who imports or uses it? Will their usage break?
2. What tests and stories cover it? Update them in the same change.
3. Is it shared? Check every consumer.

## Before you say "done"
- The requested goal is met, nothing more and nothing less.
- Build, lint and type-check pass; affected tests pass.
- No leftover debug code, unused imports or TODOs you introduced.
