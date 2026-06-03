const CDN_BASE =
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
  process.env.CLOUDFLARE_R2_PUBLIC_URL ||
  'https://cdn.framevid.co';

/** Serve mock CDN URLs via /api/media when R2 is not configured (local + Railway disk mode). */
function useLocalMediaProxy(): boolean {
  if (!process.env.CLOUDFLARE_R2_ACCOUNT_ID) return true;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
  }
  return process.env.NODE_ENV === 'development';
}

function apiBase(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
}

/** In local dev, map fake CDN URLs to files under LOCAL_UPLOAD_DIR. */
export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (!useLocalMediaProxy()) return url;

  const bases = [CDN_BASE.replace(/\/$/, ''), 'https://cdn.framevid.co'];

  for (const base of bases) {
    if (url.startsWith(`${base}/`)) {
      const key = url.slice(base.length + 1);
      return `${apiBase()}/api/media/${key}`;
    }
  }

  return url;
}

export function posterStorageKey(workspaceId: string, videoId: string) {
  return `${workspaceId}/${videoId}/poster.jpg`;
}

export function captionsStorageKey(workspaceId: string, videoId: string) {
  return `${workspaceId}/${videoId}/captions/captions.vtt`;
}

export function logoStorageKey(workspaceId: string, videoId: string, ext: string) {
  return `${workspaceId}/${videoId}/branding/logo${ext}`;
}

export function audioStorageKey(workspaceId: string, videoId: string) {
  return `${workspaceId}/${videoId}/audio.mp3`;
}

export function transcriptStorageKey(workspaceId: string, videoId: string) {
  return `${workspaceId}/${videoId}/captions/transcript.json`;
}
