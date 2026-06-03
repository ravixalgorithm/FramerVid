# Deploy FrameVid to Production

## Current production (dashboard)

| Item | Value |
|------|--------|
| **GitHub** | https://github.com/ravixalgorithm/FramerVid |
| **Vercel production URL** | https://dashboard-alpha-kohl-78.vercel.app |
| **Health check** | https://dashboard-alpha-kohl-78.vercel.app/api/health |
| **Framer API base** | `https://dashboard-alpha-kohl-78.vercel.app/api/v1` |

Vercel project: `ravixalgorithms-projects/dashboard` — **Root Directory:** `apps/dashboard` (required for monorepo).

**Still required for full `ok` health:** add in [Vercel → Project → Environment Variables](https://vercel.com/ravixalgorithms-projects/dashboard/settings/environment-variables):

- `DATABASE_URL` (Supabase/Neon Postgres)
- `REDIS_URL` (Upstash `rediss://...`)
- `CLOUDFLARE_R2_*` (all five vars from `.env.production.example`)

Then run `packages/db/drizzle/0000_init.sql` on the database and redeploy.

---

Production layout (from PRD):

| Service | Platform | Purpose |
|---------|----------|---------|
| Dashboard + API | **Vercel** | Next.js app (`apps/dashboard`) |
| Transcoding worker | **Render** (trial) or **Fly.io** | FFmpeg + BullMQ (`Dockerfile.worker`) |
| Database | **Supabase** (or Neon) | Postgres |
| Queue | **Upstash** | Redis for BullMQ |
| Video storage | **Cloudflare R2** | Raw + HLS + thumbnails |
| CDN | **Cloudflare** | Custom domain on R2 bucket → `cdn.framevid.co` |

---

## 1. Prerequisites

- [Cloudflare](https://dash.cloudflare.com) account (R2 + optional DNS)
- [Supabase](https://supabase.com) or [Neon](https://neon.tech) Postgres
- [Upstash](https://upstash.com) Redis
- [Vercel](https://vercel.com) account
- [Fly.io](https://fly.io) account
- [GitHub](https://github.com) repo for this project
- `ffmpeg` is bundled in the Fly Docker image (no install needed on Fly)

---

## 2. Database (Postgres)

1. Create a Postgres database (Supabase → Project Settings → Database → connection string).
2. Run the initial migration:

```bash
# Using psql
psql "$DATABASE_URL" -f packages/db/drizzle/0000_init.sql

# Or Supabase SQL editor — paste contents of packages/db/drizzle/0000_init.sql
```

3. Save `DATABASE_URL` for Vercel and Fly.

---

## 3. Redis (Upstash)

1. Create a Redis database on Upstash.
2. Copy the **TLS** URL (`rediss://...`) as `REDIS_URL`.

---

## 4. Cloudflare R2

1. Create bucket `framevid-assets` (or your name).
2. Create R2 API token with read/write on that bucket.
3. Enable public access via custom domain, e.g. `cdn.framevid.co`:
   - R2 → bucket → Settings → Custom Domains
4. CORS (allow browser uploads + HLS playback):

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

5. Set env vars:
   - `CLOUDFLARE_R2_ACCOUNT_ID`
   - `CLOUDFLARE_R2_ACCESS_KEY_ID`
   - `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
   - `CLOUDFLARE_R2_BUCKET_NAME`
   - `CLOUDFLARE_R2_PUBLIC_URL` = `https://cdn.framevid.co` (your CDN URL)

---

## 5. Deploy dashboard (Vercel)

### Option A — Vercel Dashboard (recommended first time)

1. Push code to GitHub.
2. [vercel.com/new](https://vercel.com/new) → Import repository.
3. **Root Directory:** `apps/dashboard`
4. Framework: Next.js (auto-detected).
5. **Environment variables** — add all from `.env.production.example`:
   - `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` (32+ chars), `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_FRAMERVID_API_URL`, all `CLOUDFLARE_R2_*`
6. Deploy.

After deploy, set:

- `NEXT_PUBLIC_API_URL` = `https://YOUR-PROJECT.vercel.app`
- `NEXT_PUBLIC_FRAMERVID_API_URL` = `https://YOUR-PROJECT.vercel.app/api/v1`

Redeploy once URLs are correct.

### Option B — CLI

```bash
pnpm install -g vercel
cd apps/dashboard
vercel link
vercel env pull .env.production.local   # or add vars in dashboard
vercel --prod
```

### Verify

```bash
curl https://YOUR-PROJECT.vercel.app/api/health
```

Expect `"status":"ok"` when database, redis, and jwt are configured.

---

## 6. Deploy worker (Fly.io)

Install Fly CLI: https://fly.io/docs/hands-on/install-flyctl/

From **repository root**:

```bash
fly auth login
fly apps create framevid-worker   # skip if name taken
fly secrets set \
  DATABASE_URL="postgresql://..." \
  REDIS_URL="rediss://..." \
  CLOUDFLARE_R2_ACCOUNT_ID="..." \
  CLOUDFLARE_R2_ACCESS_KEY_ID="..." \
  CLOUDFLARE_R2_SECRET_ACCESS_KEY="..." \
  CLOUDFLARE_R2_BUCKET_NAME="framevid-assets" \
  CLOUDFLARE_R2_PUBLIC_URL="https://cdn.framevid.co" \
  --app framevid-worker

fly deploy --config fly.worker.toml
```

The worker runs continuously and consumes the `video-transcode` BullMQ queue.

**Do not** set `LOCAL_UPLOAD_DIR` on Fly.

### Verify worker logs

```bash
fly logs --app framevid-worker
```

Upload a video in the dashboard → logs should show `[Worker] Started transcode job`.

> **Fly asks for a card?** Use **§6c** (Render background worker) for trial, **§6b** (Oracle VM), or add a card on Fly.

---

## 6c. Deploy worker on Render (good for trial → paid later)

**Recommended if you want online without Fly/Oracle.** Keep the dashboard on Vercel; only the worker runs on Render.

| Render plan | Behavior | Cost |
|-------------|----------|------|
| **Free** | Background worker stays up and polls Redis (does **not** spin down like free *web* services). ~750 instance-hours/month (~one worker 24/7). Occasional restarts; may suspend if you exceed free hours/bandwidth. | $0 |
| **Starter** | Always on, more RAM (better for FFmpeg), no monthly hour cap worry | ~$7/mo per worker |

Paid Render Starter is **enough** for this app (one worker, BullMQ, FFmpeg). You do not need Fly unless you want multi-region.

### 1. Create the worker service

**Option A — Blueprint (easiest)**

1. Push latest `master` to GitHub (includes `render.yaml` + fixed `Dockerfile.worker`).
2. [dashboard.render.com](https://dashboard.render.com) → **New +** → **Blueprint** → connect **FramerVid** repo.
3. Apply the blueprint → service `framevid-worker` is created.

**Option B — Manual**

1. **New +** → **Background Worker**
2. Connect GitHub repo **FramerVid**
3. **Runtime:** Docker
4. **Dockerfile path:** `Dockerfile.worker` (repo root)
5. **Plan:** Free (upgrade to Starter when transcodes OOM or you go prod)

### 2. Environment variables

In the worker service → **Environment**, add (same as `apps/worker/.env`):

| Variable | Required |
|----------|----------|
| `DATABASE_URL` | Yes |
| `REDIS_URL` | Yes (Upstash `rediss://...`) |
| `CLOUDFLARE_R2_ACCOUNT_ID` | Yes |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | Yes |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Yes |
| `CLOUDFLARE_R2_BUCKET_NAME` | Yes |
| `CLOUDFLARE_R2_PUBLIC_URL` | Yes (`https://pub-….r2.dev`) |
| `NODE_ENV` | `production` |

Do **not** set `LOCAL_UPLOAD_DIR`.

Optional later: `DEEPGRAM_API_KEY`, `GROQ_API_KEY`.

### 3. Deploy and verify

1. **Manual Deploy** (or auto-deploy on push).
2. **Logs** should show: `[Worker] Transcoding queue listener started.`
3. On Vercel → upload a short MP4 → logs: `[Worker] Started transcode job` → video **ready**.

### 4. Free tier limits (trial)

- **No idle sleep** for background workers (unlike free web services).
- **750 hours/month** total across free services — one worker ~24/7 fits.
- **512 MB RAM** on free — long 1080p transcodes may OOM → upgrade worker to **Starter**.
- Render may **restart** free services without notice (jobs retry via BullMQ).
- Card only needed if you exceed free bandwidth or choose paid plans.

### 5. Upgrade path

When ready: worker service → **Settings** → change plan **Free → Starter** (~$7/mo). No code changes.

---

## 6b. Deploy worker online for $0 (Oracle Cloud Always Free)

Use this when Fly/Railway need billing but you still want a **24/7** worker. Stack stays: **Vercel + Supabase + Upstash + R2** (all have free tiers).

### A. Create a free VM

1. [cloud.oracle.com](https://cloud.oracle.com) → sign up (verification may ask for a card; stay in **Always Free** resources only).
2. **Compute → Instances → Create instance**
   - Image: **Ubuntu 22.04**
   - Shape: **Ampere** → pick **Always Free-eligible** (e.g. 2 OCPU, 12 GB RAM if available in your region)
   - Add your SSH public key
3. Note the instance **public IP**.

### B. Install Docker on the VM

SSH from your PC (`ssh ubuntu@PUBLIC_IP`):

```bash
sudo apt-get update
sudo apt-get install -y docker.io git
sudo usermod -aG docker $USER
# log out and SSH back in so docker group applies
```

### C. Build and run the worker

On the VM:

```bash
git clone https://github.com/ravixalgorithm/FramerVid.git
cd FramerVid
```

Create `worker.prod.env` (no `LOCAL_UPLOAD_DIR`):

```bash
nano worker.prod.env
```

Paste the same values as `apps/worker/.env`: `DATABASE_URL`, `REDIS_URL`, all `CLOUDFLARE_R2_*`, `NODE_ENV=production`.

Build and start (from repo root):

```bash
sudo docker build -f Dockerfile.worker -t framevid-worker .
sudo docker run -d \
  --name framevid-worker \
  --restart unless-stopped \
  --env-file worker.prod.env \
  framevid-worker
```

Logs:

```bash
sudo docker logs -f framevid-worker
```

### D. Verify end-to-end

1. Vercel dashboard → upload a short MP4.
2. VM logs: `[Worker] Started transcode job` → `Completed job`.
3. Video status **ready**; playback uses your R2 `pub-….r2.dev` URL.

### Updates

```bash
cd FramerVid && git pull
sudo docker build -f Dockerfile.worker -t framevid-worker .
sudo docker stop framevid-worker && sudo docker rm framevid-worker
sudo docker run -d --name framevid-worker --restart unless-stopped --env-file worker.prod.env framevid-worker
```

---

## 7. Custom domain (optional)

### Vercel — `app.framevid.co`

Vercel project → Settings → Domains → add domain → follow DNS instructions.

Update env:

- `NEXT_PUBLIC_API_URL=https://app.framevid.co`
- `NEXT_PUBLIC_FRAMERVID_API_URL=https://app.framevid.co/api/v1`

### API subdomain

If you want `api.framevid.co` separate, point it to the same Vercel project or use Vercel rewrites. Simplest path: **single domain** serves both UI and `/api/v1/*`.

---

## 8. Framer component (production)

In Framer, set the component **API Base URL** property to:

```text
https://YOUR-PROJECT.vercel.app/api/v1
```

(or your custom domain + `/api/v1`)

---

## 9. GitHub Actions (optional CI)

See `.github/workflows/ci.yml` — runs typecheck on push/PR.

Deploy remains manual via Vercel/Fly dashboards or their Git integrations until you add deploy secrets.

---

## 10. Production checklist

- [ ] `JWT_SECRET` is random and ≥ 32 characters (not dev default)
- [ ] `DATABASE_URL` uses SSL (`?sslmode=require`)
- [ ] R2 CORS configured
- [ ] `NEXT_PUBLIC_FRAMERVID_API_URL` matches live domain
- [ ] Fly worker running (`fly status`)
- [ ] Health check OK (`/api/health`)
- [ ] Test upload → processing → ready → play HLS in dashboard
- [ ] Update [status.md](./status.md) deploy rows

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Upload stuck on uploading | Check `REDIS_URL`; worker must be running |
| Transcode always uses test stream | FFmpeg missing locally; on Fly, check logs for R2 download errors |
| CORS errors on API | Vercel `next.config.mjs` headers; meta/events routes set `Access-Control-Allow-Origin` |
| 401 on upload | Sign in again; `JWT_SECRET` must match across redeploys |
| HLS won't play | Confirm `CLOUDFLARE_R2_PUBLIC_URL` and segments uploaded under `transcoded/` |
