# FrameVid — Build Status

Last updated: 2026-06-01 (production deploy configs added)

Legend: `[x]` done · `[~]` partial · `[ ]` not started

**Overall:** Phase 1 ~70% · Phase 2 ~55% · Phase 3 ~35% · Phase 4 ~10% · Phase 5 ~0%

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
| Production SQL migration | [x] | `packages/db/drizzle/0000_init.sql` |
| Deploy guide | [x] | `DEPLOY.md` |
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
| Analytics sendBeacon | [x] | Wired to dashboard events API |
| Lightbox | [~] | In component; needs QA |
| Custom controls module split | [ ] | Still monolithic |
| Framer Marketplace publish | [ ] | Manual release |
| Bundle ≤ 80KB gzipped | [ ] | Not measured in CI |

---

## Phase 3 — Dashboard Polish (Weeks 6–7)

| Item | Status | Notes |
|------|--------|-------|
| Video library grid/list + search | [x] | `VideoDashboardClient` |
| Upload progress UI | [x] | |
| Video detail / settings UI | [x] | Large `VideoDetailsClient` |
| Folders API | [x] | `GET/POST /api/folders` |
| Folders UI wired to API | [x] | Replaces client-only mock |
| Workspace switcher / multi-workspace | [ ] | Auto-creates one workspace |
| Team invites + RBAC | [ ] | Schema only |
| Player customization persisted | [x] | PATCH video settings |
| Plan limits enforcement | [ ] | Plan field only |
| Usage stats (storage/bandwidth) | [ ] | Fields in schema, no metering |

---

## Phase 4 — Advanced (Weeks 8–10)

| Item | Status | Notes |
|------|--------|-------|
| Analytics dashboard (drop-off, devices) | [~] | Basic; some mocked metrics |
| ClickHouse events | [ ] | Postgres `video_events` used |
| Whisper auto-captions | [ ] | |
| Password-protected / signed URLs | [ ] | Types only |
| Upload via URL (YouTube/Vimeo) | [ ] | |
| Chapters | [ ] | |
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
| `pnpm typecheck` clean | [~] | Run after changes |
| CI (GitHub Actions) | [x] | typecheck + dashboard build |
| Production deploy (live) | [ ] | Follow `DEPLOY.md` — Vercel + Fly + R2 + Supabase |
| Resend email | [ ] | |
| Stripe / billing | [ ] | |

---

## How to update this file

When you finish a task, change `[ ]` → `[x]` and add a short note. Use `[~]` when partially done. Bump **Last updated** and **Overall** percentages.
