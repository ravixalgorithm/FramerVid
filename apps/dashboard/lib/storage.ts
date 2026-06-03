import path from 'path';

/** Upload root: Railway volume `/.data/uploads` or monorepo `.data/uploads` in dev. */
export function resolveLocalUploadDir(): string {
  if (process.env.LOCAL_UPLOAD_DIR) {
    return path.resolve(process.env.LOCAL_UPLOAD_DIR);
  }
  return path.resolve(process.cwd(), '.data', 'uploads');
}

export function localUploadPath(rawKey: string): string {
  return path.join(resolveLocalUploadDir(), rawKey);
}

export function isDiskStorageMode(): boolean {
  return !process.env.CLOUDFLARE_R2_ACCOUNT_ID;
}
