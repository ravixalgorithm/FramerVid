import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { db, videos } from '@framevid/db';
import { eq } from 'drizzle-orm';
import { captionsStorageKey, transcriptStorageKey } from '../../../../lib/asset-url';
import { parseDeepgramUtterances, utterancesToVtt } from '../../../../lib/deepgram-vtt';
import { localUploadPath } from '../../../../../lib/storage';

const CDN_BASE =
  process.env.CLOUDFLARE_R2_PUBLIC_URL ||
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
  'https://cdn.framevid.co';

function publicUrlForKey(key: string, _origin: string): string {
  return `${CDN_BASE.replace(/\/$/, '')}/${key}`;
}

export async function POST(req: NextRequest) {
  try {
    const videoId = req.nextUrl.searchParams.get('videoId');
    const workspaceId = req.nextUrl.searchParams.get('workspaceId');
    if (!videoId || !workspaceId) {
      return NextResponse.json({ error: 'Missing videoId or workspaceId' }, { status: 400 });
    }

    const payload = await req.json();
    console.log('[Webhook] Deepgram payload received for', videoId);
    
    // Check for Deepgram errors
    if (payload.err_code) {
      console.error('[Webhook] Deepgram reported an error in the payload:', payload);
      return NextResponse.json({ error: payload.err_msg }, { status: 400 });
    }

    const utterances = parseDeepgramUtterances(payload);
    
    let vttText = 'WEBVTT\n\n';
    if (utterances.length > 0) {
      vttText = utterancesToVtt(utterances);
    } else {
      console.log('[Webhook] No speech detected in video', videoId);
      // We still create the empty file so the UI knows it finished!
      vttText = 'WEBVTT\n\nNOTE No speech detected in this video.\n';
    }

    const vttKey = captionsStorageKey(workspaceId, videoId);
    const transcriptKey = transcriptStorageKey(workspaceId, videoId);

    await fs.mkdir(path.dirname(localUploadPath(vttKey)), { recursive: true });
    await fs.writeFile(localUploadPath(vttKey), vttText, 'utf8');
    await fs.writeFile(
      localUploadPath(transcriptKey),
      JSON.stringify({ utterances, generatedAt: new Date().toISOString() }),
      'utf8'
    );

    const origin = req.nextUrl.origin;
    const captionsUrl = publicUrlForKey(vttKey, origin);

    await db
      .update(videos)
      .set({
        captionsUrl,
        updatedAt: new Date(),
      })
      .where(eq(videos.id, videoId));

    console.log('[Webhook] Captions successfully saved to', vttKey);
    return NextResponse.json({ ok: true, utteranceCount: utterances.length });
  } catch (error: unknown) {
    console.error('Deepgram webhook failed:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
