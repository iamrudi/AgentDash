import crypto from 'crypto';

// State signing key from environment - REQUIRED in production
const STATE_SECRET = process.env.JWT_SECRET;

if (!STATE_SECRET) {
  throw new Error('JWT_SECRET environment variable is required for OAuth state signing');
}

interface OAuthState {
  clientId: string;
  initiatedBy: string;
  service: 'GA4' | 'GSC' | 'BOTH';
  returnTo: string;
  timestamp: number;
  popup?: boolean;
  origin?: string;
}

/**
 * Generate a cryptographically signed OAuth state parameter
 * @param clientId - The client ID for this OAuth flow
 * @param initiatedBy - The role of the user who initiated (Admin/Client)
 * @param service - Which Google service(s) to authenticate (GA4, GSC, or BOTH)
 * @param returnTo - The path to redirect to after successful authentication
 * @param popup - Whether OAuth is initiated in a popup window
 * @param origin - The origin of the initiating window (for postMessage security)
 * @returns Signed state string
 */
export function generateOAuthState(clientId: string, initiatedBy: string, service: 'GA4' | 'GSC' | 'BOTH' = 'BOTH', returnTo: string = '/agency/integrations', popup?: boolean, origin?: string): string {
  const state: OAuthState = {
    clientId,
    initiatedBy,
    service,
    returnTo,
    timestamp: Date.now(),
    ...(popup && { popup }),
    ...(origin && { origin }),
  };

  const payload = JSON.stringify(state);
  const payloadBase64 = Buffer.from(payload).toString('base64url');
  
  // Create HMAC signature
  const hmac = crypto.createHmac('sha256', STATE_SECRET);
  hmac.update(payloadBase64);
  const signature = hmac.digest('base64url');

  // Combine payload and signature
  return `${payloadBase64}.${signature}`;
}

/**
 * Verify and parse a signed OAuth state parameter
 * @param signedState - The signed state string
 * @returns Parsed state object if valid, throws error if invalid
 */
export function verifyOAuthState(signedState: string): OAuthState {
  const parts = signedState.split('.');
  
  if (parts.length !== 2) {
    throw new Error('Invalid state format');
  }

  const [payloadBase64, signature] = parts;

  // Verify signature
  const hmac = crypto.createHmac('sha256', STATE_SECRET);
  hmac.update(payloadBase64);
  const expectedSignature = hmac.digest('base64url');

  if (signature !== expectedSignature) {
    throw new Error('Invalid state signature - possible CSRF attack');
  }

  // Decode payload
  const payload = Buffer.from(payloadBase64, 'base64url').toString('utf8');
  const state: OAuthState = JSON.parse(payload);

  // Verify timestamp (state expires after 10 minutes)
  const maxAge = 10 * 60 * 1000; // 10 minutes
  if (Date.now() - state.timestamp > maxAge) {
    throw new Error('State expired - please restart OAuth flow');
  }

  return state;
}
