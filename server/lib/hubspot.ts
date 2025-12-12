import axios from 'axios';
import { db } from '../db';
import { agencySettings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from './encryption';
import { withIntegrationGuard, needsReauth } from './integration-guard';
import logger from '../middleware/logger';

const HUBSPOT_API_BASE = 'https://api.hubapi.com';

export interface HubSpotContact {
  id: string;
  properties: {
    email?: string;
    firstname?: string;
    lastname?: string;
    company?: string;
    phone?: string;
    lifecyclestage?: string;
    createdate?: string;
    lastmodifieddate?: string;
  };
}

export interface HubSpotDeal {
  id: string;
  properties: {
    dealname?: string;
    amount?: string;
    dealstage?: string;
    pipeline?: string;
    closedate?: string;
    createdate?: string;
    hs_lastmodifieddate?: string;
  };
}

export interface HubSpotCompany {
  id: string;
  properties: {
    name?: string;
    domain?: string;
    industry?: string;
    numberofemployees?: string;
    annualrevenue?: string;
    createdate?: string;
    hs_lastmodifieddate?: string;
  };
}

export interface HubSpotCRMData {
  contacts: HubSpotContact[];
  deals: HubSpotDeal[];
  companies: HubSpotCompany[];
  totalContacts: number;
  totalDeals: number;
  totalCompanies: number;
  dealValue: number;
}

interface HubSpotCredentials {
  accessToken: string;
}

/**
 * Get decrypted HubSpot credentials for an agency
 */
async function getHubSpotCredentials(agencyId: string): Promise<HubSpotCredentials | null> {
  const settings = await db
    .select()
    .from(agencySettings)
    .where(eq(agencySettings.agencyId, agencyId))
    .limit(1);

  if (settings.length === 0 || !settings[0].hubspotAccessToken) {
    return null;
  }

  const setting = settings[0];

  try {
    // Decrypt the access token
    const accessToken = decrypt(
      setting.hubspotAccessToken,
      setting.hubspotAccessTokenIv!,
      setting.hubspotAccessTokenAuthTag!
    );

    return { accessToken };
  } catch (error) {
    logger.error('Failed to decrypt HubSpot credentials', { agencyId, error });
    return null;
  }
}

/**
 * Check if HubSpot integration is configured for an agency
 */
export async function isHubSpotConfigured(agencyId: string): Promise<boolean> {
  const credentials = await getHubSpotCredentials(agencyId);
  return !!credentials;
}

/**
 * Fetch contacts from HubSpot for a specific agency
 */
export async function fetchHubSpotContacts(agencyId: string, limit: number = 100): Promise<HubSpotContact[]> {
  const credentials = await getHubSpotCredentials(agencyId);
  
  if (!credentials) {
    throw new Error('HubSpot not connected for this agency');
  }

  return withIntegrationGuard(
    async () => {
      const response = await axios.get(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts`, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
        params: {
          limit,
          properties: 'email,firstname,lastname,company,phone,lifecyclestage,createdate,lastmodifieddate',
        },
      });
      return response.data.results || [];
    },
    { provider: 'hubspot', operation: 'fetchContacts' }
  );
}

/**
 * Fetch deals from HubSpot for a specific agency
 */
export async function fetchHubSpotDeals(agencyId: string, limit: number = 100): Promise<HubSpotDeal[]> {
  const credentials = await getHubSpotCredentials(agencyId);
  
  if (!credentials) {
    throw new Error('HubSpot not connected for this agency');
  }

  return withIntegrationGuard(
    async () => {
      const response = await axios.get(`${HUBSPOT_API_BASE}/crm/v3/objects/deals`, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
        params: {
          limit,
          properties: 'dealname,amount,dealstage,pipeline,closedate,createdate,hs_lastmodifieddate',
        },
      });
      return response.data.results || [];
    },
    { provider: 'hubspot', operation: 'fetchDeals' }
  );
}

/**
 * Fetch companies from HubSpot for a specific agency
 */
export async function fetchHubSpotCompanies(agencyId: string, limit: number = 100): Promise<HubSpotCompany[]> {
  const credentials = await getHubSpotCredentials(agencyId);
  
  if (!credentials) {
    throw new Error('HubSpot not connected for this agency');
  }

  return withIntegrationGuard(
    async () => {
      const response = await axios.get(`${HUBSPOT_API_BASE}/crm/v3/objects/companies`, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
        params: {
          limit,
          properties: 'name,domain,industry,numberofemployees,annualrevenue,createdate,hs_lastmodifieddate',
        },
      });
      return response.data.results || [];
    },
    { provider: 'hubspot', operation: 'fetchCompanies' }
  );
}

/**
 * Fetch all CRM data from HubSpot for a specific agency
 */
export async function fetchHubSpotCRMData(agencyId: string): Promise<HubSpotCRMData> {
  const [contacts, deals, companies] = await Promise.all([
    fetchHubSpotContacts(agencyId),
    fetchHubSpotDeals(agencyId),
    fetchHubSpotCompanies(agencyId),
  ]);

  // Calculate total deal value
  const dealValue = deals.reduce((total, deal) => {
    const amount = parseFloat(deal.properties.amount || '0');
    return total + amount;
  }, 0);

  return {
    contacts,
    deals,
    companies,
    totalContacts: contacts.length,
    totalDeals: deals.length,
    totalCompanies: companies.length,
    dealValue,
  };
}

/**
 * Get HubSpot connection status for a specific agency
 */
export async function getHubSpotStatus(agencyId: string): Promise<{ connected: boolean; contactCount?: number; dealCount?: number; companyCount?: number; error?: string }> {
  const configured = await isHubSpotConfigured(agencyId);
  if (!configured) {
    return { connected: false };
  }

  try {
    // Test connection and fetch basic stats
    const data = await fetchHubSpotCRMData(agencyId);
    return { 
      connected: true,
      contactCount: data.totalContacts,
      dealCount: data.totalDeals,
      companyCount: data.totalCompanies,
    };
  } catch (error) {
    return { 
      connected: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
