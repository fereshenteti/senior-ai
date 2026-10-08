---
name: i18n
description: Internationalization and localization for web frontends - detect the project's i18n setup (Angular @angular/localize, Transloco, ngx-translate, i18next, none), mark every user-facing text, ICU plural and select messages, locale-aware dates, numbers and currencies, right-to-left layouts, translation files and missing-translation checks. Use when adding or changing user-facing text, adding a language, or reviewing a UI for localization.
user-invocable: true
---

# Internationalization (i18n)

## 1. Detect the setup
- **Angular built-in:** `@angular/localize` in `package.json`, an `i18n` block in `angular.json`, `i18n` attributes or `$localize` in code. Translations are compiled in: one build per locale (`ng build --localize`), no runtime language switch.
- **Transloco** (`@jsverse/transloco`) or **ngx-translate** (`@ngx-translate/core`): runtime translation with JSON files and a language switch.
- **Other frameworks:** i18next / react-i18next, react-intl (FormatJS), vue-i18n.
- **None:** if the product needs several languages, the choice is an architecture decision: ask the `architect` (or the user). Angular built-in gives the smallest, fastest bundles; Transloco gives runtime switching and lazy-loaded translations. **Ask before adding a library.**

Follow the library the project uses. Never mix two.

## 2. Every user-facing text goes through i18n
Text content, button labels, `aria-label`, `title`, `alt`, `placeholder`, validation and error messages, empty states, toasts, page titles, emails and notifications. Not translated: code identifiers, log messages, URLs, user content.
- Angular built-in: `i18n` on elements, `i18n-<attr>` on attributes (`i18n-aria-label`), `$localize` in TypeScript. Give each message a meaning, a description and a stable custom ID: `i18n="Cart|Button to empty the cart@@cart.empty"`.
- Key-based libraries: namespaced, stable keys (`cart.empty.button`), never the English text as the key.
- Don't translate fragments and glue them together; word order differs between languages. One complete message with placeholders: `Hello {name}, you have {count} messages`.

## 3. Plurals, gender and variants: ICU messages
- Plurals: `{count, plural, =0 {No notes} =1 {One note} other {{{count}} notes}}`. Many languages have more plural forms than English (`few`, `many`); never write `count + ' items'`.
- Choices: `{role, select, admin {Administrator} other {Member}}`.
- Nest plural and select in one message rather than splitting the sentence.

## 4. Formatting by locale
- Dates, times, numbers, percentages and currencies use the locale: Angular `DatePipe`, `DecimalPipe`, `PercentPipe`, `CurrencyPipe` with `LOCALE_ID`, or `Intl.DateTimeFormat` / `Intl.NumberFormat`. Never build them with string concatenation or fixed formats.
- Store and send dates in UTC (ISO 8601); display them in the user's time zone.
- Sorting and comparing text: `Intl.Collator`, not `<` on strings.
- Currency comes from the data, not from the UI language.

## 5. Layout
- Set `lang` (and `dir`) on `<html>` for the active locale.
- Right-to-left (Arabic, Hebrew, Persian…): CSS logical properties (`margin-inline-start`, `padding-inline`, `inset-inline-end`, `text-align: start`), `dir`-aware icons (mirror arrows, not logos), no hard-coded left/right.
- Text grows 30-40% in many languages and is taller in some scripts: no fixed widths on text containers, allow wrapping, test with long strings.

## 6. Translation files
- Extract after changing text (`ng extract-i18n`, or the library's extractor), keep source and target files in sync, and keep IDs stable so translations aren't lost.
- Missing translations fail the build in CI (Angular: `"i18nMissingTranslation": "error"` in the build options), or are listed in the report.
- Don't machine-translate into the shipped files without telling the user; mark new entries for review.
- Pseudo-localization (accented, lengthened strings) or the longest real language catches hard-coded text and truncation early.

## 7. Review checklist
- [ ] No hard-coded user-facing text, including attributes and TypeScript messages.
- [ ] No concatenated sentences; ICU for plurals and choices.
- [ ] Locale-aware dates, numbers and currencies; UTC in data.
- [ ] Logical CSS properties; nothing breaks in RTL or with 40% longer text.
- [ ] Translation files updated; new IDs stable and described.
