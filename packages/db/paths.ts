import fs from 'fs';
import path from 'path';

/** Walk up from cwd until we find the monorepo root (pnpm-workspace.yaml). */
export function findMonorepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

/** Shared upload root for dashboard mock uploads and worker transcodes (default: `<repo>/.data/uploads`). */
export function resolveLocalUploadDir(): string {
  if (process.env.LOCAL_UPLOAD_DIR) {
    return path.resolve(process.env.LOCAL_UPLOAD_DIR);
  }
  return path.join(findMonorepoRoot(), '.data', 'uploads');
}

export function localUploadPath(rawKey: string): string {
  return path.join(resolveLocalUploadDir(), rawKey);
}
