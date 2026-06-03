import { NextRequest, NextResponse } from 'next/server';
import { db, videos, videoFolders } from '@framevid/db';
import { eq } from 'drizzle-orm';
import {
  getHeartbeatBucketCounts,
  normalizePopularityCurve,
  HEARTBEAT_BUCKET_SECONDS,
} from '../../../../lib/analytics-queries';
import { getCurrentUser, verifyPassword, signSession, verifySession } from '../../../../lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const { videoId } = params;
    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required', code: 'MISSING_PARAMS' }, { status: 400 });
    }

    const matched = await db
      .select({
        video: videos,
        folderId: videoFolders.folderId,
      })
      .from(videos)
      .leftJoin(videoFolders, eq(videos.id, videoFolders.videoId))
      .where(eq(videos.id, videoId))
      .limit(1);

    const row = matched[0];
    if (!row) {
      return NextResponse.json({ error: 'Video not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const { video, folderId } = row;
    const bucketCounts = await getHeartbeatBucketCounts(videoId);
    const popularityCurve = normalizePopularityCurve(
      bucketCounts,
      video.durationSeconds ? Number(video.durationSeconds) : undefined
    );

    let responseData: any = {
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
      folderId: folderId || null,
      popularityCurve,
      popularityBucketSeconds: HEARTBEAT_BUCKET_SECONDS,
      updatedAt: video.updatedAt,
    };

    // Privacy Checks
    const privacy = (video.settings as any)?.privacy || 'public';
    if (privacy === 'password') {
      let hasAccess = false;
      
      const user = await getCurrentUser();
      if (user) {
        hasAccess = true; // For now, assume logged in user is the owner/workspace member
      }

      if (!hasAccess) {
        const tokenStr = req.nextUrl.searchParams.get('token') || req.headers.get('Authorization')?.replace('Bearer ', '');
        if (tokenStr) {
          const payload = verifySession(tokenStr);
          if (payload && payload.videoId === video.id) {
            hasAccess = true;
          }
        }
      }

      if (!hasAccess) {
        const passwordStr = req.nextUrl.searchParams.get('password');
        const storedHash = (video.settings as any)?.passwordHash;
        if (passwordStr && storedHash && verifyPassword(passwordStr, storedHash)) {
          hasAccess = true;
        }
      }

      if (!hasAccess) {
        responseData = {
          id: video.id,
          status: video.status,
          title: 'Confidential Video',
          posterUrl: video.posterUrl,
          settings: { privacy: 'password' },
          locked: true,
        };
      } else {
        const playbackToken = signSession({ videoId: video.id }, 1000 * 60 * 60 * 4); // 4 hours
        responseData.token = playbackToken;
        
        if (responseData.hlsManifestUrl) {
          try {
            const urlObj = new URL(responseData.hlsManifestUrl);
            responseData.hlsManifestUrl = `/api/v1/playback/${playbackToken}${urlObj.pathname}`;
          } catch (e) {}
        }
        if (responseData.captionsUrl) {
          try {
            const urlObj = new URL(responseData.captionsUrl);
            responseData.captionsUrl = `/api/v1/playback/${playbackToken}${urlObj.pathname}`;
          } catch (e) {}
        }
      }
    }

    const response = NextResponse.json({
      data: responseData,
    });

    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    response.headers.set('Cache-Control', 'public, max-age=60');

    return response;
  } catch (error: unknown) {
    console.error('Fetch video metadata endpoint failed:', error);
    return NextResponse.json({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}
