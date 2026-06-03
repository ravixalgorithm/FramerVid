import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/framevid';

// Connection client for query execution
const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });

// Export everything from schema for easy imports
export * from './schema.js';
export { findMonorepoRoot, resolveLocalUploadDir, localUploadPath } from './paths.js';
export { client };
