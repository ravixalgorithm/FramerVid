# FrameVid — Build Journey

## Session: Team Invites & Role-Based Access Control (RBAC)

In this session, we built the foundation for multiplayer workspaces, allowing teams to collaborate securely on video content.

### 1. Database & Migrations
- Added the `workspace_invites` table to the `@framevid/db` schema (Drizzle).
- Ran local PostgreSQL migrations to support invite tokens with expiration dates.

### 2. Backend Security & RBAC
- Updated the core `assertWorkspaceAccess` helper to accept specific roles.
- Enforced strict role checks across API routes:
  - **Uploads, Deletions, and Edits:** Restricted to `admin` and `editor` roles.
  - **Team Settings & Invites:** Restricted exclusively to `admin` role.
  - **General Listing:** Allowed for `viewer` role.

### 3. API Infrastructure
- `POST /api/workspaces/[workspaceId]/invites`: Generate secure, 32-byte hexadecimal tokens for inviting new members.
- `GET /api/workspaces/[workspaceId]/invites`: Fetch pending invitations.
- `DELETE /api/workspaces/[workspaceId]/invites/[inviteId]`: Revoke a pending invitation.
- `GET /api/invites/[token]`: Public route to securely fetch details of a pending invite.
- `POST /api/invites/[token]`: Consume the token and add the authenticated user to the workspace.

### 4. Dashboard UI
- **Team Settings Page** (`/settings/team`): Built the `TeamSettingsClient` allowing admins to view current members, revoke pending invites, and dispatch new invites with granular role selection (Admin/Editor/Viewer).
- **Public Invite Acceptance Flow** (`/invite/[token]`): Built a standalone acceptance page. Designed to automatically redirect unauthenticated users to `/signup` with a redirect query parameter so they are placed back into the invite flow upon account creation.

### 5. Polish and Bug Fixes
- Addressed pervasive TypeScript errors ensuring clean strict mode compilation (`pnpm typecheck`).
- Fixed deeply nested module path resolutions for shared UI components and server-side auth utilities.

***

*(Note: We deliberately paused work on the Framer Component refactor and motion effect polish to focus on core backend functionality. They remain on the backlog for a future session.)*

---

## Session: Player Customization & Analytics UX (June 3, 2025)

A deep session focused on making the video player feel truly premium — adding viewer-facing analytics, richer branding controls, and polished interactive UI elements.

### 1. Custom Branding (Logo Watermark)
- Removed the old FrameVid watermark entirely.
- Added a **Custom Branding** toggle to the dashboard Player tab.
- Users can now upload their own logo and configure:
  - **Size slider** (20px–200px)
  - **Corner position** selector (top-left, top-right, bottom-left, bottom-right)
- Branding renders as a floating overlay on both the dashboard live preview and the published `FrameVidPlayer` component.
- Settings persisted via `VideoSettings` (`brandingEnabled`, `brandingLogoUrl`, `brandingSize`, `brandingPosition`).

### 2. Keyboard Shortcuts
- Implemented keyboard controls in `FrameVidPlayer.tsx`:
  - **Space / K** — Play/Pause
  - **← / J** — Seek back 5s/10s
  - **→ / L** — Seek forward 5s/10s
  - **F** — Toggle fullscreen
  - **M** — Toggle mute
  - **↑ / ↓** — Volume up/down
- Added a **toggle switch** in the dashboard Player tab to enable/disable keyboard shortcuts per video.
- Shortcuts are gated behind `videoMeta.settings.keyboardShortcuts`.

### 3. Exit Thumbnail
- Added `showExitThumbnail` field to `VideoSettings`.
- When enabled, the video's poster/thumbnail image is displayed as a full overlay whenever the video is **paused**.
- Overlay clears automatically when the user resumes playback.
- Toggle added to the **Thumbnail** tab in the dashboard.

### 4. Popularity Graph (Most Replayed)
- Wired up the existing backend analytics (`normalizePopularityCurve`, `getHeartbeatBucketCounts`) to render a **YouTube-style "Most Replayed" heatmap** above the progress bar.
- **Smooth Bézier curves** — replaced jagged linear paths with cubic Bézier interpolation for an organic, premium feel.
- **Subtle styling** — semi-transparent white gradient fill (`0.25 → 0.0` opacity) with a soft stroke (`0.4` opacity), so it hints at data without being visually loud.
- **Hover-only visibility** — the graph fades in smoothly (`opacity 0 → 1`, 300ms transition) only when the user hovers the control bar. Keeps the player clean during normal playback.
- **Mock data fallback** — for videos with no analytics yet, a randomized curve renders so the feature is immediately visible in the editor/preview.
- Implemented in both `FrameVidPlayer.tsx` (published player) and `VideoDetailsClient.tsx` (dashboard live preview).

### 5. Custom Progress Bar (Scrubber)
- Replaced the native browser `<input type="range">` scrubber with a fully custom-built progress bar:
  - **Solid filled track** — the watched portion fills with the user's primary accent color.
  - **Dim background track** — remaining portion rendered as `white/20`.
  - **Hover-reveal thumb** — the circular dot only appears on hover; track thickens from 3px → 5px on hover for a premium interactive feel.
  - **Click-to-seek** — clicking anywhere on the track jumps playback to that position.

### Files Modified
- `packages/types/src/index.ts` — Added `brandingEnabled`, `brandingSize`, `keyboardShortcuts`, `showExitThumbnail` to `VideoSettings`.
- `apps/component/src/FrameVidPlayer.tsx` — Exit thumbnail overlay, keyboard shortcuts hook, popularity graph SVG, branding logo overlay.
- `apps/dashboard/app/videos/[videoId]/VideoDetailsClient.tsx` — Branding UI, keyboard shortcut toggle, exit thumbnail toggle, popularity graph in live preview, custom scrubber.

***

## Session: AI Workflows & Caption Editor (June 3, 2025)

In this session, we vastly improved the AI features and built a robust Caption Editor into the dashboard to give creators full control over AI-generated subtitles.

### 1. Robust AI Caption Editor
- **VTT Parsing & Serialization**: Built a custom browser-side `.vtt` parser that isolates spoken text blocks from their timestamp headers (`00:00:00 --> 00:00:05`). This allows users to safely correct spelling mistakes without accidentally breaking the WebVTT file structure.
- **Edge-case Handling**: Fixed bugs related to CRLF (`\r\n`) line endings from Deepgram and built a graceful fallback state ("No editable speech found") for silent videos.
- **Seamless Integration**: Wired the "Save Edits" button to reconstruct the `.vtt` file in memory and pipe it directly through the existing `POST /api/videos/[videoId]/captions` upload endpoint, instantly updating the CDN and live preview.

### 2. Upgraded AI Integrations
- **Multilingual Captions**: Added `detect_language: 'true'` to the Deepgram `nova-2` configuration, allowing the AI to automatically identify and generate captions in dozens of non-English languages without requiring user input.
- **Friction Analysis Fix**: Updated the Groq API integration from the decommissioned `llama3-8b-8192` model to `llama-3.1-8b-instant`.
- **Database Cache Purge**: Wrote and executed a script to clear stale `aiInsights` from the database so the new Llama 3.1 model could successfully regenerate insights for videos that previously cached a failure state.

### 3. UI Polling Fixes
- **Webhook Polling**: Fixed a bug where regenerating captions for a video that already had them would instantly stop the loading spinner. Updated the polling logic in `VideoDetailsClient.tsx` to strictly check for changes to the database `updatedAt` timestamp (exposed via the `/meta` API route) to ensure the UI waits for the background webhook to fully finish.

***

*(Next up: Resend Email Integration for real transactional invite emails, replacing the current mock logging.)*

---

## Session: Railway deploy prep (disk storage, no R2)

Prepared production-style hosting on Railway without Cloudflare R2:

- **Disk mode** — When `CLOUDFLARE_R2_ACCOUNT_ID` is unset, `resolveMediaUrl` rewrites `cdn.framevid.co` URLs to `/api/media/...` on any host (not only localhost).
- **HLS playlists** — `.m3u8` responses rewrite relative segment paths for the path-based media API.
- **Storage paths** — `LOCAL_UPLOAD_DIR` (e.g. `/.data/uploads` on Railway) is the single source of truth for dashboard + worker.
- **Deploy scripts** — `pnpm railway:start` (schema push + Next.js), `pnpm railway:worker:start`, root `nixpacks.toml` with FFmpeg.

See [RAILWAY_DEPLOY.md](./RAILWAY_DEPLOY.md) for step-by-step Railway setup (Postgres, Redis, two app services, shared volume).
