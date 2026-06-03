import { config } from 'dotenv';
config({ path: 'apps/dashboard/.env.local' });
import { db, videos } from './apps/dashboard/node_modules/@framevid/db/dist/index.js';

async function run() {
  console.log('Clearing aiInsights for all videos to force regeneration...');
  
  await db.update(videos).set({ aiInsights: null });
  
  console.log('Done!');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
