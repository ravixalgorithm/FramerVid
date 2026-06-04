import { NextRequest, NextResponse } from 'next/server';
import { db, videos, videoFolders } from '@framevid/db';
import { eq } from 'drizzle-orm';
import {
  getHeartbeatBucketCounts,
  normalizePopularityCurve,
  HEARTBEAT_BUCKET_SECONDS,
} from '../../../../lib/analytics-queries';
import { getCurrentUser, verifyPassword, signSession, verifySession } from '../../../../lib/auth';
import { resolveMediaUrl } from '../../../../lib/asset-url';
import { cacheGet, cacheSet, videoMetaKey } from '../../../../../lib/cache';

/** Build the raw video data response (DB + analytics). Cached for public videos. */
async function fetchVideoData(videoId: string) {
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
  if (!row) return null;

  const { video, folderId } = row;
  const bucketCounts = await getHeartbeatBucketCounts(videoId);
  const popularityCurve = normalizePopularityCurve(
    bucketCounts,
    video.durationSeconds ? Number(video.durationSeconds) : undefined
  );

  const cleanFilename = (video.originalFilename || 'video.mp4').replace(/[^a-zA-Z0-9.]/g, '_');
  const originalMp4Key = `${video.workspaceId}/${video.id}/raw/${cleanFilename}`;
  const cdnBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL || 'https://cdn.framevid.co';
  const constructedMp4Url = `${cdnBase.replace(/\/$/, '')}/${originalMp4Key}`;

  return {
    id: video.id,
    workspaceId: video.workspaceId,
    title: video.title,
    status: video.status,
    durationSeconds: video.durationSeconds,
    hlsManifestUrl: video.hlsManifestUrl,
    originalMp4Url: constructedMp4Url,
    thumbnailUrls: video.thumbnailUrls,
    posterUrl: video.posterUrl,
    captionsUrl: video.captionsUrl,
    settings: video.settings,
    audioExtracted: video.audioExtracted,
    folderId: folderId || null,
    popularityCurve,
    popularityBucketSeconds: HEARTBEAT_BUCKET_SECONDS,
    updatedAt: video.updatedAt,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const { videoId } = params;
    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required', code: 'MISSING_PARAMS' }, { status: 400 });
    }

    // Try Redis cache first (60s TTL)
    const cacheKey = videoMetaKey(videoId);
    let responseData: any = await cacheGet(cacheKey);

    if (!responseData) {
      // Cache miss — query DB
      responseData = await fetchVideoData(videoId);
      if (!responseData) {
        return NextResponse.json({ error: 'Video not found', code: 'NOT_FOUND' }, { status: 404 });
      }
      // Cache for 60 seconds (public videos get hammered, this saves ~99% of DB reads)
      await cacheSet(cacheKey, responseData, 60);
    }

    // Privacy Checks
    const privacy = (responseData.settings as any)?.privacy || 'public';
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
          if (payload && payload.videoId === responseData.id) {
            hasAccess = true;
          }
        }
      }

      if (!hasAccess) {
        const passwordStr = req.nextUrl.searchParams.get('password');
        const storedHash = (responseData.settings as any)?.passwordHash;
        if (passwordStr && storedHash && verifyPassword(passwordStr, storedHash)) {
          hasAccess = true;
        }
      }

      if (!hasAccess) {
        responseData = {
          id: responseData.id,
          status: responseData.status,
          title: 'Confidential Video',
          posterUrl: responseData.posterUrl,
          settings: { privacy: 'password' },
          locked: true,
        };
      } else {
        const playbackToken = signSession({ videoId: responseData.id }, 1000 * 60 * 60 * 4); // 4 hours
        responseData.token = playbackToken;
        
        if (responseData.hlsManifestUrl) {
          try {
            const urlObj = new URL(responseData.hlsManifestUrl);
            responseData.hlsManifestUrl = `/api/v1/playback/${playbackToken}${urlObj.pathname}`;
          } catch (e) {}
        }
        if (responseData.originalMp4Url) {
          try {
            const urlObj = new URL(responseData.originalMp4Url);
            responseData.originalMp4Url = `/api/v1/playback/${playbackToken}${urlObj.pathname}`;
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

    if (!responseData.locked) {
      if (responseData.hlsManifestUrl) {
        responseData.hlsManifestUrl =
          resolveMediaUrl(responseData.hlsManifestUrl) ?? responseData.hlsManifestUrl;
      }
      if (responseData.originalMp4Url) {
        responseData.originalMp4Url =
          resolveMediaUrl(responseData.originalMp4Url) ?? responseData.originalMp4Url;
      }
      if (responseData.captionsUrl) {
        responseData.captionsUrl =
          resolveMediaUrl(responseData.captionsUrl) ?? responseData.captionsUrl;
      }
      if (responseData.posterUrl) {
        responseData.posterUrl = resolveMediaUrl(responseData.posterUrl) ?? responseData.posterUrl;
      }
      if (Array.isArray(responseData.thumbnailUrls)) {
        responseData.thumbnailUrls = responseData.thumbnailUrls.map(
          (u: string) => resolveMediaUrl(u) ?? u,
        );
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
