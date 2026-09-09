-- FDS AI Agent — Batch 1 schema additions
-- Core platform: event log + job queue. No business/AI data tables yet.

-- ============================================================
-- EVENTS (append-only domain event log)
-- ============================================================
CREATE TABLE events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type        text NOT NULL,          -- e.g. 'tenant.created', 'tool.executed'
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedup_key   text,                   -- optional: enforce idempotent publishing
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- A dedup_key only needs to be unique within a tenant, and only when present.
CREATE UNIQUE INDEX idx_events_tenant_dedup
  ON events (tenant_id, dedup_key)
  WHERE dedup_key IS NOT NULL;

CREATE INDEX idx_events_tenant_type ON events (tenant_id, type);
CREATE INDEX idx_events_created_at ON events (created_at);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_events ON events
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

-- ============================================================
-- JOBS (Postgres-backed queue — no Redis needed at this scale)
-- ============================================================
CREATE TABLE jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type          text NOT NULL,
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts      int NOT NULL DEFAULT 0,
  max_attempts  int NOT NULL DEFAULT 5,
  run_at        timestamptz NOT NULL DEFAULT now(),
  locked_at     timestamptz,
  locked_by     text,
  last_error    text,
  result        jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_jobs_poll ON jobs (status, run_at);
CREATE INDEX idx_jobs_tenant ON jobs (tenant_id);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_jobs ON jobs
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );
