import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@shared/schema';

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

// Create postgres client for Supabase with SSL required
const client = postgres(process.env.DATABASE_URL, { 
  ssl: 'require',
  max: 10 // Connection pool size
});

export const db = drizzle(client, { schema });
