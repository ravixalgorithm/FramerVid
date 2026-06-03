import { db, videoEvents } from '@framevid/db';
import { eq, sql } from 'drizzle-orm';

async function main() {
  const videoId = '3eef4039-abfb-4bd5-bc25-dd6454ea2b9a';
  
  await db.insert(videoEvents).values({
    videoId,
    eventType: 'heartbeat',
    sessionId: 'test_insert',
    eventData: sql`'{"bucket": 15}'::jsonb`,
  });

  const rows = await db.execute(sql`SELECT event_data->>'bucket' as b1 FROM video_events WHERE session_id = 'test_insert'`);
  console.log(rows);

  await db.delete(videoEvents).where(eq(videoEvents.sessionId, 'test_insert'));
}

main().catch(console.error);
