import { z } from 'zod';

const isDev = process.env.NODE_ENV === 'development';

const envSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),

  // Database
  DATABASE_URL: z.string().url(),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().optional(),

  // Security - More lenient in development
  ENCRYPTION_KEY: isDev 
    ? z.string().min(1) 
    : z.string().length(44, 'ENCRYPTION_KEY must be 44 characters (32 bytes base64-encoded)'),
  SESSION_SECRET: z.string().min(1, 'SESSION_SECRET is required'),
  JWT_SECRET: isDev 
    ? z.string().min(1).optional()
    : z.string().min(32, 'JWT_SECRET must be at least 32 characters and different from SESSION_SECRET'),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  REDIRECT_URI: z.string().url().optional(),

  // AI Provider Configuration
  AI_PROVIDER: z.enum(['gemini', 'openai']).default('gemini'),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  // Email (Optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),

});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  try {
    const validated = envSchema.parse(process.env);
    
    // Additional validation: JWT_SECRET must differ from SESSION_SECRET (only in production)
    if (!isDev && validated.JWT_SECRET && validated.JWT_SECRET === validated.SESSION_SECRET) {
      console.error('❌ JWT_SECRET must be different from SESSION_SECRET for security');
      process.exit(1);
    }

    // Additional validation: Require API key for the selected provider
    const provider = validated.AI_PROVIDER || 'gemini';
    if (provider === 'gemini' && !validated.GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY is required when AI_PROVIDER is set to "gemini"');
      if (!isDev) process.exit(1);
    }
    if (provider === 'openai' && !validated.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY is required when AI_PROVIDER is set to "openai"');
      if (!isDev) process.exit(1);
    }

    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(err => `  - ${err.path.join('.')}: ${err.message}`).join('\n');
      console.error('❌ Environment validation failed:\n' + missingVars);
      
      // In development, just warn instead of exiting
      if (isDev) {
        console.warn('⚠️  Some environment variables are missing or invalid. Continuing in development mode...');
        return process.env as any;
      }
      
      process.exit(1);
    }
    throw error;
  }
}

// Validate on import (fail fast)
export const env = validateEnv();

// Runtime check for production
if (env.NODE_ENV === 'production') {
  console.log('✅ Environment variables validated for production');
}
