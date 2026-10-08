---
name: angular
description: Modern Angular development with the latest best practices for the project's Angular version - standalone components, signals, new control flow, OnPush, inject(), typed forms, testing. Use for any Angular component, service, routing, forms or test work.
user-invocable: true
---

# Angular

## 1. Detect the context first
1. Read `package.json`: note the `@angular/core` major version, the test runner (Vitest, Jest or Karma/Jasmine) and whether Storybook is installed.
2. Read `angular.json` (or `project.json` in Nx): style language, prefix, builder.
3. Look at 2-3 existing components to learn the local conventions (file naming, folder layout, state management).
4. **Use the newest APIs that the detected version supports.** If the Angular CLI MCP server is available, query its best-practices and documentation tools instead of relying on memory; APIs evolve quickly. If an API is marked experimental or developer preview in that version, do not use it unless the project already does.

The project's existing conventions win over this skill when they conflict, except for patterns Angular has deprecated.

## 2. Core rules (current Angular)
- **Standalone everything.** No new NgModules. Do not write `standalone: true` explicitly on versions where it is the default.
- **Signals for state:** `signal()`, `computed()`, `linkedSignal()` for derived-but-writable state. Use `effect()` only for side effects that leave Angular (logging, DOM APIs, storage), never to sync one signal into another.
- **Signal-based APIs:** `input()` / `input.required()`, `output()`, `model()` for two-way binding, `viewChild()` / `contentChildren()` signal queries. No `@Input`/`@Output`/`@ViewChild` decorators in new code.
- **Built-in control flow:** `@if`, `@for` (always with a meaningful `track`), `@switch`, `@let`, `@defer` for lazy heavy UI. No `*ngIf`/`*ngFor`.
- **`ChangeDetectionStrategy.OnPush`** on every component. Write code that also works zoneless (no reliance on zone-triggered change detection).
- **`inject()`** instead of constructor injection.
- **Host bindings in the `host` metadata object**, not `@HostBinding`/`@HostListener`.
- **Class and style bindings** (`[class.active]`, `[style.width.px]`) instead of `ngClass`/`ngStyle`.
- **Async data:** prefer `resource()`/`httpResource()` where stable in the version, otherwise RxJS with `toSignal()`. No manual `subscribe()` without `takeUntilDestroyed()`.
- **Images:** `NgOptimizedImage` for static images.
- **Templates stay simple:** no complex logic or function calls with side effects in templates; move logic into `computed()`.
- **Strict typing:** no `any`; typed reactive forms; strict template checking stays on.

## 3. Component anatomy
- One component per folder with separate `.ts`, `.html` and `.scss` files (inline only for trivial components, if the project does that).
- Public API: inputs and outputs only. Keep internals `protected`/`private`. Template-only members are `protected`.
- Presentational (UI) components have no service injection beyond what they render; containers fetch data.
- Selectors use the project prefix.

## 4. References (load only when relevant)
- `references/components.md`: component patterns, content projection, host styling, inputs with transforms.
- `references/signals-and-data.md`: signals, resources, RxJS interop, state services.
- `references/forms.md`: typed reactive forms, validation, ControlValueAccessor for custom controls.
- `references/routing-and-di.md`: routing, lazy loading, guards and resolvers, DI providers.
- `references/testing.md`: unit and component tests with whichever runner the project uses.
