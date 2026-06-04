import { NextResponse } from 'next/server';
import { db, videos } from '@framevid/db';
import { eq } from 'drizzle-orm';

export async function GET() {
  const [video] = await db.select().from(videos).where(eq(videos.id, '27e3524f-36d7-49bc-9446-9276a8a751d5'));
  return NextResponse.json(video || { error: 'Not found' });
}
