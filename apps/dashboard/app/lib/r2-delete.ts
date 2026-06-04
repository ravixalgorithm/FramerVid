import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { localUploadPath } from '@framevid/db';
import fs from 'fs/promises';

export async function deleteVideoAssets(workspaceId: string, videoId: string) {
  if (process.env.CLOUDFLARE_R2_ACCOUNT_ID) {
    const r2 = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || 'mock',
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || 'mock',
      },
      forcePathStyle: true,
    });
    const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'framevid-assets';
    const prefix = `${workspaceId}/${videoId}/`;

    try {
      // Loop to handle pagination if more than 1000 objects (rare but safe)
      let isTruncated = true;
      let continuationToken: string | undefined = undefined;

      while (isTruncated) {
        const listed = await r2.send(
          new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          })
        );

        if (listed.Contents && listed.Contents.length > 0) {
          await r2.send(
            new DeleteObjectsCommand({
              Bucket: BUCKET_NAME,
              Delete: {
                Objects: listed.Contents.map((o) => ({ Key: o.Key })),
              },
            })
          );
        }

        isTruncated = listed.IsTruncated ?? false;
        continuationToken = listed.NextContinuationToken;
      }
      console.log(`[R2] Deleted all assets for video ${videoId}`);
    } catch (err) {
      console.error(`[R2] Failed to delete assets for video ${videoId}:`, err);
    }
  } else {
    // Local deletion
    try {
      const localPrefix = localUploadPath(`${workspaceId}/${videoId}`);
      await fs.rm(localPrefix, { recursive: true, force: true });
      console.log(`[Local Storage] Deleted all assets for video ${videoId}`);
    } catch (err) {
      console.error(`[Local Storage] Failed to delete assets for video ${videoId}:`, err);
    }
  }
}
