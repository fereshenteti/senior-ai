# Testing

## Detect the runner
Check `package.json` and `angular.json`:
- `vitest` or the `@angular/build:unit-test` builder: Vitest
- `jest`, `jest-preset-angular`: Jest
- `karma`, `jasmine-core`: Karma + Jasmine

Write tests in that runner's syntax (`vi.fn()` vs `jest.fn()` vs `jasmine.createSpy()`). Do not migrate runners unless asked.

## What to test in a UI component
- Rendering per input combination (variants, sizes, disabled).
- Outputs fire on the right interaction, and not when disabled.
- Accessibility attributes (`role`, `aria-*`, labels) are present and correct.
- Keyboard interaction for interactive widgets.
Do not test styling or pixels here; that is the visual check's job.

## How
- Test through the DOM like a user: query by role, label or text (Angular Testing Library if the project has it), not by CSS classes.
- Set signal inputs with `fixture.componentRef.setInput('variant', 'secondary')`.
- Call `fixture.detectChanges()` (or `await fixture.whenStable()`) after changes; write tests that also pass zoneless.
- Mock HTTP with `provideHttpClientTesting()` and `HttpTestingController`.
- One behavior per test; descriptive names: `it('emits pressed when clicked')`.

## Files
- Co-located `*.spec.ts` next to the source file.
- Shared test helpers only when used by three or more spec files.
