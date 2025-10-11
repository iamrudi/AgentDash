import { google } from 'googleapis';

// Google OAuth 2.0 configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:5000/api/oauth/google/callback';

// Google service scopes
const GA4_SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

const GSC_SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

const ALL_SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

export type GoogleService = 'GA4' | 'GSC' | 'BOTH';

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
 * Get scopes for a specific service
 * @param service - Which Google service(s) to authenticate
 * @returns Array of OAuth scopes
 */
function getScopes(service: GoogleService): string[] {
  switch (service) {
    case 'GA4':
      return GA4_SCOPES;
    case 'GSC':
      return GSC_SCOPES;
    case 'BOTH':
      return ALL_SCOPES;
    default:
      return ALL_SCOPES;
  }
}

/**
 * Generate OAuth authorization URL
 * @param state - State parameter for CSRF protection (should include client ID)
 * @param service - Which Google service(s) to authenticate for
 * @returns Authorization URL
 */
export function getAuthUrl(state: string, service: GoogleService = 'BOTH'): string {
  const oauth2Client = createOAuth2Client();
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Request refresh token
    scope: getScopes(service),
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

/**
 * Fetch Google Search Console sites accessible to the user
 * @param accessToken - Valid access token
 * @returns List of Search Console sites
 */
export async function fetchGSCSites(accessToken: string) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  const searchconsole = google.searchconsole({
    version: 'v1',
    auth: oauth2Client,
  });

  try {
    const sitesResponse = await searchconsole.sites.list();
    const sites = sitesResponse.data.siteEntry || [];

    return sites.map(site => ({
      siteUrl: site.siteUrl || '',
      permissionLevel: site.permissionLevel || 'UNKNOWN',
    }));
  } catch (error) {
    console.error('Error fetching Search Console sites:', error);
    throw new Error('Failed to fetch Search Console sites');
  }
}

/**
 * Fetch GA4 analytics data
 * @param accessToken - Valid access token
 * @param propertyId - GA4 property ID
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @returns Analytics data
 */
export async function fetchGA4Data(
  accessToken: string,
  propertyId: string,
  startDate: string,
  endDate: string
) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  const analyticsData = google.analyticsdata({
    version: 'v1beta',
    auth: oauth2Client,
  });

  try {
    const response = await analyticsData.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'screenPageViews' },
          { name: 'engagedSessions' },
        ],
        dimensions: [{ name: 'date' }],
      },
    });

    return {
      rows: response.data.rows || [],
      totals: response.data.totals || [],
      rowCount: response.data.rowCount || 0,
    };
  } catch (error: any) {
    console.error('Error fetching GA4 data:', error);
    throw new Error('Failed to fetch GA4 analytics data');
  }
}

/**
 * Fetch GA4 acquisition channels data
 * @param accessToken - Valid access token
 * @param propertyId - GA4 property ID
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @returns Acquisition channels data
 */
export async function fetchGA4AcquisitionChannels(
  accessToken: string,
  propertyId: string,
  startDate: string,
  endDate: string
) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  const analyticsData = google.analyticsdata({
    version: 'v1beta',
    auth: oauth2Client,
  });

  try {
    const response = await analyticsData.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
        ],
        dimensions: [{ name: 'sessionDefaultChannelGrouping' }],
      },
    });

    return {
      rows: response.data.rows || [],
      totals: response.data.totals || [],
      rowCount: response.data.rowCount || 0,
    };
  } catch (error: any) {
    console.error('Error fetching GA4 acquisition channels data:', error);
    throw new Error('Failed to fetch GA4 acquisition channels data');
  }
}

/**
 * Fetch GA4 Key Events (conversions) data
 * Supports multiple event names (comma-separated)
 * @param accessToken - Valid access token
 * @param propertyId - GA4 property ID
 * @param eventNames - Event name(s) to filter (e.g., "generate_lead" or "form_submit, generate_lead, Main_Form")
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @returns Key Events data with totals
 */
export async function fetchGA4KeyEvents(
  accessToken: string,
  propertyId: string,
  eventNames: string,
  startDate: string,
  endDate: string
) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  const analyticsData = google.analyticsdata({
    version: 'v1beta',
    auth: oauth2Client,
  });

  // Parse comma-separated event names and trim whitespace
  const eventList = eventNames.split(',').map(name => name.trim()).filter(name => name.length > 0);

  try {
    // Build dimension filter for multiple events
    let dimensionFilter: any;
    
    if (eventList.length === 1) {
      // Single event: use simple EXACT match
      dimensionFilter = {
        filter: {
          fieldName: 'eventName',
          stringFilter: {
            matchType: 'EXACT',
            value: eventList[0],
          },
        },
      };
    } else {
      // Multiple events: use OR filter with EXACT matches
      dimensionFilter = {
        orGroup: {
          expressions: eventList.map(eventName => ({
            filter: {
              fieldName: 'eventName',
              stringFilter: {
                matchType: 'EXACT',
                value: eventName,
              },
            },
          })),
        },
      };
    }

    const response = await analyticsData.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: 'eventCount' },
        ],
        dimensions: [{ name: 'eventName' }],
        dimensionFilter,
      },
    });

    // Calculate total from all matching events
    let totalEventCount = 0;
    if (response.data.rows && response.data.rows.length > 0) {
      totalEventCount = response.data.rows.reduce((sum, row) => {
        const eventCount = parseInt(row.metricValues?.[0]?.value || '0', 10);
        return sum + eventCount;
      }, 0);
    }

    return {
      rows: response.data.rows || [],
      totals: response.data.totals || [{ metricValues: [{ value: totalEventCount.toString() }] }],
      rowCount: response.data.rowCount || 0,
      totalEventCount,
      eventNames: eventList, // Return the list of events queried
    };
  } catch (error: any) {
    console.error('Error fetching GA4 Key Events data:', error);
    throw new Error('Failed to fetch GA4 Key Events data');
  }
}

/**
 * Fetch Google Search Console analytics data
 * @param accessToken - Valid access token
 * @param siteUrl - GSC site URL
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @returns Search Console data
 */
export async function fetchGSCData(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string
) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  const searchconsole = google.searchconsole({
    version: 'v1',
    auth: oauth2Client,
  });

  try {
    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['date'],
        rowLimit: 1000,
      },
    });

    return {
      rows: response.data.rows || [],
    };
  } catch (error: any) {
    console.error('Error fetching GSC data:', error);
    throw new Error('Failed to fetch Search Console data');
  }
}

/**
 * Fetch Google Search Console top queries
 * @param accessToken - Valid access token
 * @param siteUrl - GSC site URL
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @returns Top performing queries
 */
export async function fetchGSCTopQueries(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string
) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  const searchconsole = google.searchconsole({
    version: 'v1',
    auth: oauth2Client,
  });

  try {
    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['query'],
        rowLimit: 25,
      },
    });

    console.log('=== GSC TOP QUERIES API RESPONSE ===', JSON.stringify({
      siteUrl,
      dateRange: `${startDate} to ${endDate}`,
      hasRows: !!response.data.rows,
      rowCount: response.data.rows?.length || 0,
      sampleRow: response.data.rows?.[0] || null,
      fullResponse: response.data
    }, null, 2));

    return {
      rows: response.data.rows || [],
    };
  } catch (error: any) {
    console.error('Error fetching GSC top queries:', error);
    throw new Error('Failed to fetch top queries');
  }
}
