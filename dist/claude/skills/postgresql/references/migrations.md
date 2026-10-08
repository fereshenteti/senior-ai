# Safe migrations

A migration that is fine on an empty development database can lock or break production. Assume every table has data and live traffic.

## Before writing
- One concern per migration; schema and data changes in separate migrations.
- Set a short `lock_timeout` (e.g. `SET lock_timeout = '5s';`) so a blocked migration fails fast instead of queueing all traffic behind it.
- Deploy in steps when code and schema must change together (**expand → migrate → contract**): add the new shape, deploy code that writes both and reads the new one, backfill, then remove the old shape in a later release.

## Common operations
| Change | Risk | Safe way |
|---|---|---|
| Add a nullable column, or one with a constant default | none (instant) | plain `ADD COLUMN` |
| Add a `NOT NULL` column to a table with rows | fails, or rewrites the table | add nullable with default → backfill in batches → `SET NOT NULL` (after a validated `CHECK (col IS NOT NULL) NOT VALID` to avoid a long scan under lock) |
| Add a foreign key or check constraint | scans the table under lock | `ADD CONSTRAINT … NOT VALID`, then `VALIDATE CONSTRAINT` in a separate statement |
| Create an index | blocks writes for the whole build | `CREATE INDEX CONCURRENTLY` (outside a transaction; most migration tools have an option for it) |
| Add a unique constraint | blocks writes while indexing | `CREATE UNIQUE INDEX CONCURRENTLY`, then `ADD CONSTRAINT … UNIQUE USING INDEX` |
| Rename a column or table | breaks running code | expand/contract: add new, write both, backfill, switch reads, drop old later |
| Drop a column or table | breaks running code; data loss | stop reading and writing it in code first; drop in a later release; confirm the data is not needed or archived |
| Change a column type | often rewrites the table | new column + backfill + switch, unless the cast is binary-compatible |
| Backfill data | long locks, bloat, replication lag | batches of a few thousand rows by primary key, committed separately |

## Every migration
- Runs on a copy of realistic data in a test or staging database before production.
- States what happens to existing rows.
- Has a way back: a follow-up migration or a documented restore, written before the deploy.
