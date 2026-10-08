---
name: a11y
description: Accessibility standards and audit method (WCAG 2.2 AA) for web UI - semantics, keyboard, focus, ARIA, contrast, motion, forms. Use when building or reviewing any UI component or page.
user-invocable: true
---

# Accessibility (WCAG 2.2 AA)

## Build rules
### Semantics first
- Use the native element: `<button>` for actions, `<a href>` for navigation, `<input>`/`<select>` for data. No clickable `<div>`s.
- One `<h1>` per page; headings in order, never chosen for size.
- Landmarks: `<header>`, `<nav>`, `<main>`, `<footer>`; label repeated landmarks (`aria-label`).
- Lists as `<ul>`/`<ol>`; tabular data as `<table>` with `<th scope>`.

### ARIA
- No ARIA is better than wrong ARIA. Add it only when native semantics can't express the widget.
- Custom widgets follow the WAI-ARIA Authoring Practices pattern (tabs, menu, combobox, dialog, listbox) including the keyboard behavior.
- Icon-only buttons have an accessible name (`aria-label` or visually hidden text); decorative icons get `aria-hidden="true"`.
- State is exposed: `aria-expanded`, `aria-selected`, `aria-pressed`, `aria-current`, `aria-invalid`, `aria-busy`.
- Dynamic messages (toasts, async validation, results count) use a live region (`role="status"` or `aria-live="polite"`).

### Keyboard and focus
- Everything interactive is reachable and operable by keyboard, in a logical order. No positive `tabindex`.
- Visible focus indicator on every focusable element (`:focus-visible`) with ≥3:1 contrast against adjacent colors.
- Dialogs trap focus, close on Escape and return focus to the trigger (Angular CDK `cdkTrapFocus` / `Dialog` if available).
- Focused elements are not hidden behind sticky headers or overlays (WCAG 2.2, 2.4.11).

### Visual
- Text contrast ≥ 4.5:1 (≥ 3:1 for large text ≥ 24px or 18.66px bold); UI components and graphical objects ≥ 3:1.
- Information is never conveyed by color alone (add an icon, text or pattern).
- Pointer targets ≥ 24×24 CSS px, or enough spacing (WCAG 2.2, 2.5.8).
- Content reflows at 320px width and 200% zoom without loss; no horizontal scrolling for text.
- Respect `prefers-reduced-motion`; nothing flashes more than 3 times per second.

### Forms
- Every input has a visible, programmatically linked label.
- Errors: text description, linked with `aria-describedby`, `aria-invalid="true"`, and focus moved to the first error or a summary on submit.
- Don't ask users to re-enter information already given in the same process (WCAG 2.2, 3.3.7); support autocomplete attributes.

### Images and media
- Meaningful images have `alt` text describing purpose; decorative images `alt=""`.
- Video has captions; audio has transcripts.

## Audit method
1. **Automated:** run axe (Storybook `@storybook/addon-a11y`, `@axe-core/playwright`, or the browser extension) on every story/page in the change. Automated tools find ~30-40% of issues; continue manually.
2. **Keyboard pass:** Tab/Shift+Tab through the component, operate it with Enter/Space/Arrows/Escape, and check focus visibility and order.
3. **Name/role/state:** inspect the accessibility tree for every interactive element.
4. **Contrast:** check token pairs used for text and borders, in every state (hover, disabled, error) and theme.
5. **Zoom/reflow:** 200% zoom and 320px viewport.

## Report format
For each issue: `file:line` or story, WCAG criterion (e.g. 1.4.3 Contrast), impact on users, and a concrete fix. Group by Blocker / Major / Minor (same scale as `code-review-standards`).
