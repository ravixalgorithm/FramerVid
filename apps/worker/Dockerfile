# FrameVid transcoding worker — FFmpeg + BullMQ (deploy to Fly.io)
FROM node:20-bookworm-slim AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.8.1 --activate

WORKDIR /app

# Install dependencies (workspace-aware)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/db/package.json ./packages/db/
COPY packages/queue/package.json ./packages/queue/
COPY apps/worker/package.json ./apps/worker/

RUN pnpm install --frozen-lockfile

COPY packages ./packages
COPY apps/worker ./apps/worker

RUN pnpm --filter @framevid/types build \
  && pnpm --filter @framevid/db build \
  && pnpm --filter @framevid/queue build \
  && pnpm --filter @framevid/worker build

WORKDIR /app/apps/worker
ENV NODE_ENV=production

CMD ["node", "dist/processor.js"]
