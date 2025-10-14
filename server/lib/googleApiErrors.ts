/**
 * Google API Error Handling
 * Provides user-friendly error messages and error type classification
 */

export enum GoogleApiErrorType {
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  INVALID_PROPERTY = 'INVALID_PROPERTY',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN = 'UNKNOWN',
}

export interface GoogleApiError {
  type: GoogleApiErrorType;
  message: string;
  userMessage: string;
  isRetryable: boolean;
  originalError?: any;
}

/**
 * Parse Google API errors and provide user-friendly messages
 */
export function parseGoogleApiError(error: any): GoogleApiError {
  const statusCode = error?.response?.status || error?.code || error?.statusCode;
  const errorMessage = error?.message || error?.response?.data?.error?.message || 'Unknown error';

  // Quota exceeded (429 or specific quota error)
  if (statusCode === 429 || errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('rate limit')) {
    return {
      type: GoogleApiErrorType.QUOTA_EXCEEDED,
      message: 'Google API quota exceeded',
      userMessage: 'Google API quota limit reached. Please try again later or contact support to increase your quota.',
      isRetryable: true,
      originalError: error,
    };
  }

  // Token expired (401)
  if (statusCode === 401 || errorMessage.toLowerCase().includes('invalid_grant') || errorMessage.toLowerCase().includes('token expired')) {
    return {
      type: GoogleApiErrorType.TOKEN_EXPIRED,
      message: 'Access token expired',
      userMessage: 'Your Google connection has expired. Please reconnect your Google account.',
      isRetryable: false,
      originalError: error,
    };
  }

  // Insufficient permissions (403)
  if (statusCode === 403 || errorMessage.toLowerCase().includes('permission') || errorMessage.toLowerCase().includes('forbidden')) {
    return {
      type: GoogleApiErrorType.INSUFFICIENT_PERMISSIONS,
      message: 'Insufficient permissions',
      userMessage: 'You don\'t have permission to access this Google Analytics property or Search Console site. Please ensure you have the correct access level.',
      isRetryable: false,
      originalError: error,
    };
  }

  // Invalid property/site (400 or specific property error)
  if (statusCode === 400 || errorMessage.toLowerCase().includes('property') || errorMessage.toLowerCase().includes('does not exist')) {
    return {
      type: GoogleApiErrorType.INVALID_PROPERTY,
      message: 'Invalid property or site',
      userMessage: 'The selected property or site is no longer available. Please reconfigure your integration.',
      isRetryable: false,
      originalError: error,
    };
  }

  // Network/connection errors
  if (error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT' || errorMessage.toLowerCase().includes('network')) {
    return {
      type: GoogleApiErrorType.NETWORK_ERROR,
      message: 'Network connection error',
      userMessage: 'Unable to connect to Google servers. Please check your internet connection and try again.',
      isRetryable: true,
      originalError: error,
    };
  }

  // Unknown error
  return {
    type: GoogleApiErrorType.UNKNOWN,
    message: errorMessage,
    userMessage: `An unexpected error occurred: ${errorMessage}. Please try again or contact support if the issue persists.`,
    isRetryable: true,
    originalError: error,
  };
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: GoogleApiError): boolean {
  return error.isRetryable && (
    error.type === GoogleApiErrorType.QUOTA_EXCEEDED ||
    error.type === GoogleApiErrorType.NETWORK_ERROR ||
    error.type === GoogleApiErrorType.UNKNOWN
  );
}
