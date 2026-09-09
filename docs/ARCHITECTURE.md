# ARCHITECTURE — FDS AI Agent (Batch 0)

This document describes only what Batch 0 actually built. For the full
target architecture and batch roadmap, see the separate
"FDS AI Agent — New Build Architecture Plan" document.

## What Batch 0 is

A minimal, secure multi-tenant foundation: tenants, users, roles,
permissions, auth, and an audit trail — with nothing AI- or
business-specific layered on top yet. Every later batch builds on this
without changing it.

## Request flow

```
Client
  -> Express app (src/app.ts)
  -> requestLogger (structured logs, tags tenant/user once authenticated)
  -> route (src/routes/index.ts)
  -> requireAuth (verifies JWT, attaches req.auth = {userId, tenantId, roles})
  -> requirePermission(code) (DB check: does this user's role grant this permission, in this tenant?)
  -> controller -> service -> withTenantContext(tenantId, ...) -> Postgres (RLS-enforced)
```

## Why permission checks hit the database instead of just reading the JWT

The JWT carries role *names* for convenience, but `requirePermission`
re-checks the live `role_permissions` table on every call. If an admin
revokes a permission, that takes effect immediately — it doesn't wait
for the token to expire. This costs one extra query per protected
request, which is an acceptable trade for correctness at this stage.

## How isolation is verified

`scripts/test-tenant-isolation.ts` creates two real tenants through the
actual signup flow, then — while scoped to tenant A's context — tries
(a) a direct lookup of tenant B's user by ID, and (b) an unfiltered
`SELECT * FROM users` with no `WHERE tenant_id` clause at all. Both must
return zero rows from tenant B for the test to pass. This is
deliberately adversarial: it simulates a developer forgetting a tenant
filter in application code, which RLS should catch regardless.

## Batch 1 additions

```
Client
  -> requireAuth -> requirePermission (unchanged from Batch 0)
  -> tool.controller -> container.orchestrator.runTool(name, input, ctx)
       -> ToolRegistry.get(name)
       -> tool.execute(input, ctx)   [real logic, or a 501 for stubs]
       -> EventBus.publish('tool.executed', ...)
```

New layers, each independently testable (see `scripts/test-*.ts`):

- **Tools** (`src/core/tools/`) — see `docs/AI.md`.
- **Events** (`src/core/events/`) — durable, tenant-isolated, optionally
  idempotent, with in-process subscribers.
- **Jobs** (`src/core/jobs/`) — Postgres-backed queue + `SKIP LOCKED`
  worker, run as a separate process (`npm run worker`), not inside the
  API server.
- **Integration adapters** (`src/core/integrations/`) — see
  `docs/INTEGRATIONS.md`.
- **`src/core/container.ts`** — the single place all of the above are
  wired together and built-in tools/job handlers are registered. Later
  batches add to this file rather than scattering wiring around.

## Known limitations of Batch 1 (by design, not oversight)

- `EventBus.publish()` can fire in-process subscribers for an event
  whose transaction later rolls back if the caller passed its own
  `client`. Harmless today (no external side effects exist yet); must
  be revisited before Batch 7's automation engine wires events to real
  actions (e.g. via a transactional outbox pattern).
- The job worker is a single polling loop per process with a fixed
  2-second idle interval — fine at current scale, not tuned for
  throughput.
- No tool-level permission checks yet beyond `requireAuth` — a
  logged-in user of any role can call any implemented tool via the API.
  Fine while the only real tools are read-only tenant/user lookups;
  revisit before any tool can mutate business data.

## Known limitations of Batch 0 (by design, not oversight)

- No password reset / email verification flow yet.
- No refresh tokens — JWTs simply expire after `JWT_EXPIRES_IN`.
- No rate limiting on `/auth/*` yet — add before any public deployment.
- No platform-admin (cross-tenant) role yet; `withSystemContext` exists
  only for the two internal operations named in DATABASE.md.
- `GROQ_API_KEY` is read into config but used nowhere — AI integration
  begins in Batch 1.

None of the above should be treated as "coming later automatically" —
each is an explicit line item for a future batch, not a hidden gap.
