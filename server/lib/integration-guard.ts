import logger from '../middleware/logger';

export interface IntegrationError extends Error {
  statusCode: number;
  provider: string;
  isRetryable: boolean;
  originalError?: Error;
}

export type IntegrationProvider = 'hubspot' | 'google' | 'linkedin' | 'generic';

interface IntegrationGuardOptions {
  provider: IntegrationProvider;
  operation?: string;
  retryable?: boolean;
}

/**
 * Wrap external integration calls with standardized error handling.
 * 
 * - Logs errors with provider context
 * - Surfaces 503 for upstream failures
 * - Provides consistent error structure for callers
 * 
 * @param fn - The async function to execute
 * @param options - Configuration for error handling
 * @returns The result of the function
 * @throws IntegrationError with statusCode 503 on failure
 */
export async function withIntegrationGuard<T>(
  fn: () => Promise<T>,
  options: IntegrationGuardOptions
): Promise<T> {
  const { provider, operation = 'unknown', retryable = true } = options;

  try {
    return await fn();
  } catch (err: any) {
    const errorMessage = err?.message || 'Unknown error';
    const statusCode = err?.response?.status || err?.statusCode || 503;

    logger.error('Integration error', {
      provider,
      operation,
      error: errorMessage,
      statusCode,
      isRetryable: retryable,
    });

    const integrationError: IntegrationError = Object.assign(
      new Error(`Upstream service unavailable: ${provider}`),
      {
        statusCode: 503,
        provider,
        isRetryable: retryable,
        originalError: err,
      }
    );

    throw integrationError;
  }
}

/**
 * Check if an error is an IntegrationError
 */
export function isIntegrationError(error: unknown): error is IntegrationError {
  return (
    error instanceof Error &&
    'statusCode' in error &&
    'provider' in error &&
    'isRetryable' in error
  );
}

/**
 * Determine if an integration needs re-authentication based on error type
 */
export function needsReauth(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const err = error as any;

  // Check for common auth failure patterns
  if (err.response?.status === 401 || err.response?.status === 403) {
    return true;
  }

  if (err.code === 'UNAUTHENTICATED' || err.code === 'invalid_grant') {
    return true;
  }

  const message = err.message?.toLowerCase() || '';
  return (
    message.includes('token expired') ||
    message.includes('invalid_grant') ||
    message.includes('refresh token') ||
    message.includes('unauthorized') ||
    message.includes('authentication required')
  );
}
