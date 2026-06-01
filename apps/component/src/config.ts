/** Public API base used by the Framer player (include `/v1`). */
export const DEFAULT_API_BASE_URL = 'https://api.framevid.co/v1';

export function resolveApiBaseUrl(override?: string): string {
  const trimmed = override?.replace(/\/$/, '');
  if (trimmed) return trimmed;
  return DEFAULT_API_BASE_URL;
}
