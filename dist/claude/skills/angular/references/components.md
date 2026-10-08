# Component patterns

## Skeleton
```ts
import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

@Component({
  selector: 'app-button',
  templateUrl: './button.html',
  styleUrl: './button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClass()',
    '[attr.aria-disabled]': 'disabled() || null',
  },
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly pressed = output<void>();

  protected readonly hostClass = computed(() => `btn btn--${this.variant()}`);
}
```
Follow the project's naming convention: newer Angular style guides drop the `Component` suffix and the `.component` file suffix. Match what the project does.

## Inputs
- Use `booleanAttribute` / `numberAttribute` transforms so `<app-x disabled>` works.
- Prefer union string types for variants over booleans (`size: 'sm' | 'md' | 'lg'`, not `small`, `large`).
- Required data uses `input.required<T>()`.
- Avoid inputs that mirror each other; derive with `computed()`.

## Content projection
- Use `<ng-content select="...">` slots for flexible layout (icons, actions, headers).
- Query projected content with `contentChild()` / `contentChildren()` signals.

## Host styling
- Style the host with `:host` in SCSS; set `display` explicitly (custom elements are `inline` by default).
- Variants are expressed as host classes or `:host(.btn--primary)` selectors, not deep selectors.
- Never use `::ng-deep` in new code. If a third-party component must be styled, use its CSS custom properties or a wrapper class with documented justification.

## Composition
- Reuse primitives (button, icon, input) instead of re-implementing them inside larger components.
- Directives for reusable behavior (focus trap, tooltip trigger); `hostDirectives` to compose them.

## Performance
- `@for` always has `track item.id` (or a stable key), never `track $index` for mutable lists.
- `@defer (on viewport)` for heavy, below-the-fold UI.
- Pure pipes for formatting reused in templates.
