---
name: design-fidelity
description: Strictly follow a project's design source (DESIGN.md, design tokens, design-system package, reference screenshots) for pixel-perfect UI. Use before implementing or changing any UI, and when extracting design tokens.
user-invocable: true
---

# Design fidelity

## 1. Find the design source (in this order)
1. The project `AGENTS.md` / `CLAUDE.md`: it may name the design source and the screenshots folder explicitly.
2. A `DESIGN.md` (repo root or `docs/`).
3. Token files: `tokens.json`, `*.tokens.json`, `_tokens.scss`, `_variables.scss`, `tokens.css`, a `design-tokens/` or `theme/` folder.
4. A design-system package in `package.json` (internal `@company/ui`, `@angular/material` theme, etc.).
5. Reference screenshots (default folder: `design/screens/`).

If **none** exist, say so and continue with sensible, consistent values; do not pretend there is a system.
If **several** exist and disagree, the order of precedence is: project `AGENTS.md` > tokens file > DESIGN.md > screenshots. Report each conflict.

## 2. Tokens are the only source of values
- Before writing a style value, look it up in the tokens. Use the token, never its literal value.
- If the design needs a value that has **no token**:
  - Do not invent a token and do not hard-code the value silently.
  - Use the closest token only if the difference is invisible (≤1px, imperceptible color difference). Otherwise hard-code it with a `// TODO(design): no token for <value>` comment and list it in your final report.
- If tokens only exist as prose in DESIGN.md, extract them first (see below), then implement.

## 3. Extracting tokens from DESIGN.md (one-time task)
1. Read DESIGN.md completely.
2. Produce one token file in the format the project uses (default: an SCSS partial generating CSS custom properties, e.g. `src/styles/_tokens.scss`).
3. Categories: color (primitives + semantic aliases like `--color-text-primary`), typography (family, size, weight, line-height, letter-spacing per text style), spacing scale, radius, border width, shadow/elevation, z-index, breakpoints, motion (duration, easing).
4. Semantic tokens reference primitives (`--color-text-primary: var(--color-neutral-900)`); components use semantic tokens.
5. Ask the user to review the token file before building components on it.

## 4. Reading a reference screenshot
- Treat the screenshot as the spec for **layout, proportions and states**; treat tokens as the spec for **exact values**. When the screenshot seems to contradict a token, the token wins unless the project says otherwise; report it.
- Identify every state shown (default, hover, focus, active, disabled, error, loading, selected, sizes, variants) and implement all of them.
- Measure: spacing between elements, alignment, icon size, text truncation, min/max widths.
- Note the screenshot scale (1x or 2x) before measuring pixel values.

## 5. Definition of done for a UI component
- [ ] All values come from tokens (or are reported as missing tokens).
- [ ] All states in the reference are implemented and shown in Storybook.
- [ ] The visual check passes (load the `visual-check` skill).
- [ ] Accessibility check passes (load the `a11y` skill).
- [ ] Report: what was built, deviations from the design and why, missing tokens.
