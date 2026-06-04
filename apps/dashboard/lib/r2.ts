import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

function isR2Configured(): boolean {
  return Boolean(process.env.CLOUDFLARE_R2_ACCOUNT_ID);
}

let _r2: S3Client | null = null;
function getR2(): S3Client {
  if (!_r2) {
    _r2 = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
      },
      forcePathStyle: true,
    });
  }
  return _r2;
}

const BUCKET = () => process.env.CLOUDFLARE_R2_BUCKET_NAME || 'framevid-assets';

/**
 * Upload a text or binary payload to R2 if configured.
 * Returns true if uploaded to R2, false if R2 is not configured (caller should fall back to local disk).
 */
export async function uploadToR2(
  key: string,
  body: string | Buffer,
  contentType: string = 'application/octet-stream',
): Promise<boolean> {
  if (!isR2Configured()) return false;

  await getR2().send(
    new PutObjectCommand({
      Bucket: BUCKET(),
      Key: key,
      Body: typeof body === 'string' ? Buffer.from(body, 'utf8') : body,
      ContentType: contentType,
    }),
  );
  return true;
}

/**
 * Delete a single object from R2.
 */
export async function deleteFromR2(key: string): Promise<boolean> {
  if (!isR2Configured()) return false;

  await getR2().send(
    new DeleteObjectCommand({
      Bucket: BUCKET(),
      Key: key,
    }),
  );
  return true;
}

export { isR2Configured };
