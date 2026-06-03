# FrameVid — Build Status

Last updated: 2026-06-02 (password protection shipped)

Legend: `[x]` done · `[~]` partial · `[ ]` not started

**Overall:** Phase 1 ~85% · Phase 2 ~60% · Phase 3 ~50% · Phase 4 ~55% · Phase 5 ~0%

**Engagement analytics plan (M5–M7):** complete — heartbeat → meta popularity curve → dashboard retention + AI friction; Deepgram M1–M2 wired in worker + webhook.

---

## Phase 1 — Foundation (Weeks 1–3)

| Item | Status | Notes |
|------|--------|-------|
| Monorepo (pnpm + turbo) | [x] | `apps/dashboard`, `component`, `worker`, `packages/*` |
| Postgres schema (Drizzle) | [x] | users, workspaces, videos, folders, video_events |
| Custom JWT auth (signup/signin) | [x] | Replaces Clerk from PRD |
| Presigned R2 upload API | [x] | `POST /api/videos/upload` |
| Upload complete → queue transcode | [x] | `POST /api/videos/upload/complete` |
| Mock upload (local dev) | [x] | Saves to `LOCAL_UPLOAD_DIR`, queues job |
| BullMQ + Redis queue | [x] | `@framevid/queue` shared package |
| Worker FFmpeg HLS (360/720/1080) | [x] | Real path + dev simulate when no FFmpeg |
| Worker download raw from R2 | [x] | `apps/worker/src/r2.ts` |
| Worker upload all HLS segments | [x] | Recursive directory upload to R2 |
| Local raw file fallback (no R2) | [x] | `LOCAL_UPLOAD_DIR` for dev |
| R2 webhook (auto queue) | [ ] | Optional; using client `complete` for now |
| Fly.io deploy config | [x] | `Dockerfile.worker`, `fly.worker.toml` |
| Vercel deploy config | [x] | `apps/dashboard/vercel.json`, `next.config.mjs` |
| Production SQL migration | [x] | `0000_init.sql`; run `0001_analytics_ai.sql` for `ai_insights` + `audio_extracted` |
| Deploy guide | [x] | `DEPLOY.md` |
| Railway deploy (disk, no R2) | [x] | `RAILWAY_DEPLOY.md`, shared volume `/.data` |
| CI (GitHub Actions) | [x] | `.github/workflows/ci.yml` |
| Health check endpoint | [x] | `GET /api/health` |
| README / local setup guide | [x] | See `README.md` |

**Phase 1 deliverable:** Upload → transcode → HLS URL in DB — **[~] works locally with mock + simulate; production needs R2 + FFmpeg + Redis**

---

## Phase 2 — Framer Component (Weeks 4–5)

| Item | Status | Notes |
|------|--------|-------|
| FrameVidPlayer + canvas poster | [x] | `RenderTarget.canvas` guard |
| HLS.js dynamic import | [x] | |
| Property controls (video, appearance, motion) | [x] | Large single file |
| Configurable API base URL | [x] | Prop + `NEXT_PUBLIC_FRAMERVID_API_URL` |
| `/api/v1/*` routes (meta, events) | [x] | Aliases for component |
| Motion effects (8 types) | [~] | Variants defined; parallax/hover/viewport imperative |
| Analytics sendBeacon | [x] | `sessionId` + `heartbeat` every 5s; `POST /api/v1/events` |
| Popularity waveform (hover) | [x] | `popularityCurve` from meta; SVG overlay |
| Lightbox | [~] | In component; needs QA |
| Custom controls module split | [ ] | Still monolithic |
| Framer Marketplace publish | [ ] | Manual release |
| Bundle ≤ 80KB gzipped | [ ] | Not measured in CI |

---

## Phase 3 — Dashboard Polish (Weeks 6–7)

| Item | Status | Notes |
|------|--------|-------|
| Video library grid/list + search | [x] | `VideoDashboardClient` |
| Framer-style UI (Inter, violet accent, auth shell) | [x] | `globals.css`, `Logo`, `AuthShell`, dashboard + detail pages |
| Upload progress UI | [x] | |
| Video detail / settings UI | [x] | Large `VideoDetailsClient` |
| Folders API | [x] | `GET/POST /api/folders` |
| Folders UI wired to API | [x] | Replaces client-only mock |
| Workspace switcher / multi-workspace | [x] | `WorkspaceSwitcher` + `/api/workspaces` + cookie |
| Team invites + RBAC | [x] | Full end-to-end flow built |
| Player customization persisted | [x] | PATCH video settings |
| Plan limits enforcement | [~] | `plan-limits.ts`; enforced on upload + UI hints |
| Usage stats (storage/bandwidth) | [ ] | Fields in schema, no metering |

---

## Phase 4 — Advanced (Weeks 8–10)

| Item | Status | Notes |
|------|--------|-------|
| Analytics dashboard (drop-off, devices) | [x] | Retention + friction + device/referrer breakdown on analytics tab |
| ClickHouse events | [ ] | Postgres `video_events` used |
| Manual captions upload (.vtt/.srt) | [x] | `POST .../captions`; dashboard VTT overlay |
| Heartbeat events (5s buckets) | [x] | `heartbeat` + `sessionId` on player beacon |
| Popularity graph on player (meta + SVG) | [x] | `popularityCurve` on meta; hover waveform |
| Retention heatmap (dashboard) | [x] | Recharts area chart on analytics tab |
| AI drop-off friction analysis | [x] | Cliff detect + `gpt-4o-mini`; cached in `ai_insights.friction` |
| AI captions + insights (Deepgram + OpenAI) | [x] | Worker: `audio.mp3` → Deepgram → webhook → VTT + `transcript.json` |
| Password-protected / signed URLs | [x] | Implemented across API proxy, UI, and player component |
| Upload via URL (YouTube/Vimeo) | [x] | Import modal + youtube-dl-exec worker pipeline |
| All 8 motion effects polished | [~] | |
| CTA + lead forms in player | [~] | Beyond PRD scope; UI exists |

---

## Phase 5 — Platform Integration (Weeks 11–12)

| Item | Status | Notes |
|------|--------|-------|
| FrameStack analytics integration | [ ] | |
| Agency white-label | [ ] | |
| Public API docs | [ ] | |

---

## Infrastructure & Quality

| Item | Status | Notes |
|------|--------|-------|
| `.env.example` | [x] | |
| Unit / integration tests | [ ] | |
| `pnpm typecheck` clean | [x] | dashboard, component, db, types (worker `tsc` has known Drizzle dup issue) |
| CI (GitHub Actions) | [x] | typecheck + dashboard build |
| Production deploy (live) | [~] | Dashboard on Vercel — add `DATABASE_URL`, `REDIS_URL`, R2; run `0001` migration; Fly worker pending |
| Resend email | [ ] | |
| Stripe / billing | [ ] | |

---

## Next up (recommended order)

1. **Ops:** Run `packages/db/drizzle/0001_analytics_ai.sql` on production Postgres.
2. **Env:** `DEEPGRAM_API_KEY`, `DASHBOARD_WEBHOOK_URL` (or `NEXT_PUBLIC_API_URL`), `OPENAI_API_KEY` for friction copy.
3. **Verify:** Play video on published page → `heartbeat` rows → meta `popularityCurve` → Analytics tab retention chart.
4. **Build:** Polishing all 8 motion effects.

---

## How to update this file

When you finish a task, change `[ ]` → `[x]` and add a short note. Use `[~]` when partially done. Bump **Last updated** and **Overall** percentages.
