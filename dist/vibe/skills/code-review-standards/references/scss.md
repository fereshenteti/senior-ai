# SCSS checklist

- [ ] No CSS framework or utility classes added (Tailwind, Bootstrap, ...) unless the project already uses one.
- [ ] No hard-coded colors, spacing, radii, shadows, font values, z-index or breakpoints when a token exists. Search the diff for `#`, `rgb(`, `hsl(` and bare `px` values and check each one.
- [ ] Tokens consumed through the project's token entry point; no duplicate token definitions.
- [ ] `@use`/`@forward`, never `@import`.
- [ ] No `::ng-deep`; no `!important` without a justifying comment.
- [ ] Nesting depth ≤ 3; selectors are low specificity (classes, not IDs or long chains).
- [ ] All interactive states styled: `:hover`, `:focus-visible`, `:active`, disabled.
- [ ] No `outline: none` without a visible replacement focus style.
- [ ] Animations respect `prefers-reduced-motion`.
- [ ] Layout uses flex/grid and `gap`; logical properties where direction matters.
- [ ] Host element has an explicit `display` when it needs box layout.
