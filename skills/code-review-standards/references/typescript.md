# TypeScript checklist

- [ ] No `any` (use `unknown` + narrowing); no unchecked `as` casts that hide real type errors.
- [ ] No non-null assertions (`!`) without a guarantee visible in the code.
- [ ] Null and undefined handled at boundaries (API responses, route params, storage).
- [ ] Union types and exhaustive `switch` (with a `never` check) for variants and states.
- [ ] Promises awaited or explicitly handled; no floating promises; errors caught where they can be acted on.
- [ ] No mutation of function arguments or shared state without intent.
- [ ] `readonly` for values not reassigned; `const` over `let`.
- [ ] Public functions and types are named for intent; no abbreviations.
- [ ] No dead code, unused exports or leftover `console.log`.
- [ ] Equality with `===`; no implicit coercion bugs (`if (count)` when `0` is valid).
- [ ] Dates, numbers and currency formatted with locale-aware APIs, not string concatenation.
