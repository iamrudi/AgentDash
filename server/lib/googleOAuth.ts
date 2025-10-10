import { google } from 'googleapis';

// Google OAuth 2.0 configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:5000/api/oauth/google/callback';

// GA4 Analytics scopes
const SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

/**
 * Create OAuth2 client for Google authentication
 */
export function createOAuth2Client() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) are required');
  }

  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );
}

/**
 * Generate OAuth authorization URL
 * @param state - State parameter for CSRF protection (should include client ID)
 * @returns Authorization URL
 */
export function getAuthUrl(state: string): string {
  const oauth2Client = createOAuth2Client();
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Request refresh token
    scope: SCOPES,
    state,
    prompt: 'consent', // Force consent screen to always get refresh token
  });
}

/**
 * Exchange authorization code for tokens
 * @param code - Authorization code from OAuth callback
 * @returns Access token, refresh token, and expiry
 */
export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = createOAuth2Client();
  
  const { tokens } = await oauth2Client.getToken(code);
  
  return {
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token || null,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
  };
}

/**
 * Refresh an expired access token
 * @param refreshToken - The refresh token
 * @returns New access token and expiry
 */
export async function refreshAccessToken(refreshToken: string) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();
  
  return {
    accessToken: credentials.access_token!,
    expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
  };
}

/**
 * Fetch GA4 properties accessible to the user
 * @param accessToken - Valid access token
 * @returns List of GA4 properties
 */
export async function fetchGA4Properties(accessToken: string) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  const analyticsAdmin = google.analyticsadmin({
    version: 'v1beta',
    auth: oauth2Client,
  });

  try {
    // List all accounts
    const accountsResponse = await analyticsAdmin.accounts.list();
    const accounts = accountsResponse.data.accounts || [];

    const properties: Array<{
      propertyId: string;
      displayName: string;
      accountName: string;
    }> = [];

    // For each account, fetch properties
    for (const account of accounts) {
      if (account.name) {
        const propertiesResponse = await analyticsAdmin.properties.list({
          filter: `parent:${account.name}`,
        });

        const accountProperties = propertiesResponse.data.properties || [];
        
        for (const property of accountProperties) {
          if (property.name && property.displayName) {
            // Extract property ID from name (format: properties/123456789)
            const propertyId = property.name.split('/')[1];
            properties.push({
              propertyId,
              displayName: property.displayName,
              accountName: account.displayName || 'Unknown Account',
            });
          }
        }
      }
    }

    return properties;
  } catch (error) {
    console.error('Error fetching GA4 properties:', error);
    throw new Error('Failed to fetch GA4 properties');
  }
}
