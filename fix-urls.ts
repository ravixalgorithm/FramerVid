import { db, videos } from './apps/dashboard/node_modules/@framevid/db';
import { isNotNull } from 'drizzle-orm';

async function run() {
  console.log('Fixing URLs...');
  const vids = await db.select().from(videos).where(isNotNull(videos.captionsUrl));
  for (const v of vids) {
    if (v.captionsUrl && v.captionsUrl.includes('ngrok-free.dev')) {
      const newUrl = v.captionsUrl.replace(/https:\/\/[^\/]+/, 'https://cdn.framevid.co');
      await db.update(videos).set({ captionsUrl: newUrl }).where({ id: v.id });
      console.log('Updated', v.id, newUrl);
    }
  }
  console.log('Done');
}

run().catch(console.error);
