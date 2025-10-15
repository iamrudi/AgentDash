import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@shared/schema';
import { retry, isRetryableError } from './lib/retry';

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

// Singleton pattern to prevent connection pool exhaustion on hot reload
declare global {
  var __db: ReturnType<typeof postgres> | undefined;
}

// Database connection configuration
const connectionConfig: postgres.Options<any> = {
  ssl: 'require',
  max: 10, // Connection pool size
  idle_timeout: 20, // Close idle connections after 20s
  connect_timeout: 10, // Connection timeout 10s
  max_lifetime: 60 * 30, // Close connections after 30 minutes
  
  connection: {
    application_name: 'agency-portal',
  },
  
  onnotice: () => {}, // Suppress notices
  
  transform: {
    undefined: null, // Transform undefined to null for Postgres
  },
  
  debug: (connection, query, params, types) => {
    // Optional: log queries in development
    if (process.env.NODE_ENV === 'development' && process.env.DEBUG_SQL) {
      console.log('SQL:', query);
    }
  },
};

// Create database client (connection is lazy)
function createDatabaseConnection(): postgres.Sql {
  try {
    return postgres(process.env.DATABASE_URL!, connectionConfig);
  } catch (error) {
    console.error('❌ Failed to initialize database client:', error);
    throw error;
  }
}

// Reuse existing connection in development (hot reload)
const client = global.__db ?? createDatabaseConnection();

if (process.env.NODE_ENV === 'development') {
  global.__db = client;
}

export const db = drizzle(client, { schema });

// Verify database connection with retries on startup
async function verifyDatabaseConnection() {
  await retry(
    async () => {
      await client`SELECT 1 as connected`;
    },
    {
      maxAttempts: 3,
      initialDelay: 1000, // 1s
      backoffMultiplier: 2, // 1s → 2s → 4s
      onRetry: (attempt, error) => {
        if (isRetryableError(error)) {
          console.warn(
            `⚠️  Database connection attempt ${attempt} failed, retrying... (${error.message})`
          );
        } else {
          throw error; // Don't retry non-connection errors
        }
      },
    }
  );
  console.info('✅ Database connection verified');
}

// Run connection verification asynchronously (don't block startup)
verifyDatabaseConnection().catch((error) => {
  console.error('❌ Database connection failed after retries:', error);
  // In development, just warn. In production, this is a critical failure
  if (process.env.NODE_ENV === 'production') {
    console.error('💥 Cannot start without database connection');
    process.exit(1);
  }
});
