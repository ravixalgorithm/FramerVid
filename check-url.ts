import { db, videos } from './apps/dashboard/node_modules/@framevid/db';
import { eq } from 'drizzle-orm';

async function run() {
  const [v] = await db.select().from(videos).where(eq(videos.id, 'b5499556-befb-45d3-8606-70a258924129')).limit(1);
  console.log('URL:', v.captionsUrl);
}

run().catch(console.error);
