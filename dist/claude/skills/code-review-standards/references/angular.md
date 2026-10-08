# Angular checklist

Use the `angular` skill as the reference for current patterns; this list is what reviewers check.

## Modern APIs
- [ ] Standalone components; no new NgModules.
- [ ] `input()`, `output()`, `model()`, signal queries; no new `@Input`/`@Output`/`@ViewChild` decorators.
- [ ] Built-in control flow (`@if`, `@for` with a stable `track`, `@switch`); no `*ngIf`/`*ngFor`.
- [ ] `inject()` instead of constructor injection.
- [ ] `ChangeDetectionStrategy.OnPush` on every component.
- [ ] `host` metadata instead of `@HostBinding`/`@HostListener`.

## Correctness
- [ ] No `effect()` used to sync signals (should be `computed`/`linkedSignal`).
- [ ] No signal writes inside `computed()`.
- [ ] Every `subscribe()` is cleaned up (`takeUntilDestroyed`, `toSignal`, async pipe).
- [ ] No logic that relies on zone.js triggering change detection.
- [ ] Inputs are not mutated inside the component.
- [ ] `@for` `track` uses a stable id, not `$index` for dynamic lists.

## Architecture
- [ ] Presentational components don't fetch data or inject feature services.
- [ ] API DTOs mapped to UI models outside components.
- [ ] Lazy loading for feature routes; functional guards/resolvers/interceptors.
- [ ] No business logic in templates; complex expressions moved to `computed()`.

## UI deliverables
- [ ] Styles use design tokens; no hard-coded design values (see `scss.md`).
- [ ] Storybook stories added/updated for changed public inputs and states (if the project has Storybook).
- [ ] Tests updated for changed behavior.
