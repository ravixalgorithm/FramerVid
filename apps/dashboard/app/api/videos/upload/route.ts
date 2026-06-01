import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, videos } from '@framevid/db';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getCurrentUser } from '../../../lib/auth';
import type { VideoSettings } from '@framevid/types';

// S3 Client configuration for direct-to-R2 uploads
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || 'mock',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || 'mock',
  },
});

const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'framevid-assets';

const uploadSchema = z.object({
  title: z.string().min(1).max(255),
  originalFilename: z.string().min(1).max(255),
  workspaceId: z.string().uuid(),
  sizeBytes: z.number().int().positive().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = uploadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message || 'Validation error', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const { title, originalFilename, workspaceId, sizeBytes } = parsed.data;

    // Create unique Video ID
    const videoId = crypto.randomUUID();
    const cleanFilename = originalFilename.replace(/[^a-zA-Z0-9.]/g, '_');
    const rawKey = `${workspaceId}/${videoId}/raw/${cleanFilename}`;

    // Default Video Settings
    const defaultSettings: VideoSettings = {
      autoplay: false,
      loop: false,
      muted: false,
      controlsStyle: 'show',
      primaryColor: '#00F0FF',
      privacy: 'public',
      downloadEnabled: false,
      playbackSpeeds: [0.5, 0.75, 1, 1.25, 1.5, 2],
    };

    // Insert database record
    const [newVideo] = await db
      .insert(videos)
      .values({
        id: videoId,
        workspaceId,
        title,
        status: 'uploading',
        originalFilename,
        sizeBytes: sizeBytes || null,
        settings: defaultSettings,
        thumbnailUrls: [],
      })
      .returning();

    if (!newVideo) {
      throw new Error('Database insertion returned empty record.');
    }

    // Generate Cloudflare R2 presigned URL
    let uploadUrl = '';
    
    if (process.env.CLOUDFLARE_R2_ACCOUNT_ID) {
      try {
        const command = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: rawKey,
        });
        uploadUrl = await getSignedUrl(r2, command, { expiresIn: 3600 }); // 1 hour expiry
      } catch (err) {
        console.error('Failed to generate real R2 presigned URL, falling back to mock:', err);
      }
    }

    if (!uploadUrl) {
      // Mock Upload URL fallback for local development
      uploadUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/videos/upload/mock-destination?key=${encodeURIComponent(rawKey)}`;
    }

    return NextResponse.json({
      data: {
        video: newVideo,
        uploadUrl,
        rawKey,
      },
    });

  } catch (error: any) {
    console.error('Upload initiation endpoint failed:', error);
    return NextResponse.json({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
