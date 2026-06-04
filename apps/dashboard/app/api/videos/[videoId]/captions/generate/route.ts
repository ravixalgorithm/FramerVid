import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import { db, videos } from '@framevid/db';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '../../../../../lib/auth';
import { requestDeepgramTranscription, transcribeAudioSync } from '../../../../../lib/deepgram';
import { audioStorageKey, storedMediaUrl } from '../../../../../lib/asset-url';
import { saveDeepgramCaptionsForVideo } from '../../../../../lib/save-deepgram-captions';
import { localUploadPath } from '../../../../../../lib/storage';

const CDN_BASE =
  process.env.CLOUDFLARE_R2_PUBLIC_URL ||
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
  'https://cdn.framevid.co';

function getAudioUrl(key: string, origin: string): string {
  if (process.env.CLOUDFLARE_R2_ACCOUNT_ID) {
    return `${CDN_BASE.replace(/\/$/, '')}/${key}`;
  }
  return `${origin}/api/media/${key}`;
}

function useLocalDiskStorage(): boolean {
  return !process.env.CLOUDFLARE_R2_ACCOUNT_ID;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { videoId: string } },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { videoId } = params;
    const matched = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
    const video = matched[0];
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    if (!video.audioExtracted) {
      return NextResponse.json(
        { error: 'Audio has not been extracted yet. Wait for transcoding to finish.' },
        { status: 400 },
      );
    }

    const key = audioStorageKey(video.workspaceId, videoId);
    const origin = req.nextUrl.origin;

    // Local disk: transcribe in-process (no ngrok / public URL required).
    if (useLocalDiskStorage()) {
      const audioPath = localUploadPath(key);
      let audio: Buffer;
      try {
        audio = await fs.readFile(audioPath);
      } catch {
        return NextResponse.json(
          { error: 'Audio file not found on disk. Re-run transcoding or check the worker.' },
          { status: 400 },
        );
      }

      console.log('[Captions] Local sync Deepgram for', videoId);
      const payload = await transcribeAudioSync(audio);
      const { captionsUrl, utteranceCount } = await saveDeepgramCaptionsForVideo(
        video.workspaceId,
        videoId,
        payload,
        origin,
      );

      return NextResponse.json({
        success: true,
        sync: true,
        captionsUrl,
        utteranceCount,
        message: 'Captions generated',
      });
    }

    const webhookBase =
      process.env.DASHBOARD_WEBHOOK_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      origin;

    const audioUrl = getAudioUrl(key, webhookBase.replace(/\/$/, ''));
    const callbackUrl = `${webhookBase.replace(/\/$/, '')}/api/v1/webhooks/ai?videoId=${encodeURIComponent(videoId)}&workspaceId=${encodeURIComponent(video.workspaceId)}`;

    await requestDeepgramTranscription(audioUrl, callbackUrl);

    return NextResponse.json({
      success: true,
      message: 'Transcription requested',
      audioUrl: storedMediaUrl(key, webhookBase),
    });
  } catch (error: unknown) {
    console.error('Deepgram generate captions failed:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
