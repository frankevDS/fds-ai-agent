# DATABASE — FDS AI Agent (Batch 0)

Batch 0 ships exactly these tables — nothing business/AI-related yet:

- `tenants` — one row per business using the platform
- `permissions` — global catalog of permission codes (not tenant-scoped)
- `roles` — tenant-scoped; every tenant gets its own `ADMIN` and `MEMBER` rows at signup
- `role_permissions` — join table granting permission codes to a tenant's roles
- `users` — tenant-scoped; email is unique per tenant, not globally
- `user_roles` — join table assigning roles to users
- `audit_logs` — append-only; every sensitive action writes a row

See `migrations/001_init_schema.sql` for the full DDL.

## Tenant isolation mechanism

Every tenant-owned table has Row-Level Security enabled and forced. The
policy on each compares the row's `tenant_id` against the Postgres
session variable `app.current_tenant_id`, which the application sets at
the start of every request via `withTenantContext()` in `src/config/db.ts`.

There is exactly one escape hatch, `withSystemContext()`, which sets
`app.bypass_rls = 'on'`. It is used only for tenant creation (there's no
tenant to scope to yet) and for resolving a login's `tenantSlug` to a
tenant ID before the user's own credentials are checked. No business
data ever flows through `withSystemContext()`.

## Seeded data

Batch 0's migration seeds the six Batch-0-relevant permission codes
(`tenant:read`, `tenant:update`, `user:create`, `user:read`,
`user:update`, `user:delete`). Per-tenant `ADMIN`/`MEMBER` roles and
their permission grants are created at signup time, not by the
migration — see `DEFAULT_ROLE_PERMISSIONS` in `auth.service.ts`.

## Batch 1 additions

- `events` — append-only domain event log, RLS-scoped like every other
  tenant table. Supports optional idempotent publishing via a
  `(tenant_id, dedup_key)` unique index (only enforced when `dedup_key`
  is set).
- `jobs` — a Postgres-backed job queue (deliberately not Redis, to stay
  free-tier-friendly per the cost strategy). Workers claim rows with
  `SELECT ... FOR UPDATE SKIP LOCKED` so multiple worker processes can
  run concurrently without double-processing a job. Failed jobs get
  exponential-ish backoff (`attempts * 5s`) and are marked `failed` once
  `max_attempts` is reached, rather than retrying forever.

Both are polled/written via `withSystemContext()` when the operation is
genuinely cross-tenant (the job worker scans jobs for ALL tenants) and
`withTenantContext()` when scoped to one tenant (enqueueing a job,
publishing an event).

## What is NOT in Batch 1

Products, orders, customers, conversations, knowledge, campaigns,
analytics, and the `integrations` table (for storing per-tenant
WooCommerce/Shopify credentials) are still **NOT IMPLEMENTED** — they
arrive in Batches 2–11.
