/**
 * Retry utility with exponential backoff
 * Used for resilient database connections and external API calls
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: any) => void;
}

const defaultOptions: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  onRetry: () => {},
};

/**
 * Retry an async operation with exponential backoff
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: any;
  let delay = opts.initialDelay;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt < opts.maxAttempts) {
        opts.onRetry(attempt, error);

        // Wait before retry
        await sleep(Math.min(delay, opts.maxDelay));

        // Exponential backoff
        delay *= opts.backoffMultiplier;
      }
    }
  }

  throw lastError;
}

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable (connection errors, timeouts, etc.)
 */
export function isRetryableError(error: any): boolean {
  if (!error) return false;

  const retryableCodes = [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ENETUNREACH',
    'EPIPE',
    'ECONNRESET',
    'PROTOCOL_CONNECTION_LOST',
  ];

  const errorCode = error.code || error.errno;
  const errorMessage = error.message?.toLowerCase() || '';

  return (
    retryableCodes.includes(errorCode) ||
    errorMessage.includes('connection') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('network')
  );
}

/**
 * Retry only if error is retryable
 */
export async function retryOnRetryableError<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  return retry(operation, {
    ...options,
    onRetry: (attempt, error) => {
      if (!isRetryableError(error)) {
        throw error; // Don't retry non-retryable errors
      }
      options.onRetry?.(attempt, error);
    },
  });
}
