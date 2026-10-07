# Forms

## Default: typed reactive forms
- Use `FormBuilder.nonNullable` (or `new FormControl('', { nonNullable: true })`) so values are typed and reset correctly.
- Define the form shape once; derive the submitted type with `form.getRawValue()`.
- Validation messages live in the template next to the control, shown only when `touched` or after submit.
- If the project's Angular version ships Signal Forms as stable and the project uses them, follow that API instead. Do not introduce an experimental forms API.

## Custom form controls
Reusable inputs (text field, select, date picker) implement `ControlValueAccessor` so they work with `formControlName` and `ngModel`:
- Provide `NG_VALUE_ACCESSOR` with `forwardRef`, or use `model()` plus a wrapper when the project prefers that.
- Support `disabled` via `setDisabledState`.
- Call `onTouched` on blur.
- Link label, hint and error with `id` / `aria-describedby`; set `aria-invalid` when the control is invalid.

## Accessibility
- Every control has a visible `<label>` (placeholder is not a label).
- Group related controls with `<fieldset>` and `<legend>`.
- On submit failure, move focus to the first invalid field or to an error summary.
