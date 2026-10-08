# PostgreSQL review checklist

## Schema
- [ ] Primary key on every new table; sensible key type.
- [ ] Types: `timestamptz` for time, `numeric` for money, `text` with checks, no `float` for exact values.
- [ ] `NOT NULL`, foreign keys (with a deliberate `ON DELETE`), unique and check constraints express the business rules.
- [ ] Every foreign key column has an index.

## Migrations (see `migrations.md`)
- [ ] No long lock on a table with data: indexes `CONCURRENTLY`, constraints `NOT VALID` then `VALIDATE`, no `NOT NULL` column added without a default/backfill path.
- [ ] No rename or drop that running code still uses; expand/contract steps planned.
- [ ] Backfills in batches; data changes separate from schema changes.
- [ ] `lock_timeout` set (or the tool's equivalent).
- [ ] What happens to existing rows is stated; there is a way back.

## Queries
- [ ] Parameterized; no string-built SQL.
- [ ] No N+1 patterns; no unbounded `SELECT *` on large tables in hot paths.
- [ ] Indexes exist for the new query patterns; plans checked for hot queries.
- [ ] Pagination bounded; keyset for large lists.
- [ ] Transactions short, with no network calls inside.
