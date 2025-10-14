/**
 * Google API Retry Logic with Exponential Backoff
 * Handles transient failures gracefully
 */

import { parseGoogleApiError, isRetryableError, GoogleApiError } from './googleApiErrors';

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
};

/**
 * Execute a function with retry logic and exponential backoff
 * @param fn - Async function to execute
 * @param options - Retry configuration
 * @returns Result from the function or throws GoogleApiError
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: GoogleApiError | null = null;
  let delay = config.initialDelay;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const apiError = parseGoogleApiError(error);
      lastError = apiError;

      // Don't retry if error is not retryable or we're on last attempt
      if (!isRetryableError(apiError) || attempt === config.maxRetries) {
        throw apiError;
      }

      // Log retry attempt
      console.log(`[Google API Retry] Attempt ${attempt + 1}/${config.maxRetries + 1} failed: ${apiError.message}. Retrying in ${delay}ms...`);

      // Wait before retrying
      await sleep(delay);

      // Increase delay with exponential backoff
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Unknown retry error');
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry with jitter (randomized delay to prevent thundering herd)
 */
export async function retryWithJitter<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: GoogleApiError | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const apiError = parseGoogleApiError(error);
      lastError = apiError;

      if (!isRetryableError(apiError) || attempt === config.maxRetries) {
        throw apiError;
      }

      // Calculate delay with jitter (random between 0 and calculated delay)
      const baseDelay = Math.min(
        config.initialDelay * Math.pow(config.backoffMultiplier, attempt),
        config.maxDelay
      );
      const jitteredDelay = Math.random() * baseDelay;

      console.log(`[Google API Retry] Attempt ${attempt + 1}/${config.maxRetries + 1} failed: ${apiError.message}. Retrying in ${Math.round(jitteredDelay)}ms...`);

      await sleep(jitteredDelay);
    }
  }

  throw lastError || new Error('Unknown retry error');
}
