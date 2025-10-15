import { describe, it, expect, vi, beforeEach } from 'vitest';
import { retry, isRetryableError, retryOnRetryableError } from '../retry';

describe('retry utility', () => {
  beforeEach(() => {
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  describe('retry()', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const promise = retry(operation, { maxAttempts: 3 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry and eventually succeed', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const promise = retry(operation, { 
        maxAttempts: 3,
        initialDelay: 100,
      });
      
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max attempts exhausted', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('persistent failure'));

      const promise = retry(operation, { 
        maxAttempts: 3,
        initialDelay: 100,
      });
      
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('persistent failure');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should apply exponential backoff', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const promise = retry(operation, {
        maxAttempts: 3,
        initialDelay: 1000,
        backoffMultiplier: 2,
      });

      // First attempt fails immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(operation).toHaveBeenCalledTimes(1);

      // Wait 1s for first retry
      await vi.advanceTimersByTimeAsync(1000);
      expect(operation).toHaveBeenCalledTimes(2);

      // Wait 2s for second retry (2x backoff)
      await vi.advanceTimersByTimeAsync(2000);
      expect(operation).toHaveBeenCalledTimes(3);

      const result = await promise;
      expect(result).toBe('success');
    });

    it('should respect maxDelay cap', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const promise = retry(operation, {
        maxAttempts: 2,
        initialDelay: 5000,
        maxDelay: 2000, // Cap at 2s
      });

      await vi.advanceTimersByTimeAsync(0);
      expect(operation).toHaveBeenCalledTimes(1);

      // Should wait maxDelay (2s) instead of initialDelay (5s)
      await vi.advanceTimersByTimeAsync(2000);
      expect(operation).toHaveBeenCalledTimes(2);

      const result = await promise;
      expect(result).toBe('success');
    });

    it('should call onRetry callback', async () => {
      const onRetry = vi.fn();
      const error1 = new Error('fail 1');
      const error2 = new Error('fail 2');
      
      const operation = vi
        .fn()
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error2)
        .mockResolvedValue('success');

      const promise = retry(operation, {
        maxAttempts: 3,
        initialDelay: 100,
        onRetry,
      });

      await vi.runAllTimersAsync();
      await promise;

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenNthCalledWith(1, 1, error1);
      expect(onRetry).toHaveBeenNthCalledWith(2, 2, error2);
    });

    it('should use default options', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const promise = retry(operation);
      
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('isRetryableError()', () => {
    it('should identify connection errors as retryable', () => {
      const errors = [
        { code: 'ECONNREFUSED' },
        { code: 'ETIMEDOUT' },
        { code: 'ENOTFOUND' },
        { code: 'ENETUNREACH' },
        { code: 'EPIPE' },
        { code: 'ECONNRESET' },
        { code: 'PROTOCOL_CONNECTION_LOST' },
      ];

      errors.forEach(error => {
        expect(isRetryableError(error)).toBe(true);
      });
    });

    it('should identify connection-related messages as retryable', () => {
      const errors = [
        new Error('Connection refused'),
        new Error('connection timeout'),
        new Error('Network error occurred'),
        new Error('TIMEOUT waiting for response'),
      ];

      errors.forEach(error => {
        expect(isRetryableError(error)).toBe(true);
      });
    });

    it('should identify non-retryable errors', () => {
      const errors = [
        new Error('Invalid credentials'),
        { code: 'INVALID_INPUT' },
        new Error('Permission denied'),
        new Error('Not found'),
      ];

      errors.forEach(error => {
        expect(isRetryableError(error)).toBe(false);
      });
    });

    it('should handle null/undefined errors', () => {
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
    });
  });

  describe('retryOnRetryableError()', () => {
    it('should retry only retryable errors', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce({ code: 'ECONNREFUSED' })
        .mockResolvedValue('success');

      const promise = retryOnRetryableError(operation, {
        maxAttempts: 3,
        initialDelay: 100,
      });

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      const nonRetryableError = new Error('Invalid credentials');
      const operation = vi.fn().mockRejectedValue(nonRetryableError);

      const promise = retryOnRetryableError(operation, {
        maxAttempts: 3,
        initialDelay: 100,
      });

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('Invalid credentials');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should call onRetry only for retryable errors', async () => {
      const onRetry = vi.fn();
      const retryableError = { code: 'ETIMEDOUT' };
      
      const operation = vi
        .fn()
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValue('success');

      const promise = retryOnRetryableError(operation, {
        maxAttempts: 3,
        initialDelay: 100,
        onRetry,
      });

      await vi.runAllTimersAsync();
      await promise;

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, retryableError);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle database connection retry', async () => {
      let attempts = 0;
      const dbConnect = async () => {
        attempts++;
        if (attempts < 3) {
          throw { code: 'ECONNREFUSED', message: 'Database unavailable' };
        }
        return { connected: true };
      };

      const promise = retry(dbConnect, {
        maxAttempts: 5,
        initialDelay: 1000,
        backoffMultiplier: 2,
      });

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual({ connected: true });
      expect(attempts).toBe(3);
    });

    it('should handle API retry with timeout', async () => {
      let attempts = 0;
      const apiCall = async () => {
        attempts++;
        if (attempts === 1) {
          throw { code: 'ETIMEDOUT' };
        }
        if (attempts === 2) {
          throw new Error('Network timeout');
        }
        return { data: 'success' };
      };

      const promise = retryOnRetryableError(apiCall, {
        maxAttempts: 3,
        initialDelay: 500,
      });

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual({ data: 'success' });
      expect(attempts).toBe(3);
    });

    it('should fail fast on authentication errors', async () => {
      const apiCall = async () => {
        throw new Error('401 Unauthorized');
      };

      const promise = retryOnRetryableError(apiCall, {
        maxAttempts: 5,
        initialDelay: 1000,
      });

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('401 Unauthorized');
    });
  });
});
