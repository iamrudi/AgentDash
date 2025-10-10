import { drizzle } from "drizzle-orm/neon-serverless";
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";
import * as schema from "@shared/schema";

// Configure WebSocket constructor with options to handle SSL
neonConfig.webSocketConstructor = class extends ws {
  constructor(url: string | URL, protocols?: string | string[]) {
    super(url, protocols, {
      rejectUnauthorized: false // Accept self-signed certificates
    });
  }
} as any;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
