import { NextRequest, NextResponse } from 'next/server';
import { db, videos } from '@framevid/db';
import { eq } from 'drizzle-orm';

export async function GET(
  _req: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const { videoId } = params;
    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required', code: 'MISSING_PARAMS' }, { status: 400 });
    }

    const matchedVideos = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
    const video = matchedVideos[0];
    if (!video) {
      return NextResponse.json({ error: 'Video not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    // CORS Headers setup
    const response = NextResponse.json({
      data: {
        id: video.id,
        workspaceId: video.workspaceId,
        title: video.title,
        status: video.status,
        durationSeconds: video.durationSeconds,
        hlsManifestUrl: video.hlsManifestUrl,
        thumbnailUrls: video.thumbnailUrls,
        posterUrl: video.posterUrl,
        captionsUrl: video.captionsUrl,
        settings: video.settings,
      },
    });

    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

    return response;

  } catch (error: any) {
    console.error('Fetch video metadata endpoint failed:', error);
    return NextResponse.json({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

// OPTIONS handler for Preflight CORS checks
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}
