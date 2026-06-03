# Railway Deployment Guide (No R2 Required)

Deploy the full FrameVid stack (Dashboard + Worker + Postgres + Redis) on [Railway](https://railway.app) using a **shared persistent volume** for video files. No Cloudflare R2 or card required.

For what is already built in this repo, see [JOURNEY.md](./JOURNEY.md) (team RBAC, player branding, analytics, AI captions, etc.) and [status.md](./status.md) (phase checklist).

---

## Architecture on Railway

| Service | Role |
|---------|------|
| **PostgreSQL** | Users, workspaces, videos, invites, analytics |
| **Redis** | BullMQ transcode + import queues |
| **Dashboard** (Next.js) | UI, upload API, `/api/media/*` file serving |
| **Worker** | FFmpeg HLS transcode, writes to same disk as dashboard |

When `CLOUDFLARE_R2_ACCOUNT_ID` is **unset**, the app runs in **disk mode**: uploads and HLS segments are stored under `LOCAL_UPLOAD_DIR` (default `/.data/uploads` on Railway). CDN-style URLs (`https://cdn.framevid.co/...`) are rewritten to your dashboard origin via `/api/media/...`.

---

## 1. Push code to GitHub

```bash
git add .
git commit -m "Railway disk-mode deploy"
git push origin main
```

`.data/` is gitignored — local test videos stay on your machine.

---

## 2. Create the Railway project

1. Log in at [railway.app](https://railway.app) with GitHub.
2. **New Project** → **Provision PostgreSQL**.
3. **New** → **Database** → **Provision Redis**.

---

## 3. Deploy the Dashboard (Next.js)

1. **New** → **GitHub Repo** → select `FramerVid`.
2. Open the service → **Settings**:
   - **Root Directory:** leave empty (repo root).
   - **Build Command:** `pnpm railway:build` (or `pnpm build` if component build is fixed)
   - **Start Command:** `pnpm railway:start`  
     (runs `drizzle-kit push` then `next start`; Next.js uses Railway’s `PORT` automatically.)
3. **Variables:**

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` |
| `JWT_SECRET` | Random 32+ character string |
| `AUTH_COOKIE_NAME` | `framevid_session` |
| `LOCAL_UPLOAD_DIR` | `/.data/uploads` |
| `NODE_ENV` | `production` |

Do **not** set any `CLOUDFLARE_R2_*` variables.

4. **Volumes** → **Create Volume** → mount path: `/.data`

5. **Networking** → **Generate Domain** → copy the `https://….up.railway.app` URL.

6. Add variable: `NEXT_PUBLIC_API_URL` = that URL (no trailing slash).

Optional (features still work without them):

| Variable | Purpose |
|----------|---------|
| `DEEPGRAM_API_KEY` | Auto captions after transcode |
| `GROQ_API_KEY` | AI friction insights |
| `OPENAI_API_KEY` | Alternative friction analysis |

---

## 4. Deploy the Worker (FFmpeg)

1. **New** → **GitHub Repo** → same `FramerVid` repo (second service).
2. **Settings**:
   - **Root Directory:** empty (repo root).
   - **Build Command:** `pnpm railway:build`
   - **Start Command:** `pnpm railway:worker:start` (runs worker via `tsx`, includes FFmpeg from `nixpacks.toml`)
3. **Variables:**

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` |
| `LOCAL_UPLOAD_DIR` | `/.data/uploads` |

4. **Volumes** → **Connect Volume** → same volume as dashboard → mount path: `/.data`

The root `nixpacks.toml` installs **FFmpeg** for this service.

---

## 5. Verify

1. Open your Railway dashboard URL → sign up / sign in.
2. Upload a video → status should move `uploading` → `processing` → `ready`.
3. Open the video page → **Live Preview** should play HLS (not only title/metadata).
4. Check worker logs for: `[R2 Simulator] Saved ... → /.data/uploads/...`

**Health:** `GET https://your-app.up.railway.app/api/health`

---

## 6. Framer component (published sites)

In Framer, set the player **API Base URL** to:

```text
https://your-app.up.railway.app/api/v1
```

(Use your real `NEXT_PUBLIC_API_URL` + `/api/v1`.)

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Only title shows, no video | Re-upload after deploy; confirm volume mounted on **both** services and `LOCAL_UPLOAD_DIR=/.data/uploads`. |
| Upload works, never becomes `ready` | Worker not running, Redis URL wrong, or FFmpeg missing — check worker deploy logs. |
| `column does not exist` | `pnpm railway:start` runs `db:push`; redeploy dashboard or run `pnpm --filter @framevid/db db:push` locally against prod `DATABASE_URL`. |
| 404 on `/api/media/...` | Dashboard and worker must share the **same** volume at `/.data`. |

---

## What you are *not* deploying yet

Per [JOURNEY.md](./JOURNEY.md) / [status.md](./status.md): Resend invite emails, ClickHouse analytics, production R2 CDN, and Fly.io worker are still optional / backlog. This Railway setup is intended as a **no-R2 staging or demo** environment.
