import path from 'path';

/** Local disk storage for dev uploads when R2 is not configured. */
export function localUploadPath(rawKey: string): string {
  const base =
    process.env.LOCAL_UPLOAD_DIR || path.join(process.cwd(), '.data', 'uploads');
  return path.join(base, rawKey);
}
