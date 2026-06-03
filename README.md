# FrameVid

Video hosting and delivery built for Framer designers — upload in the dashboard, play via a native Framer code component (HLS, motion effects, analytics).

See [prd.md](./prd.md) for product spec, [SYSTEMDESIGN.md](./SYSTEMDESIGN.md) for architecture, and [status.md](./status.md) for build progress.

## Stack

- **Dashboard:** Next.js 14, Tailwind, Drizzle, custom JWT auth
- **Component:** React, Framer Motion, hls.js (Framer Marketplace target)
- **Worker:** BullMQ, FFmpeg, Cloudflare R2
- **Data:** Postgres (Supabase-compatible), Redis (Upstash/local)
- **Engagement analytics:** Heartbeat beacons (5s buckets) → `video_events`; public popularity curve on the player; dashboard retention heatmap with AI drop-off insights (Deepgram + OpenAI)

## Prerequisites

- Node 20+
- pnpm 10+
- PostgreSQL
- Redis
- FFmpeg (worker transcoding; dashboard **Select frame** thumbnail capture uses browser canvas first, then server ffmpeg — `winget install Gyan.FFmpeg` on Windows)

## Quick start

```bash
pnpm install
cp .env.example apps/dashboard/.env.local
cp .env.example apps/worker/.env

# Edit DATABASE_URL and REDIS_URL in both env files

# Run migrations (from packages/db)
pnpm --filter @framevid/db db:migrate

# Terminal 1 — dashboard
pnpm --filter @framevid/dashboard dev

# Terminal 2 — transcoding worker
pnpm --filter @framevid/worker dev
```

Open http://localhost:3000 → sign up → upload a video.

### Local upload without R2

Leave `CLOUDFLARE_R2_ACCOUNT_ID` empty. Uploads go to `LOCAL_UPLOAD_DIR` (default `./.data/uploads`) and transcode jobs run via Redis.

### Production R2

Set all `CLOUDFLARE_R2_*` variables. After browser PUT to presigned URL, dashboard calls `POST /api/videos/upload/complete` to queue transcoding.

## Framer component (dev)

Set the component **API Base URL** property to:

`http://localhost:3000/api/v1`

Or set `NEXT_PUBLIC_FRAMERVID_API_URL` when building the component package.

## Monorepo commands

```bash
pnpm dev          # all apps
pnpm build
pnpm typecheck
pnpm lint
```

## Project layout

```
apps/dashboard/   # Designer UI + API
apps/component/   # Framer player
apps/worker/      # FFmpeg transcoding
packages/db/      # Drizzle schema
packages/queue/   # BullMQ shared queue
packages/types/   # Shared TypeScript types
```

## Tracking progress

Update [status.md](./status.md) when you complete features — it mirrors the PRD phases and notes what is done vs remaining.
