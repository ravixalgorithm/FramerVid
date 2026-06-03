import { db, videoEvents } from '@framevid/db';
import { like } from 'drizzle-orm';

async function main() {
  console.log('Deleting all dummy data...');
  await db.delete(videoEvents).where(like(videoEvents.sessionId, 'dummy_session_%'));
  console.log('Dummy data deleted successfully!');
  process.exit(0);
}

main().catch(console.error);
