FrameVid — Agent Guidelines

Project: FrameVid is a video hosting and delivery platform built exclusively for Framer designers.
Stack: Next.js 14 + TypeScript + Tailwind CSS (dashboard) · React + Framer Motion + hls.js (Framer component) · Node.js workers (transcoding) · Cloudflare R2 (storage) · ClickHouse (events) · Postgres via Supabase (relational) · Redis via Upstash (job queue) · Fly.io (FFmpeg workers)
Repo layout: monorepo — apps/dashboard, apps/component, apps/worker, packages/db, packages/types, packages/config


1. Project Context
Directory Map
framevid/
├── apps/
│   ├── dashboard/          # Next.js 14 web app — designer-facing UI
│   │   ├── app/            # App router — pages and layouts
│   │   ├── components/     # UI components (shadcn/ui base)
│   │   ├── lib/            # Utilities, API clients, auth helpers
│   │   └── public/         # Static assets
│   ├── component/          # Framer code component — published to Marketplace
│   │   ├── src/
│   │   │   ├── FrameVidPlayer.tsx   # Main component
│   │   │   ├── controls/            # Custom player controls
│   │   │   ├── effects/             # Motion effect variants
│   │   │   ├── lightbox/            # Lightbox overlay
│   │   │   └── utils/               # HLS init, analytics beacon, helpers
│   │   └── package.json
│   └── worker/             # Fly.io transcoding worker
│       ├── src/
│       │   ├── processor.ts         # BullMQ consumer + FFmpeg + Deepgram handoff
│       │   └── r2.ts                # R2 download/upload helpers
│       └── Dockerfile
├── packages/
│   ├── db/                 # Drizzle ORM schema + migrations (Postgres)
│   ├── types/              # Shared TypeScript types across apps
│   └── config/             # Shared ESLint, Tailwind, TS configs
├── AGENTS.md               # This file
├── .env.example
└── turbo.json              # Turborepo config
Build & Dev Commands
bash# Install all dependencies
pnpm install

# Run all apps in dev mode
pnpm dev

# Run specific app
pnpm --filter dashboard dev
pnpm --filter component dev
pnpm --filter worker dev

# Build everything
pnpm build

# Run tests
pnpm test

# Run tests for specific package
pnpm --filter dashboard test

# Type check
pnpm typecheck

# Lint
pnpm lint

# Database migrations
pnpm --filter @framevid/db db:generate
pnpm --filter @framevid/db db:migrate

# Push component to Framer Marketplace (manual step — do not automate)
# pnpm --filter component build → upload dist/ manually via Framer Developer portal
Environment Variables
bash# apps/dashboard/.env.local
NEXT_PUBLIC_API_URL=
JWT_SECRET=                      # Custom session signing (not Clerk)
DATABASE_URL=                    # Supabase Postgres connection string
REDIS_URL=                       # Upstash Redis URL
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=
CLOUDFLARE_R2_PUBLIC_URL=        # https://cdn.framevid.co
CLICKHOUSE_URL=                  # Planned — events currently in Postgres
OPENAI_API_KEY=                  # AI insights + friction analysis
DEEPGRAM_API_KEY=                # Auto-captions (webhook)
DEEPGRAM_WEBHOOK_SECRET=         # Verify callback signatures
RESEND_API_KEY=

# apps/worker/.env
DATABASE_URL=
REDIS_URL=
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=
CLOUDFLARE_R2_PUBLIC_URL=
DEEPGRAM_API_KEY=
DASHBOARD_PUBLIC_URL=            # Deepgram callback base URL

2. Architecture Decisions
These are settled decisions. Do not re-architect without explicit instruction.

Storage is always Cloudflare R2. Never suggest AWS S3 as a drop-in unless asked. R2 has zero egress fees — this is the core cost model. All R2 keys follow the pattern /{workspace_id}/{video_id}/{type}/ where type is raw, transcoded, thumbnails, or captions.
HLS-only delivery. All videos are transcoded to HLS (three variants: 360p, 720p, 1080p + master manifest). Progressive MP4 delivery is not supported. hls.js handles non-Safari browsers; Safari uses native HLS.
Transcoding runs on Fly.io workers, not Lambda. FFmpeg binaries are too large for Lambda cold starts at acceptable latency. Workers are persistent Node.js processes on Fly.io with BullMQ consuming from the Redis queue.
Postgres `video_events` for all player telemetry today (including `heartbeat` every 5s). ClickHouse migration is planned per PRD — do not assume ClickHouse is available. When adding analytics queries, aggregate in SQL; do not load raw events into the client.
Postgres (via Drizzle ORM) for all relational data. Users, workspaces, videos metadata, settings, folders, team members. Never use raw SQL — always go through Drizzle.
Framer component uses addPropertyControls. All user-configurable properties are exposed via Framer's property panel. Never use React state for things that should be property controls.
Canvas vs published mode is always handled. Every new Framer component feature must check RenderTarget.current() === RenderTarget.canvas and render a safe, static fallback on canvas. Animated or data-fetching code must not run in canvas mode.


3. Code Standards
TypeScript

Strict mode is on. No any. No @ts-ignore without a comment explaining why.
All API response types live in packages/types. Never inline response shapes in components.
Use Zod for all runtime validation of external data — API responses, form inputs, environment variables.
Prefer type over interface for object shapes. Use interface only when extending is intentional.

React & Next.js

App router only. No pages directory.
Server components by default. Add "use client" only when you need browser APIs, event handlers, or hooks.
Data fetching in server components via direct database calls or server actions. No useEffect for initial data fetching.
useEffect is for side effects only — subscriptions, third-party library initialization, imperative DOM work.
All forms use React Hook Form + Zod resolver. Never build controlled form state manually.
Component files export one primary component. Utilities go in lib/. Types go in packages/types/.

Framer Component (apps/component)

The component must work when imported cold — no dependencies on dashboard being available.
All external fetches go to https://api.framevid.co — never hardcode staging or localhost URLs in shipped code.
hls.js is loaded dynamically (import('hls.js')) — never as a static import, to keep the component bundle small.
Analytics beacon uses navigator.sendBeacon only — never fetch for event reporting. Fire and forget.
Generate `sessionId` once per mount (`crypto.randomUUID()`) and include it on every event.
Emit `heartbeat` while playing: one beacon per 5-second bucket (`eventData.bucket = floor(currentTime/5)*5`), deduped per session.
Public popularity data comes from `GET /api/v1/videos/[id]/meta` (`popularityCurve`, normalized 0–100). Private retention + AI friction use authenticated `GET /api/videos/[id]/analytics` only.
Motion effects are defined in apps/component/src/effects/variants.ts as a Record<EffectName, MotionVariants> map. Add new effects there only.
Property control order in addPropertyControls must match the visual grouping in the PRD: VIDEO → APPEARANCE → MOTION EFFECT → INTERACTION → ANALYTICS.

Styling

Tailwind CSS only in apps/dashboard. No CSS modules, no styled-components, no inline style objects except where Tailwind can't reach (dynamic values, Framer component).
Follow the design token convention: use semantic class names (text-primary, bg-surface) over raw color classes (text-zinc-900) where tokens exist.
The dashboard must look like a Framer product — minimal, high contrast, generous whitespace. Refer to existing components before creating new UI patterns.

API Routes

All API routes validate request body with Zod before doing anything else.
Dashboard API routes authenticate via custom JWT session cookie (`app/lib/auth.ts`) and workspace access helpers. Public routes: meta (CORS), events beacon, v1 aliases.
Return consistent shapes: { data: T } on success, { error: string, code: string } on failure.
Never return 200 with an error body. Use appropriate HTTP status codes.
Rate limiting is applied at the middleware level for public endpoints (video metadata fetch, analytics beacon).

Worker (apps/worker)

All FFmpeg commands are wrapped in a typed runFFmpeg(args: string[]): Promise<void> helper that handles logging and error propagation.
Never shell-escape user input directly into FFmpeg commands. Use the args array pattern only.
Every job must update the video status in Postgres at the start (processing) and on completion (ready) or failure (error).
Failed jobs retry 3 times with exponential backoff via BullMQ config. After 3 failures, video status is set to error and the original raw file is preserved in R2 for manual inspection.

Analytics and heartbeat (see SYSTEMDESIGN.md §4.5)

Single ingestion path: `POST /api/v1/events` → `video_events`. No second tracker in the Framer component.
Event types include `heartbeat` (5s buckets), `video_play`, `video_pause`, `video_progress`, form/CTA events.
`GET .../meta`: may include aggregated `popularityCurve` (normalized counts) — keep queries aggregated, optional short cache.
`GET .../analytics`: workspace-authenticated; retention % per bucket, cliff detection, OpenAI friction copy cached in `aiInsights`.
AI friction transcript segments come from Deepgram utterances stored at `{workspaceId}/{videoId}/captions/transcript.json` after webhook M2.
Do not block `video.status = ready` on AI completion; captions and insights arrive asynchronously.


4. Boundaries
Always do

Run pnpm typecheck before marking any task complete
Run pnpm lint before marking any task complete
Run the relevant test suite before marking any task complete (pnpm --filter <app> test)
Add Zod validation to any new API route that accepts a request body
Handle the canvas vs published mode split in any new Framer component code
Update packages/types when adding new shared data shapes
Use pnpm --filter to scope commands to the affected app — never run global builds for single-app changes
Write error states for every loading UI — never leave a component that can fail without an error boundary or fallback

Ask first

Any change to the Drizzle schema in packages/db/schema.ts — migrations affect production data
Adding a new npm dependency to apps/component — bundle size is critical for the Framer Marketplace component, every KB matters
Changing the R2 bucket key structure — existing stored videos will have broken URLs
Changing the ClickHouse event schema — existing analytics data will not backfill
Modifying the addPropertyControls shape in the Framer component — breaking changes affect every designer already using the component
Changing any public API response shape — the Framer component calls these endpoints cold
Any change to the BullMQ job schema — in-flight jobs during a deploy could break

Never do

Push directly to main — all changes go through PRs
Hardcode any API keys, secrets, or credentials anywhere in the codebase
Write unaggregated heartbeat queries in hot paths without indexes — add `(video_id, event_type)` index if missing
Run FFmpeg with unsanitized user input
Remove the RenderTarget canvas check from the Framer component
Call git add -A or stage files outside the scope of the current task
Delete files from Cloudflare R2 without a soft-delete flag set in Postgres first — storage is considered recoverable until explicitly purged
Import hls.js as a static top-level import in apps/component
Add console.log statements in production code — use the structured logger in packages/config/logger.ts


5. Testing
Test locations

apps/dashboard: __tests__/ colocated with the files they test, or app/**/*.test.ts for route handlers
apps/component: src/**/*.test.tsx — component rendering and property control tests
apps/worker: src/**/*.test.ts — FFmpeg pipeline unit tests with mocked R2 and Postgres

What to test

All Zod schemas — valid inputs pass, invalid inputs throw with the right error shape
All API route handlers — mock Clerk auth, test success and failure branches
Framer component — renders poster in canvas mode, renders player in published mode, all property controls change the correct props
Worker processor — FFmpeg is called with the correct args for each resolution, status updates are written to Postgres

What not to test

Tailwind class names
Third-party library internals (hls.js, BullMQ, Drizzle)
Static configuration files

Test commands
bashpnpm test                          # all tests
pnpm --filter dashboard test       # dashboard only
pnpm --filter component test       # component only
pnpm --filter worker test          # worker only
pnpm test -- --coverage            # with coverage report

6. Framer Component — Special Rules
The apps/component app has stricter constraints than the rest of the codebase because it ships directly to Framer's Marketplace and runs inside other people's Framer projects.

Bundle size budget: 80KB gzipped. Run pnpm --filter component build and check the output. If the bundle exceeds 80KB, do not ship — find what grew and fix it first.
No external CSS imports. The component renders inside Framer's DOM. External stylesheets will conflict with Framer's styling engine. All styles are inline or CSS-in-JS using Framer Motion's style prop.
No localStorage or sessionStorage. Framer's sandboxed environment does not guarantee access to browser storage. Use component state only.
No document or window access at the top level. These are undefined during Framer's server-side rendering pass. Always access them inside useEffect or behind typeof window !== 'undefined' guards.
hls.js dynamic import pattern:

typescript  useEffect(() => {
    import('hls.js').then(({ default: Hls }) => {
      if (!Hls.isSupported()) return
      // initialize player
    })
  }, [videoMeta])

Analytics beacon pattern — always use sendBeacon:

typescript  const trackEvent = (eventType: string, progressPct = 0) => {
    if (typeof navigator === 'undefined') return
    navigator.sendBeacon(
      'https://api.framevid.co/v1/events',
      JSON.stringify({ videoId, eventType, progressPct, trackingLabel })
    )
  }

Canvas fallback pattern — always implement:

typescript  import { RenderTarget } from 'framer'

  if (RenderTarget.current() === RenderTarget.canvas) {
    return <CanvasPoster videoId={videoId} aspectRatio={aspectRatio} />
  }

7. Transcoding Pipeline — Special Rules
The apps/worker app runs FFmpeg on real video files. These rules prevent data loss and security issues.

Never construct FFmpeg args from string interpolation. Always use the args array:

typescript  // WRONG
  exec(`ffmpeg -i ${inputPath} -vf scale=-2:${height} ${outputPath}`)

  // RIGHT
  await runFFmpeg(['-i', inputPath, '-vf', `scale=-2:${height}`, outputPath])

R2 key naming convention — never deviate:

  /{workspaceId}/{videoId}/raw/{originalFilename}
  /{workspaceId}/{videoId}/transcoded/360p.m3u8
  /{workspaceId}/{videoId}/transcoded/360p/seg000.ts
  /{workspaceId}/{videoId}/transcoded/720p.m3u8
  /{workspaceId}/{videoId}/transcoded/720p/seg000.ts
  /{workspaceId}/{videoId}/transcoded/1080p.m3u8
  /{workspaceId}/{videoId}/transcoded/1080p/seg000.ts
  /{workspaceId}/{videoId}/transcoded/master.m3u8
  /{workspaceId}/{videoId}/thumbnails/thumb_0.jpg
  /{workspaceId}/{videoId}/thumbnails/thumb_1.jpg
  /{workspaceId}/{videoId}/thumbnails/thumb_2.jpg
  /{workspaceId}/{videoId}/captions/en.srt

Status transitions — the only valid flow:

  uploading → processing → ready
  uploading → processing → error
Never set status to ready without confirming the master manifest exists in R2.

Disk cleanup is mandatory. The worker downloads raw files to /tmp. Always delete /tmp/{videoId}/ in a finally block — even if transcoding fails. Fly.io disk is limited.


8. Common Patterns & Examples
Adding a new API route (dashboard)
typescript// apps/dashboard/app/api/videos/[videoId]/route.ts
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@framevid/db'
import { videos } from '@framevid/db/schema'

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  settings: z.object({ loop: z.boolean() }).partial().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { videoId: string } }
) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message, code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  // business logic here

  return NextResponse.json({ data: updatedVideo })
}
Adding a new motion effect (component)
typescript// apps/component/src/effects/variants.ts
import type { Variants } from 'framer-motion'

export type EffectName =
  | 'none'
  | 'fade-in'
  | 'scroll-reveal'
  | 'parallax'
  | 'blur-in'
  | 'cinematic'
  | 'hover-play'
  | 'viewport-trigger'
  | 'your-new-effect'  // add here first

export const motionVariants: Record<EffectName, Variants> = {
  'none': {},
  'fade-in': {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
  },
  // ... existing effects ...
  'your-new-effect': {
    initial: { /* define initial state */ },
    animate: { /* define animated state */ },
  },
}
Then add the new option to addPropertyControls in FrameVidPlayer.tsx — the motionEffect enum options array.
Adding a new Drizzle table
typescript// packages/db/schema.ts
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const yourNewTable = pgTable('your_new_table', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
Then run pnpm --filter @framevid/db db:generate to generate the migration, review it, then db:migrate to apply.

9. Deployment

Dashboard — deploys automatically to Vercel on merge to main. Preview deployments on every PR.
Worker — deploys manually via fly deploy from apps/worker/. Never auto-deploy the worker — FFmpeg jobs in flight during a deploy can corrupt video files.
Framer Component — manual release only. Build with pnpm --filter component build, verify bundle size, upload to Framer Developer portal. Tag the release in git: component/v1.x.x.
Database migrations — run manually against production after deploying the dashboard. Never auto-migrate on deploy.


10. What This Project Is Not
To avoid scope creep — things that are explicitly out of scope for FrameVid:

Not a live streaming platform. VOD (video on demand) only. No RTMP, no WebRTC, no live HLS streams.
Not a video editor. No trimming, cutting, or effects applied to source video. Transcoding only.
Not a CDN replacement. Cloudflare R2 + CDN handles delivery. Do not build caching logic into the worker or API.
Not a general purpose video platform. Every feature decision is filtered through "does this help Framer designers specifically?" If it doesn't, it doesn't ship.
Not a Webflow tool. The Framer component uses Framer-specific APIs (addPropertyControls, RenderTarget, Framer Motion). Do not generalize it for other platforms.