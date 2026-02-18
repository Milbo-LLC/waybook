# Railway service layout

Create five Railway services in one project:

1. `web` from repo root, start command: `pnpm --filter @waybook/web start`
2. `api` from repo root, start command: `pnpm --filter @waybook/api start`
3. `worker` from repo root, start command: `pnpm --filter @waybook/worker start`
4. `postgres` using Railway PostgreSQL plugin
5. `redis` using Railway Redis plugin

Build command for app services:

`pnpm install --frozen-lockfile=false && pnpm build`

Pre-deploy migration command for API service:

`pnpm db:migrate`

Use separate Railway environments for dev/staging/prod and map each to matching env files under `infra/env`.
