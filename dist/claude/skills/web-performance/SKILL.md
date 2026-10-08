---
name: web-performance
description: Web performance - measure and improve Core Web Vitals (LCP, INP, CLS), bundle size, loading strategy, images and fonts, rendering and change detection, with Lighthouse and Chrome DevTools traces. Use when building or reviewing pages and components for speed, when a performance budget fails, or when a page feels slow.
user-invocable: true
---

# Web performance

## 1. Measure before changing anything
- Measure a **production build** (`ng build`, `npm run build`), served locally or on a preview URL, never the dev server.
- **Lab:** Lighthouse and a performance trace in Chrome DevTools (the Chrome DevTools MCP server when available), on a mid-range mobile profile.
- **Targets** (Core Web Vitals, 75th percentile of real users): **LCP ≤ 2.5 s**, **INP ≤ 200 ms**, **CLS ≤ 0.1**. Lab numbers are estimates; field data (CrUX, real-user monitoring) wins when it exists.
- **Bundle:** the build's size report and budgets (`budgets` in `angular.json`), and a breakdown of what is inside (`ng build --stats-json`, then esbuild's analyzer or `source-map-explorer`).
- Write down the numbers before and after every change. A change without a measured gain is reverted.

## 2. Loading
- **Split by route:** lazy routes (`loadComponent`, `loadChildren` in Angular; dynamic `import()` elsewhere). The first page loads only what it shows.
- **Defer below the fold and heavy widgets:** Angular `@defer (on viewport)` / `(on interaction)` with a placeholder of the same size; with SSR, incremental hydration (`hydrate on …`).
- **Dependencies:** no whole-library imports for one function (`lodash` → native or `lodash-es` per function; `moment` → `Intl` or `date-fns`). Every new dependency is weighed in kilobytes.
- **Budgets** fail the build when exceeded; raise a budget only with a reason.
- Server-side rendering with hydration for content and landing pages, where LCP matters most.

## 3. Images and fonts
- Angular: `NgOptimizedImage` (`ngSrc`) with `width` and `height` (or `fill` inside a sized container); `priority` on the LCP image only.
- Modern formats (AVIF, WebP), responsive sizes (`srcset`, `sizes`), lazy loading below the fold, never for the LCP image.
- Fonts: as few families and weights as possible, `font-display: swap`, preload only the font used above the fold, subset when possible.

## 4. Layout stability (CLS)
- Every image, video, ad and embed has dimensions or an `aspect-ratio`.
- Placeholders and skeletons have the size of the final content.
- Never insert content above what the user is reading, except in response to their action.

## 5. Rendering and interaction (INP)
- Angular: `OnPush` everywhere and zoneless when the version supports it; state in signals, derived values in `computed()`; `@for` with a stable `track`; no function calls with work inside templates.
- Long lists: virtual scrolling (Angular CDK `cdk-virtual-scroll-viewport`) or pagination beyond a few hundred rows.
- Event handlers do the minimum, then yield: debounce input, move heavy computation to a Web Worker, split long tasks (`scheduler.yield()` or `setTimeout`).
- Avoid layout thrashing: read layout, then write, not interleaved; animate `transform` and `opacity` only.

## 6. Network
- Cache static assets long with content hashes; compression (Brotli or gzip) on.
- No request waterfalls: load data in parallel, start it in the route resolver or with `httpResource`, not after render.
- `preconnect` to critical third-party origins; third-party scripts deferred and justified.

## 7. Audit report (checker)
Start with the `review-loop` verdict line. Each finding: severity, location (route, component, `file:line`), the measurement that shows it (metric, value, target), the cause, and the fix with its expected gain.
- **Blocker:** a Core Web Vital far beyond its target on a main page (for example LCP > 4 s, INP > 500 ms, CLS > 0.25), a main-thread freeze, or a budget exceeded by more than 20%.
- **Major:** a Core Web Vital above its target, a regression of more than 10% against the previous measurement, a missing lazy load for a large feature, the LCP image lazy-loaded.
- **Minor:** improvements without a measured user impact yet.
If you could not measure (no build, no browser tool), say so and review the code against this checklist only, marking findings as unmeasured.
