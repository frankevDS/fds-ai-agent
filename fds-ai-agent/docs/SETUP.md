# SETUP — FDS AI Agent (Batch 0)

## Prerequisites
- Node.js 20+
- A PostgreSQL 14+ database (local install, or a free Supabase project)

## 1. Create the application database role correctly

RLS only protects you if the connecting role is neither a superuser nor
the table owner (owners bypass RLS by default, which is why the
migration also runs `FORCE ROW LEVEL SECURITY`, but it's still best
practice to connect as a plain role):

```sql
CREATE ROLE fds_app_user WITH LOGIN PASSWORD 'changeme';
CREATE DATABASE fds_ai_agent OWNER postgres; -- keep ownership with a separate admin role
GRANT CONNECT ON DATABASE fds_ai_agent TO fds_app_user;
\c fds_ai_agent
GRANT USAGE ON SCHEMA public TO fds_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fds_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fds_app_user;
```

Then set `DATABASE_URL` to connect as `fds_app_user`, not `postgres`.

## 2. Install dependencies

```bash
npm install
```

## 3. Configure environment

```bash
cp .env.example .env
# edit .env: set DATABASE_URL and a real random JWT_SECRET
```

## 4. Run migrations

```bash
npm run migrate
```

## 5. Start the API

```bash
npm run dev
```

## 6. Verify Batch 0's Definition of Done

```bash
# Health check
curl http://localhost:4000/api/v1/health

# Tenant isolation proof (see docs/ARCHITECTURE.md "How isolation is verified")
npm run test:tenant-isolation
```

## Alternative: verify via GitHub instead of your own machine

If you don't want to run Node/Postgres locally, push this project to a
GitHub repo. Two things then become available:

- **GitHub Actions** (`.github/workflows/ci.yml`): runs automatically on
  every push. It spins up a real Postgres in GitHub's cloud runner,
  applies the migrations, and runs `test:tenant-isolation` as a
  least-privilege role (deliberately not the Postgres superuser, since a
  superuser silently bypasses RLS and would make the test meaningless).
  A green checkmark on the commit is a real, reproducible pass — not
  something either of us has to take on faith.
- **GitHub Codespaces** (repo → "Code" → "Codespaces" → "Create
  codespace"): a full cloud dev environment with internet access, if you
  want to `npm run dev` and hit the API interactively rather than only
  see CI results.

Either path runs `npm install` on GitHub's infrastructure, which is why
it works even though this project's own generation environment had no
network access to verify it directly.

## 7. Manual smoke test of the auth + permission flow

```bash
# Sign up a new tenant + its first ADMIN user
curl -X POST http://localhost:4000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"tenantName":"Acme Co","tenantSlug":"acme-co","adminEmail":"owner@acme.com","adminPassword":"a-strong-password-1"}'

# Log in (use the tenantSlug from signup)
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"tenantSlug":"acme-co","email":"owner@acme.com","password":"a-strong-password-1"}'

# Use the returned token to list users in the tenant
curl http://localhost:4000/api/v1/users -H "Authorization: Bearer <token>"

# Use it to create a MEMBER user (only works because this token has user:create via ADMIN)
curl -X POST http://localhost:4000/api/v1/users \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"email":"teammate@acme.com","password":"another-strong-pass","role":"MEMBER"}'
```

A MEMBER-role token attempting `POST /users` should receive `403 forbidden` —
that's the permission model working as intended.
