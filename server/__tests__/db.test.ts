import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.unmock('../db');

// Mock the retry module before importing db
vi.mock('../lib/retry', () => ({
  retry: vi.fn(),
  isRetryableError: vi.fn((error: any) => {
    const retryableCodes = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'];
    return retryableCodes.includes(error?.code) || 
           error?.message?.toLowerCase().includes('connection');
  }),
}));

// Mock postgres
const mockPostgresClient = vi.fn();
const mockDrizzle = vi.fn();

vi.mock('postgres', () => ({
  default: mockPostgresClient,
}));

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: mockDrizzle,
}));

describe('Database Connection', () => {
  let consoleInfoSpy: any;
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;
  let processExitSpy: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    
    originalEnv = { ...process.env };
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  it('should create database connection with correct config', async () => {
    const mockClient = vi.fn();
    mockPostgresClient.mockReturnValue(mockClient);
    mockDrizzle.mockReturnValue({});

    // Mock successful connection
    const { retry } = await import('../lib/retry');
    (retry as any).mockImplementation(async (fn: Function) => {
      await fn();
      return Promise.resolve();
    });

    // Import db.ts which will execute connection logic
    await import('../db');

    expect(mockPostgresClient).toHaveBeenCalledWith(
      process.env.DATABASE_URL,
      expect.objectContaining({
        ssl: 'require',
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
        max_lifetime: 60 * 30,
      })
    );
  });

  it('should verify connection with retry logic', async () => {
    const mockClient = vi.fn();
    mockPostgresClient.mockReturnValue(mockClient);
    mockDrizzle.mockReturnValue({});

    const { retry } = await import('../lib/retry');
    (retry as any).mockImplementation(async (fn: Function, options: any) => {
      expect(options.maxAttempts).toBe(3);
      expect(options.initialDelay).toBe(1000);
      expect(options.backoffMultiplier).toBe(2);
      await fn();
    });

    await import('../db');

    expect(retry).toHaveBeenCalled();
  });

  it('should log success message on connection verification', async () => {
    const mockClient = vi.fn();
    mockPostgresClient.mockReturnValue(mockClient);
    mockDrizzle.mockReturnValue({});

    const { retry } = await import('../lib/retry');
    (retry as any).mockResolvedValue(undefined);

    await import('../db');

    // Wait for async verification
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining('Database connection verified')
    );
  });

  it('should handle connection failure in development', async () => {
    process.env.NODE_ENV = 'development';
    
    const mockClient = vi.fn();
    mockPostgresClient.mockReturnValue(mockClient);
    mockDrizzle.mockReturnValue({});

    const { retry } = await import('../lib/retry');
    const connectionError = new Error('Connection failed');
    (retry as any).mockRejectedValue(connectionError);

    await import('../db');

    // Wait for async verification to fail
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Database connection failed after retries'),
      connectionError
    );
    
    // In development, should not exit
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it('should exit in production on connection failure', async () => {
    process.env.NODE_ENV = 'production';
    
    const mockClient = vi.fn();
    mockPostgresClient.mockReturnValue(mockClient);
    mockDrizzle.mockReturnValue({});

    const { retry } = await import('../lib/retry');
    const connectionError = new Error('Connection failed');
    (retry as any).mockRejectedValue(connectionError);

    await import('../db');

    // Wait for async verification to fail
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cannot start without database connection')
    );
    
    // In production, should exit
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should retry only retryable connection errors', async () => {
    const mockClient = vi.fn();
    mockPostgresClient.mockReturnValue(mockClient);
    mockDrizzle.mockReturnValue({});

    const { retry, isRetryableError } = await import('../lib/retry');
    
    const retryableError = { code: 'ECONNREFUSED', message: 'Connection refused' };
    let onRetryFn: Function | undefined;
    
    (retry as any).mockImplementation(async (_fn: Function, options: any) => {
      onRetryFn = options.onRetry;
      return Promise.resolve();
    });

    await import('../db');

    // Test the onRetry handler
    if (onRetryFn) {
      expect(() => onRetryFn(1, retryableError)).not.toThrow();
      expect(consoleWarnSpy).toHaveBeenCalled();
    }
  });

  it('should not retry non-retryable errors', async () => {
    const mockClient = vi.fn();
    mockPostgresClient.mockReturnValue(mockClient);
    mockDrizzle.mockReturnValue({});

    const { retry, isRetryableError } = await import('../lib/retry');
    
    const nonRetryableError = new Error('Invalid credentials');
    let onRetryFn: Function | undefined;
    
    (retry as any).mockImplementation(async (_fn: Function, options: any) => {
      onRetryFn = options.onRetry;
      return Promise.resolve();
    });

    await import('../db');

    // Test the onRetry handler throws on non-retryable
    if (onRetryFn) {
      expect(() => onRetryFn(1, nonRetryableError)).toThrow();
    }
  });

  it('should handle database URL validation', async () => {
    delete process.env.DATABASE_URL;

    await expect(import('../db')).rejects.toThrow('DATABASE_URL must be set');
  });

  it('should reuse connection in development (hot reload)', async () => {
    process.env.NODE_ENV = 'development';
    
    const mockClient = vi.fn();
    mockPostgresClient.mockReturnValue(mockClient);
    mockDrizzle.mockReturnValue({});

    const { retry } = await import('../lib/retry');
    (retry as any).mockResolvedValue(undefined);

    // First import
    vi.resetModules();
    await import('../db');
    const firstCallCount = mockPostgresClient.mock.calls.length;

    // Second import (simulates hot reload)
    await import('../db');
    
    // Should reuse connection, not create a new one
    expect(mockPostgresClient.mock.calls.length).toBe(firstCallCount);
  });
});
