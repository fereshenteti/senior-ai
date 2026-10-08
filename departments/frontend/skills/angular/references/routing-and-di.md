# Routing and dependency injection

## Routing
- Lazy-load features: `loadComponent` for pages, `loadChildren` pointing at a routes file for feature areas.
- Functional guards and resolvers (`CanActivateFn`, `ResolveFn`), not class-based ones.
- Bind route params to inputs with `withComponentInputBinding()` instead of reading `ActivatedRoute` manually.
- Give every route a `title` (or a title strategy) for accessibility and browser history.
- Configure the router in `app.config.ts` with `provideRouter(routes, ...features)`.

## Dependency injection
- `inject()` in field initializers; no constructor parameter injection in new code.
- `providedIn: 'root'` for app-wide singletons; component-level `providers` for state scoped to a component subtree.
- `InjectionToken` with a factory for configuration values.
- Application-wide setup uses `provide*` functions in `app.config.ts` (`provideHttpClient(withInterceptors([...]))`, etc.).
- Functional HTTP interceptors (`HttpInterceptorFn`).
