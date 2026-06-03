/** Remote HLS URL suitable for server-side ffmpeg frame grab. */
export function resolveRemoteHlsForFfmpeg(hlsManifestUrl?: string | null): string | null {
  if (!hlsManifestUrl) return null;
  if (!hlsManifestUrl.startsWith('http://') && !hlsManifestUrl.startsWith('https://')) {
    return null;
  }
  return hlsManifestUrl;
}
