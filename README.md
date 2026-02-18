# Waybook

Waybook is a travel journaling and re-bookable keepsake platform built as a TypeScript-first Turborepo.

## Stack

- Web: Next.js App Router + Tailwind
- API: Hono (Node runtime)
- Mobile: Expo React Native + expo-router
- DB: PostgreSQL (Drizzle ORM)
- Queue: Redis + BullMQ
- Media storage: Cloudflare R2 (direct signed uploads)
- Auth: Better Auth (self-hosted in API)

## Monorepo layout

- `apps/web`: Next.js app (`/`, `/app`, `/w/[slug]`, `/share/[token]`)
- `apps/api`: Hono API (`/v1/*`)
- `apps/mobile`: Expo mobile app
- `apps/worker`: BullMQ background worker
- `packages/contracts`: shared DTOs, zod schemas, typed API client
- `packages/db`: Drizzle schema + migrations
- `packages/auth`: Better Auth setup
- `packages/ui`: shared UI primitives
- `packages/config`: shared tsconfig presets
- `infra`: env templates, Railway deployment notes, runbooks

## Quick start

1. Install dependencies:

```bash
pnpm install
```

2. Copy env values:

```bash
cp .env.example .env
```

3. Run database migrations:

```bash
pnpm db:migrate
```

4. Start all apps:

```bash
pnpm dev
```

## API highlights

- Auth: `POST /v1/auth/*`, `GET /v1/me`
- Waybooks: CRUD + share links + timeline
- Entries: CRUD
- Media: signed upload URL + upload complete + lookup
- Public read: slug and share token endpoints
- Post-MVP placeholders: map and AI summary endpoints (501)

## Media upload flow

1. Client requests upload URL (`POST /v1/entries/:entryId/media/upload-url`)
2. API creates `media_assets` row in `pending_upload`
3. Client uploads directly to R2
4. Client confirms completion (`POST /v1/media/:mediaId/complete`)
5. Worker processes media and marks status `ready`

## Notes

- Web auth uses Better Auth endpoints under `/v1/auth/*` with cookie sessions (`credentials: include`).
- Railway deployment shape and environment templates are in `infra/`.
