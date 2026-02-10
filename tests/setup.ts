import { beforeAll, afterAll, afterEach, vi } from 'vitest';

vi.mock('../server/db', () => ({ db: {} }));

// Setup test environment
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
  process.env.SESSION_SECRET = 'test-session-secret-key-for-testing-only';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-different';
  process.env.ENCRYPTION_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='; // 44 char base64 (32 bytes)
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
});

// Cleanup after each test
afterEach(() => {
  // Clear any mocks
});

// Cleanup after all tests
afterAll(() => {
  // Close any open connections
});
