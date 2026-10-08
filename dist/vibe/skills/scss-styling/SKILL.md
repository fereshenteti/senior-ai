---
name: scss-styling
description: Component styling with plain SCSS and design tokens - no Tailwind, Bootstrap or other CSS frameworks. Use whenever writing or changing styles.
user-invocable: true
---

# SCSS styling

## Hard rules
- **SCSS only.** Do not add Tailwind, Bootstrap, Bulma, UnoCSS or any utility/CSS framework. If the project already uses one, follow the project and flag it rather than mixing approaches.
- **No hard-coded design values when tokens exist:** colors, spacing, radii, shadows, font families/sizes/weights/line-heights, z-index, breakpoints and durations come from tokens (see the `design-fidelity` skill). Values that are not tokens (e.g. a `1px` hairline) are fine.
- **Component-scoped styles** live in the component's `.scss` file. Global styles are limited to resets, tokens, typography base and truly global utilities that already exist.
- **No `::ng-deep`, no `!important`** in new code (except to override third-party styles you cannot reach otherwise, with a comment explaining why).

## Tokens in SCSS
- Prefer **CSS custom properties** at runtime (`var(--color-primary-600)`) so themes and dark mode work; SCSS variables/maps are fine as the source that generates them.
- Use the project's existing token entry point (`@use 'tokens' as t;` or similar). Do not create a second token file.
- Use `@use` / `@forward`, never `@import` (deprecated in Dart Sass).

## Structure
- Naming: follow the project. Default to BEM-like classes (`.card`, `.card__header`, `.card--elevated`) when there is no convention.
- Max nesting depth 3; nest only for pseudo-classes, modifiers and media queries.
- Order inside a rule: layout (display, position, grid/flex), box model (size, margin, padding), typography, visual (color, background, border, shadow), motion, then nested states.
- Shared mixins (breakpoints, focus ring, truncation, visually-hidden) live in one partial; reuse them before writing new ones.

## Layout and responsiveness
- Flexbox and Grid; no floats for layout.
- Use `gap` instead of margins between siblings.
- Mobile-first media queries using the project's breakpoint tokens/mixins.
- Logical properties (`margin-inline`, `padding-block`, `inset-inline-start`) for RTL readiness.
- Size with `rem` for type and spacing; `px` only for hairlines and fixed assets.

## States and motion
- Every interactive element styles `:hover`, `:focus-visible`, `:active`, `[disabled]` / `[aria-disabled="true"]`.
- Focus is always visible: never `outline: none` without a replacement focus style.
- Wrap non-essential animation in `@media (prefers-reduced-motion: no-preference)`.

## Theming
- If the design has dark mode or multiple themes, switch token values (e.g. `[data-theme='dark']` or `prefers-color-scheme`), never component selectors.
