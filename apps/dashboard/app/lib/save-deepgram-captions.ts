import fs from 'fs/promises';
import path from 'path';
import { db, videos } from '@framevid/db';
import { eq } from 'drizzle-orm';
import { captionsStorageKey, storedMediaUrl, transcriptStorageKey } from './asset-url';
import { parseDeepgramUtterances, utterancesToVtt } from './deepgram-vtt';
import { localUploadPath } from '../../lib/storage';
import { uploadToR2, deleteFromR2 } from '../../lib/r2';
import { invalidateVideoCache } from '../../lib/cache';

export async function saveDeepgramCaptionsForVideo(
  workspaceId: string,
  videoId: string,
  payload: unknown,
  origin?: string,
): Promise<{ captionsUrl: string; utteranceCount: number }> {
  if ((payload as { err_code?: string })?.err_code) {
    const err = payload as { err_msg?: string };
    throw new Error(err.err_msg || 'Deepgram reported an error');
  }

  const utterances = parseDeepgramUtterances(payload);

  let vttText = 'WEBVTT\n\n';
  if (utterances.length > 0) {
    vttText = utterancesToVtt(utterances);
  } else {
    vttText = 'WEBVTT\n\nNOTE No speech detected in this video.\n';
  }

  const vttKey = captionsStorageKey(workspaceId, videoId);
  const transcriptKey = transcriptStorageKey(workspaceId, videoId);
  const transcriptJson = JSON.stringify({ utterances, generatedAt: new Date().toISOString() });

  // Delete old files first to save storage
  try { await deleteFromR2(vttKey); } catch { /* may not exist */ }
  try { await deleteFromR2(transcriptKey); } catch { /* may not exist */ }

  // Upload to R2 if configured, otherwise write to local disk
  const uploadedToR2 = await uploadToR2(vttKey, vttText, 'text/vtt');
  if (uploadedToR2) {
    await uploadToR2(transcriptKey, transcriptJson, 'application/json');
  } else {
    await fs.mkdir(path.dirname(localUploadPath(vttKey)), { recursive: true });
    await fs.writeFile(localUploadPath(vttKey), vttText, 'utf8');
    await fs.writeFile(localUploadPath(transcriptKey), transcriptJson, 'utf8');
  }

  const captionsUrl = storedMediaUrl(vttKey, origin);

  await db
    .update(videos)
    .set({
      captionsUrl,
      updatedAt: new Date(),
    })
    .where(eq(videos.id, videoId));

  await invalidateVideoCache(videoId);

  return { captionsUrl, utteranceCount: utterances.length };
}
