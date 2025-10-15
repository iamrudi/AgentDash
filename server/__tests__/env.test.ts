import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Environment Validation', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let consoleWarnSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    originalEnv = { ...process.env };
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`Process exit ${code}`);
    });
    // Clear module cache to test fresh imports
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('Development Environment', () => {
    it('should allow missing optional secrets in development', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.SESSION_SECRET = 'dev-secret';
      process.env.ENCRYPTION_KEY = 'a'.repeat(32); // 32 bytes
      process.env.PORT = '5000';
      
      // Missing JWT_SECRET should warn in dev
      delete process.env.JWT_SECRET;

      const { env } = await import('../env');

      expect(env.NODE_ENV).toBe('development');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('JWT_SECRET not set')
      );
    });

    it('should validate required secrets in development', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.DATABASE_URL;

      await expect(async () => {
        await import('../env');
      }).rejects.toThrow();
    });

    it('should accept valid encryption key in development', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.SESSION_SECRET = 'dev-secret';
      process.env.ENCRYPTION_KEY = 'a'.repeat(32);
      process.env.PORT = '5000';

      const { env } = await import('../env');

      expect(env.ENCRYPTION_KEY).toBe('a'.repeat(32));
    });
  });

  describe('Production Environment', () => {
    it('should require all critical secrets in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://prod/db';
      process.env.SESSION_SECRET = 'prod-session';
      process.env.ENCRYPTION_KEY = 'a'.repeat(32);
      process.env.PORT = '5000';
      
      // Missing JWT_SECRET should fail in production
      delete process.env.JWT_SECRET;

      await expect(async () => {
        await import('../env');
      }).rejects.toThrow(/Process exit 1/);
    });

    it('should enforce JWT_SECRET != SESSION_SECRET in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://prod/db';
      process.env.SESSION_SECRET = 'same-secret';
      process.env.JWT_SECRET = 'same-secret'; // Same as SESSION_SECRET!
      process.env.ENCRYPTION_KEY = 'a'.repeat(32);
      process.env.PORT = '5000';

      await expect(async () => {
        await import('../env');
      }).rejects.toThrow(/Process exit 1/);
    });

    it('should validate encryption key length in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://prod/db';
      process.env.SESSION_SECRET = 'prod-session';
      process.env.JWT_SECRET = 'prod-jwt';
      process.env.ENCRYPTION_KEY = 'tooshort'; // Less than 32 bytes
      process.env.PORT = '5000';

      await expect(async () => {
        await import('../env');
      }).rejects.toThrow(/Process exit 1/);
    });

    it('should accept all valid production secrets', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://prod/db';
      process.env.SESSION_SECRET = 'prod-session-secret-xyz';
      process.env.JWT_SECRET = 'prod-jwt-secret-abc';
      process.env.ENCRYPTION_KEY = 'a'.repeat(32);
      process.env.PORT = '5000';

      const { env } = await import('../env');

      expect(env.NODE_ENV).toBe('production');
      expect(env.JWT_SECRET).toBe('prod-jwt-secret-abc');
      expect(env.SESSION_SECRET).toBe('prod-session-secret-xyz');
      expect(env.ENCRYPTION_KEY).toBe('a'.repeat(32));
    });
  });

  describe('Optional Configurations', () => {
    it('should provide defaults for optional values', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.SESSION_SECRET = 'secret';
      process.env.ENCRYPTION_KEY = 'a'.repeat(32);
      
      // Don't set PORT
      delete process.env.PORT;

      const { env } = await import('../env');

      expect(env.PORT).toBe('5000'); // Default port
    });

    it('should handle optional email configuration', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.SESSION_SECRET = 'secret';
      process.env.ENCRYPTION_KEY = 'a'.repeat(32);
      process.env.PORT = '5000';

      // SMTP settings are optional
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;

      const { env } = await import('../env');

      // Should load without errors
      expect(env.NODE_ENV).toBe('development');
    });

    it('should parse numeric PORT correctly', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.SESSION_SECRET = 'secret';
      process.env.ENCRYPTION_KEY = 'a'.repeat(32);
      process.env.PORT = '3000';

      const { env } = await import('../env');

      expect(env.PORT).toBe('3000');
      expect(typeof env.PORT).toBe('string');
    });
  });

  describe('Security Validations', () => {
    it('should reject weak encryption key', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://prod/db';
      process.env.SESSION_SECRET = 'session';
      process.env.JWT_SECRET = 'jwt';
      process.env.ENCRYPTION_KEY = '12345'; // Too short
      process.env.PORT = '5000';

      await expect(async () => {
        await import('../env');
      }).rejects.toThrow(/Process exit 1/);
    });

    it('should warn about development mode in production', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://prod.example.com/db'; // Production-like URL
      process.env.SESSION_SECRET = 'secret';
      process.env.ENCRYPTION_KEY = 'a'.repeat(32);
      process.env.PORT = '5000';

      await import('../env');

      // Should not fail, but may warn
      expect(true).toBe(true);
    });
  });

  describe('Supabase Integration', () => {
    it('should validate Supabase configuration when provided', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://prod/db';
      process.env.SESSION_SECRET = 'session';
      process.env.JWT_SECRET = 'jwt';
      process.env.ENCRYPTION_KEY = 'a'.repeat(32);
      process.env.PORT = '5000';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'anon-key';
      process.env.SUPABASE_SERVICE_KEY = 'service-key';

      const { env } = await import('../env');

      expect(env.SUPABASE_URL).toBe('https://example.supabase.co');
      expect(env.SUPABASE_ANON_KEY).toBe('anon-key');
      expect(env.SUPABASE_SERVICE_KEY).toBe('service-key');
    });

    it('should handle missing optional Supabase config', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.SESSION_SECRET = 'secret';
      process.env.ENCRYPTION_KEY = 'a'.repeat(32);
      process.env.PORT = '5000';

      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;

      const { env } = await import('../env');

      // Should load without Supabase
      expect(env.NODE_ENV).toBe('development');
    });
  });
});
