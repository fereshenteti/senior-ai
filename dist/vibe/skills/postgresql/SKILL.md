---
name: postgresql
description: PostgreSQL schema design, data types, constraints, indexes, query performance and safe migrations for the project's PostgreSQL version. Use when designing or changing tables, writing migrations or SQL, adding indexes, investigating slow queries, or reviewing database changes.
user-invocable: true
---

# PostgreSQL

## 1. Detect the context
- The server version (`SELECT version();`, the Docker image tag, or the hosting provider's settings) and the migration tool (Prisma Migrate, TypeORM, MikroORM, Drizzle Kit, Flyway, plain SQL files). Write migrations with that tool, in its folder.
- Check features against the documentation for that version. Recent examples: PostgreSQL 18 adds `uuidv7()` (time-ordered UUIDs) and makes generated columns **virtual** by default.
- Never run migrations or destructive SQL against a shared or production database yourself; propose them and ask.

## 2. Schema design
- **Keys:** a primary key on every table: `bigint GENERATED ALWAYS AS IDENTITY`, or a UUID (`uuidv7()` when available, for index-friendly ordering) when IDs are exposed or generated outside the database.
- **Types:** `text` (with a `CHECK` on length when there is a business limit) rather than `varchar(n)`; `timestamptz` for points in time (stored in UTC); `numeric(p, s)` for money, never `float`; `boolean`; `jsonb` only for genuinely schemaless data, not to avoid designing columns; enums as a lookup table or a `CHECK` constraint when values change.
- **Constraints carry the rules:** `NOT NULL` by default, foreign keys with a deliberate `ON DELETE` behavior, `UNIQUE` for natural keys (case-insensitive with a unique index on `lower(email)`), `CHECK` for value rules.
- Normalize first; denormalize only for a measured read problem.
- Every foreign key column gets an index (PostgreSQL doesn't create one automatically).
- Names in `snake_case`, tables plural or singular as the project does, consistently.

## 3. Indexes and queries
- Index for the queries that exist: columns in `WHERE`, `JOIN` and `ORDER BY` of frequent queries; multi-column indexes ordered by equality first, then range; partial indexes for hot subsets (`WHERE deleted_at IS NULL`).
- Check plans with `EXPLAIN (ANALYZE, BUFFERS)` on realistic data before and after; a sequential scan on a large table in a hot path is a finding.
- Parameterized queries only; no string-built SQL.
- Avoid N+1: one query with a join or `IN (…)`/`ANY($1)` instead of a query per row.
- Keyset pagination (`WHERE (created_at, id) < ($1, $2) ORDER BY created_at DESC, id DESC`) for large or infinite lists; `OFFSET` only for small tables.
- Short transactions; no user interaction or network calls while a transaction is open.

## 4. Migrations
Follow `references/migrations.md` for changes on tables that hold data. Summary: forward-only, small, reversible by a follow-up migration, and never locking a busy table for long.

## 5. Review
Reviewers use `references/review.md`.
