import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@shared/schema';

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

// Singleton pattern to prevent connection pool exhaustion on hot reload
declare global {
  var __db: ReturnType<typeof postgres> | undefined;
}

// Reuse existing connection in development (hot reload)
const client = global.__db ?? postgres(process.env.DATABASE_URL, { 
  ssl: 'require',
  max: 10 // Connection pool size
});

if (process.env.NODE_ENV === 'development') {
  global.__db = client;
}

export const db = drizzle(client, { schema });
