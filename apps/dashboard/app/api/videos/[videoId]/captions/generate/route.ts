import { NextRequest, NextResponse } from 'next/server';
import { db, videos } from '@framevid/db';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '../../../../../lib/auth';
import { requestDeepgramTranscription } from '../../../../../lib/deepgram';
import { audioStorageKey } from '../../../../../lib/asset-url';

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

export async function POST(
  _req: NextRequest,
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
        { error: 'Audio has not been extracted yet. Try again later.' },
        { status: 400 },
      );
    }

    const webhookBase =
      process.env.DASHBOARD_WEBHOOK_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:3000';

    const key = audioStorageKey(video.workspaceId, videoId);
    // Deepgram needs a publicly accessible URL to download the audio.
    // If we're testing locally with ngrok (DASHBOARD_WEBHOOK_URL is set), use that as the origin!
    const audioUrl = getAudioUrl(key, webhookBase.replace(/\/$/, ''));
      
    const callbackUrl = `${webhookBase.replace(/\/$/, '')}/api/v1/webhooks/ai?videoId=${encodeURIComponent(videoId)}&workspaceId=${encodeURIComponent(video.workspaceId)}`;

    await requestDeepgramTranscription(audioUrl, callbackUrl);

    return NextResponse.json({ success: true, message: 'Transcription requested' });
  } catch (error: unknown) {
    console.error('Deepgram generate captions failed:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
