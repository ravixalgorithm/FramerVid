import { db, videoEvents, videos } from '@framevid/db';
import { sql } from 'drizzle-orm';

async function main() {
  const allVideos = await db.select().from(videos);
  if (allVideos.length === 0) {
    console.log("No videos found to add data to.");
    return;
  }
  for (const video of allVideos) {
    const videoId = video.id;
    console.log(`Injecting dummy retention data for video: ${videoId}`);

    const dummySessions = 50;
    const events: any[] = [];
    const sessionIdPrefix = `dummy_session_${Date.now()}_`;

    for (let s = 0; s < dummySessions; s++) {
      const sessionId = `${sessionIdPrefix}${s}`;
      
      // Everyone plays
      events.push({
        videoId,
        eventType: 'video_play',
        sessionId,
        timestamp: new Date(),
      });

      // Everyone watches buckets 0, 5, 10
      events.push({ videoId, eventType: 'heartbeat', sessionId, eventData: sql`'{"bucket": 0}'::jsonb`, timestamp: new Date() });
      events.push({ videoId, eventType: 'heartbeat', sessionId, eventData: sql`'{"bucket": 5}'::jsonb`, timestamp: new Date() });
      events.push({ videoId, eventType: 'heartbeat', sessionId, eventData: sql`'{"bucket": 10}'::jsonb`, timestamp: new Date() });

      // Only 20 sessions watch bucket 15 (creates a 60% drop-off cliff)
      if (s < 20) {
        events.push({ videoId, eventType: 'heartbeat', sessionId, eventData: sql`'{"bucket": 15}'::jsonb`, timestamp: new Date() });
      }

      // Only 10 sessions watch bucket 20
      if (s < 10) {
        events.push({ videoId, eventType: 'heartbeat', sessionId, eventData: sql`'{"bucket": 20}'::jsonb`, timestamp: new Date() });
      }
    }

    await db.insert(videoEvents).values(events);
  }
  console.log('Dummy data injected for all videos successfully!');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
