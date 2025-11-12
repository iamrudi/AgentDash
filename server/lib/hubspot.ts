import axios from 'axios';

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

/**
 * Check if HubSpot integration is configured
 */
export function isHubSpotConfigured(): boolean {
  return !!process.env.HUBSPOT_ACCESS_TOKEN;
}

/**
 * Fetch contacts from HubSpot
 */
export async function fetchHubSpotContacts(limit: number = 100): Promise<HubSpotContact[]> {
  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
  
  if (!accessToken) {
    throw new Error('HubSpot access token not configured');
  }

  try {
    const response = await axios.get(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      params: {
        limit,
        properties: 'email,firstname,lastname,company,phone,lifecyclestage,createdate,lastmodifieddate',
      },
    });

    return response.data.results || [];
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`HubSpot API error: ${error.response?.data?.message || error.message}`);
    }
    throw error;
  }
}

/**
 * Fetch deals from HubSpot
 */
export async function fetchHubSpotDeals(limit: number = 100): Promise<HubSpotDeal[]> {
  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
  
  if (!accessToken) {
    throw new Error('HubSpot access token not configured');
  }

  try {
    const response = await axios.get(`${HUBSPOT_API_BASE}/crm/v3/objects/deals`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      params: {
        limit,
        properties: 'dealname,amount,dealstage,pipeline,closedate,createdate,hs_lastmodifieddate',
      },
    });

    return response.data.results || [];
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`HubSpot API error: ${error.response?.data?.message || error.message}`);
    }
    throw error;
  }
}

/**
 * Fetch companies from HubSpot
 */
export async function fetchHubSpotCompanies(limit: number = 100): Promise<HubSpotCompany[]> {
  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
  
  if (!accessToken) {
    throw new Error('HubSpot access token not configured');
  }

  try {
    const response = await axios.get(`${HUBSPOT_API_BASE}/crm/v3/objects/companies`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      params: {
        limit,
        properties: 'name,domain,industry,numberofemployees,annualrevenue,createdate,hs_lastmodifieddate',
      },
    });

    return response.data.results || [];
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`HubSpot API error: ${error.response?.data?.message || error.message}`);
    }
    throw error;
  }
}

/**
 * Fetch all CRM data from HubSpot (contacts, deals, companies)
 */
export async function fetchHubSpotCRMData(): Promise<HubSpotCRMData> {
  const [contacts, deals, companies] = await Promise.all([
    fetchHubSpotContacts(),
    fetchHubSpotDeals(),
    fetchHubSpotCompanies(),
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
 * Get HubSpot connection status
 */
export async function getHubSpotStatus(): Promise<{ connected: boolean; error?: string }> {
  if (!isHubSpotConfigured()) {
    return { connected: false };
  }

  try {
    // Test connection by fetching a single contact
    await fetchHubSpotContacts(1);
    return { connected: true };
  } catch (error) {
    return { 
      connected: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
