export {
  findMonorepoRoot,
  resolveLocalUploadDir,
  localUploadPath,
} from '@framevid/db';

export function isDiskStorageMode(): boolean {
  return !process.env.CLOUDFLARE_R2_ACCOUNT_ID;
}
