import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, videos, workspaces } from '@framevid/db';
import { eq } from 'drizzle-orm';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { enqueueImportJob } from '@framevid/queue';
import { getCurrentUser } from '../../../../lib/auth';
import { assertWorkspaceAccess } from '../../../../lib/workspace-access';
import { getPlanLimits } from '../../../../lib/plan-limits';
import { wakeTranscodeWorker } from '../../../../lib/wake-worker';

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

const replaceSchema = z.object({
  originalFilename: z.string().min(1).max(255).optional(),
  sizeBytes: z.number().int().positive().optional(),
  contentType: z.string().min(1).max(127).optional(),
  url: z.string().url().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { videoId } = params;
    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const body = await req.json();
    const parsed = replaceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message || 'Validation error', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const { originalFilename, sizeBytes, contentType, url } = parsed.data;

    // Retrieve existing video record
    const [video] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
    if (!video) {
      return NextResponse.json({ error: 'Video not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    // Verify workspace access and permissions (admin or editor needed to modify assets)
    if (!(await assertWorkspaceAccess(user.id, video.workspaceId, ['admin', 'editor']))) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, video.workspaceId)).limit(1);
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const planLimits = getPlanLimits(workspace.plan || 'free');

    // Handle URL import replacement
    if (url) {
      const [updatedVideo] = await db
        .update(videos)
        .set({
          status: 'uploading',
          originalFilename: 'import.mp4',
          updatedAt: new Date(),
        })
        .where(eq(videos.id, videoId))
        .returning();

      if (!updatedVideo) {
        throw new Error('Database update returned empty record.');
      }

      await wakeTranscodeWorker();

      await enqueueImportJob({
        videoId,
        workspaceId: video.workspaceId,
        url,
      });

      return NextResponse.json({
        data: {
          video: updatedVideo,
          message: 'Replacement import job queued successfully',
        },
      });
    }

    // Handle Direct File Upload replacement
    if (!originalFilename) {
      return NextResponse.json({ error: 'originalFilename or URL is required', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const uploadContentType = contentType || 'application/octet-stream';

    // Verify size limits for direct upload
    if (sizeBytes && planLimits.maxBytesPerVideo !== null && sizeBytes > planLimits.maxBytesPerVideo) {
      return NextResponse.json(
        {
          error: `File exceeds ${Math.round(planLimits.maxBytesPerVideo / (1024 * 1024))}MB limit for your plan.`,
          code: 'PLAN_LIMIT',
        },
        { status: 403 },
      );
    }

    const cleanFilename = originalFilename.replace(/[^a-zA-Z0-9.]/g, '_');
    const rawKey = `${video.workspaceId}/${video.id}/raw/${cleanFilename}`;

    // Update database record status back to 'uploading'
    const [updatedVideo] = await db
      .update(videos)
      .set({
        status: 'uploading',
        originalFilename,
        sizeBytes: sizeBytes || null,
        updatedAt: new Date(),
      })
      .where(eq(videos.id, videoId))
      .returning();

    if (!updatedVideo) {
      throw new Error('Database update returned empty record.');
    }

    // Generate Cloudflare R2 presigned URL
    let uploadUrl = '';
    
    if (process.env.CLOUDFLARE_R2_ACCOUNT_ID) {
      try {
        const command = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: rawKey,
          ContentType: uploadContentType,
        });
        uploadUrl = await getSignedUrl(r2, command, { expiresIn: 3600 });
      } catch (err) {
        console.error('Failed to generate real R2 presigned URL, falling back to mock:', err);
      }
    }

    if (!uploadUrl) {
      uploadUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/videos/upload/mock-destination?key=${encodeURIComponent(rawKey)}`;
    } else {
      void wakeTranscodeWorker();
    }

    return NextResponse.json({
      data: {
        video: updatedVideo,
        uploadUrl,
        rawKey,
        contentType: uploadContentType,
      },
    });

  } catch (error: any) {
    console.error('Video replacement initiation failed:', error);
    return NextResponse.json({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
