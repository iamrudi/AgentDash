import axios from 'axios';
import { db } from '../db';
import { agencySettings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from './encryption';

const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2';
const LINKEDIN_API_VERSION = '202501'; // Latest API version

export interface LinkedInOrganizationStats {
  organizationId: string;
  followerCount: number;
  name?: string;
}

export interface LinkedInPostStats {
  postId: string;
  impressionCount: number;
  clickCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  engagement: number;
}

export interface LinkedInData {
  organization: LinkedInOrganizationStats | null;
  recentPosts: LinkedInPostStats[];
  totalEngagement: number;
  averageEngagementRate: number;
}

interface LinkedInCredentials {
  accessToken: string;
  organizationId: string;
}

/**
 * Get decrypted LinkedIn credentials for an agency
 */
async function getLinkedInCredentials(agencyId: string): Promise<LinkedInCredentials | null> {
  const settings = await db
    .select()
    .from(agencySettings)
    .where(eq(agencySettings.agencyId, agencyId))
    .limit(1);

  if (settings.length === 0 || !settings[0].linkedinAccessToken || !settings[0].linkedinOrganizationId) {
    return null;
  }

  const setting = settings[0];

  try {
    // Decrypt the access token
    const accessToken = decrypt(
      setting.linkedinAccessToken,
      setting.linkedinAccessTokenIv!,
      setting.linkedinAccessTokenAuthTag!
    );

    return { 
      accessToken,
      organizationId: setting.linkedinOrganizationId!
    };
  } catch (error) {
    console.error('[LinkedIn] Failed to decrypt credentials:', error);
    return null;
  }
}

/**
 * Check if LinkedIn integration is configured for an agency
 */
export async function isLinkedInConfigured(agencyId: string): Promise<boolean> {
  const credentials = await getLinkedInCredentials(agencyId);
  return !!credentials;
}

/**
 * Fetch organization follower statistics from LinkedIn
 */
export async function fetchLinkedInOrganizationStats(agencyId: string): Promise<LinkedInOrganizationStats | null> {
  const credentials = await getLinkedInCredentials(agencyId);
  
  if (!credentials) {
    throw new Error('LinkedIn not connected for this agency');
  }

  try {
    // Get organization follower count
    const response = await axios.get(
      `${LINKEDIN_API_BASE}/networkSizes/urn:li:organization:${credentials.organizationId}`,
      {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'LinkedIn-Version': LINKEDIN_API_VERSION,
          'X-Restli-Protocol-Version': '2.0.0',
        },
        params: {
          edgeType: 'COMPANY_FOLLOWED_BY_MEMBER',
        },
      }
    );

    return {
      organizationId: credentials.organizationId,
      followerCount: response.data.firstDegreeSize || 0,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('[LinkedIn] Organization stats error:', error.response?.data);
      throw new Error(`LinkedIn API error: ${error.response?.data?.message || error.message}`);
    }
    throw error;
  }
}

/**
 * Fetch recent posts from LinkedIn organization
 */
async function fetchLinkedInPosts(agencyId: string, limit: number = 10): Promise<string[]> {
  const credentials = await getLinkedInCredentials(agencyId);
  
  if (!credentials) {
    throw new Error('LinkedIn not connected for this agency');
  }

  try {
    const response = await axios.get(`${LINKEDIN_API_BASE}/shares`, {
      headers: {
        'Authorization': `Bearer ${credentials.accessToken}`,
        'LinkedIn-Version': LINKEDIN_API_VERSION,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      params: {
        q: 'owners',
        owners: `urn:li:organization:${credentials.organizationId}`,
        sharesPerOwner: limit,
      },
    });

    // Extract share IDs from response
    const shares = response.data.elements || [];
    return shares.map((share: any) => {
      const id = share.id || share.$URN;
      return id.replace('urn:li:share:', '');
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('[LinkedIn] Fetch posts error:', error.response?.data);
      // If posts endpoint fails, return empty array instead of throwing
      return [];
    }
    return [];
  }
}

/**
 * Fetch post engagement statistics from LinkedIn
 */
export async function fetchLinkedInPostStats(agencyId: string, shareIds: string[]): Promise<LinkedInPostStats[]> {
  const credentials = await getLinkedInCredentials(agencyId);
  
  if (!credentials) {
    throw new Error('LinkedIn not connected for this agency');
  }

  if (shareIds.length === 0) {
    return [];
  }

  try {
    // Build query parameters for multiple shares
    const params: any = {
      q: 'organizationalEntity',
      organizationalEntity: `urn:li:organization:${credentials.organizationId}`,
    };

    // Add share URNs
    shareIds.forEach((shareId, index) => {
      params[`shares[${index}]`] = `urn:li:share:${shareId}`;
    });

    const response = await axios.get(
      `${LINKEDIN_API_BASE}/organizationalEntityShareStatistics`,
      {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'LinkedIn-Version': LINKEDIN_API_VERSION,
          'X-Restli-Protocol-Version': '2.0.0',
        },
        params,
      }
    );

    const elements = response.data.elements || [];
    return elements.map((element: any) => {
      const stats = element.totalShareStatistics || {};
      const shareId = element.share?.replace('urn:li:share:', '') || '';
      
      return {
        postId: shareId,
        impressionCount: stats.impressionCount || 0,
        clickCount: stats.clickCount || 0,
        likeCount: stats.likeCount || 0,
        commentCount: stats.commentCount || 0,
        shareCount: stats.shareCount || 0,
        engagement: stats.engagement || 0,
      };
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('[LinkedIn] Post stats error:', error.response?.data);
      throw new Error(`LinkedIn API error: ${error.response?.data?.message || error.message}`);
    }
    throw error;
  }
}

/**
 * Fetch all LinkedIn data for a specific agency
 */
export async function fetchLinkedInData(agencyId: string): Promise<LinkedInData> {
  // Fetch organization stats
  const organizationStats = await fetchLinkedInOrganizationStats(agencyId);
  
  // Fetch recent posts
  const shareIds = await fetchLinkedInPosts(agencyId, 10);
  
  // Fetch post statistics
  const postStats = shareIds.length > 0 
    ? await fetchLinkedInPostStats(agencyId, shareIds)
    : [];

  // Calculate total engagement
  const totalEngagement = postStats.reduce((total, post) => {
    return total + post.likeCount + post.commentCount + post.shareCount;
  }, 0);

  // Calculate average engagement rate
  const averageEngagementRate = postStats.length > 0
    ? postStats.reduce((total, post) => total + post.engagement, 0) / postStats.length
    : 0;

  return {
    organization: organizationStats,
    recentPosts: postStats,
    totalEngagement,
    averageEngagementRate,
  };
}

/**
 * Get LinkedIn connection status for a specific agency
 */
export async function getLinkedInStatus(agencyId: string): Promise<{ 
  connected: boolean; 
  followerCount?: number;
  postCount?: number;
  totalEngagement?: number;
  error?: string;
}> {
  const configured = await isLinkedInConfigured(agencyId);
  if (!configured) {
    return { connected: false };
  }

  try {
    // Test connection and fetch basic stats
    const data = await fetchLinkedInData(agencyId);
    return { 
      connected: true,
      followerCount: data.organization?.followerCount,
      postCount: data.recentPosts.length,
      totalEngagement: data.totalEngagement,
    };
  } catch (error) {
    return { 
      connected: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
