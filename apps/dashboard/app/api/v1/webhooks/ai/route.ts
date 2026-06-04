import { NextRequest, NextResponse } from 'next/server';
import { saveDeepgramCaptionsForVideo } from '../../../../lib/save-deepgram-captions';

export async function POST(req: NextRequest) {
  try {
    const videoId = req.nextUrl.searchParams.get('videoId');
    const workspaceId = req.nextUrl.searchParams.get('workspaceId');
    if (!videoId || !workspaceId) {
      return NextResponse.json({ error: 'Missing videoId or workspaceId' }, { status: 400 });
    }

    const payload = await req.json();
    console.log('[Webhook] Deepgram payload received for', videoId);

    const { utteranceCount } = await saveDeepgramCaptionsForVideo(
      workspaceId,
      videoId,
      payload,
      req.nextUrl.origin,
    );

    console.log('[Webhook] Captions saved for', videoId, `(${utteranceCount} utterances)`);
    return NextResponse.json({ ok: true, utteranceCount });
  } catch (error: unknown) {
    console.error('Deepgram webhook failed:', error);
    const message = error instanceof Error ? error.message : 'Webhook processing failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
