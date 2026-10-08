# Signals and data

## Choosing the primitive
| Need | Use |
|---|---|
| Local mutable state | `signal()` |
| Derived read-only state | `computed()` |
| Derived state the user can also override (e.g. selected item reset when list changes) | `linkedSignal()` |
| Async value driven by signals (fetch on param change) | `resource()` / `httpResource()` when stable in the version |
| Stream from RxJS into the template | `toSignal(obs$, { initialValue })` |
| Signal into an RxJS pipeline | `toObservable(sig)` |
| Side effect to the outside world | `effect()` (rarely) |

## Rules
- Never write to a signal inside `computed()`.
- Do not use `effect()` to copy one signal into another; that is `computed()` or `linkedSignal()`.
- Expose state read-only from services: keep a private `signal()` and expose `.asReadonly()` or a `computed()`.
- Update immutably: `items.update(list => [...list, item])`.
- Subscriptions always end: `takeUntilDestroyed()` (inject context) or `toSignal()`.

## State service pattern
```ts
@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly items = signal<CartItem[]>([]);
  readonly all = this.items.asReadonly();
  readonly total = computed(() => this.items().reduce((sum, i) => sum + i.price * i.qty, 0));

  add(item: CartItem) {
    this.items.update(list => [...list, item]);
  }
}
```
If the project uses NgRx (Store or SignalStore) or another state library, follow it instead of introducing services like this.

## HTTP
- Typed responses: `http.get<Invoice[]>(url)`.
- Map API DTOs to UI models at the boundary, not in components.
- Handle loading and error states explicitly in the UI (`resource.isLoading()`, `resource.error()`).
