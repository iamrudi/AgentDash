import axios from 'axios';

const DATAFORSEO_API_BASE = 'https://api.dataforseo.com/v3';

export interface DataForSeoCredentials {
  login: string;
  password: string;
}

export interface SerpResult {
  keyword: string;
  location: string;
  items: SerpItem[];
}

export interface SerpItem {
  position: number;
  url: string;
  title: string;
  description: string;
  domain: string;
}

export interface ContentGapResult {
  keyword: string;
  searchVolume: number;
  keyword_difficulty: number;
  cpc: number;
}

export interface CompetitorAnalysis {
  url: string;
  title: string;
  word_count: number;
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
  };
  meta_description: string;
}

export interface PeopleAlsoAsk {
  question: string;
  answer: string;
  url: string;
}

/**
 * Fetch SERP data for a keyword to analyze top ranking pages
 */
export async function getSerpData(
  credentials: DataForSeoCredentials,
  keyword: string,
  location: string = 'United States'
): Promise<SerpResult> {
  try {
    const authString = Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64');
    
    const response = await axios.post(
      `${DATAFORSEO_API_BASE}/serp/google/organic/live/advanced`,
      [{
        keyword,
        location_name: location,
        language_code: 'en',
        device: 'desktop',
        os: 'windows',
        depth: 10 // Get top 10 results
      }],
      {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const tasks = response.data?.tasks || [];
    if (tasks.length === 0 || !tasks[0].result) {
      throw new Error('No SERP data returned');
    }

    const result = tasks[0].result[0];
    const items: SerpItem[] = (result.items || [])
      .filter((item: any) => item.type === 'organic')
      .map((item: any) => ({
        position: item.rank_absolute || 0,
        url: item.url || '',
        title: item.title || '',
        description: item.description || '',
        domain: item.domain || ''
      }));

    return {
      keyword,
      location,
      items
    };
  } catch (error: any) {
    console.error('Data for SEO SERP API error:', error.response?.data || error.message);
    throw new Error(`Failed to fetch SERP data: ${error.message}`);
  }
}

/**
 * Perform content gap analysis - find keywords competitors rank for but client doesn't
 */
export async function getContentGapKeywords(
  credentials: DataForSeoCredentials,
  clientDomain: string,
  competitorDomains: string[],
  limit: number = 50
): Promise<ContentGapResult[]> {
  try {
    const authString = Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64');
    
    // Get keywords that competitors rank for
    const response = await axios.post(
      `${DATAFORSEO_API_BASE}/dataforseo_labs/google/domain_intersection/live`,
      [{
        target1: competitorDomains[0],
        target2: competitorDomains[1] || competitorDomains[0],
        exclude_target: clientDomain, // Exclude keywords client already ranks for
        location_code: 2840, // United States
        language_code: 'en',
        limit
      }],
      {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const tasks = response.data?.tasks || [];
    if (tasks.length === 0 || !tasks[0].result) {
      return [];
    }

    const items = tasks[0].result[0]?.items || [];
    return items.map((item: any) => ({
      keyword: item.keyword_data?.keyword || '',
      searchVolume: item.keyword_data?.keyword_info?.search_volume || 0,
      keyword_difficulty: item.keyword_data?.keyword_properties?.keyword_difficulty || 0,
      cpc: item.keyword_data?.keyword_info?.cpc || 0
    }));
  } catch (error: any) {
    console.error('Data for SEO content gap API error:', error.response?.data || error.message);
    throw new Error(`Failed to get content gap keywords: ${error.message}`);
  }
}

/**
 * Get detailed on-page analysis for a URL
 */
export async function getOnPageAnalysis(
  credentials: DataForSeoCredentials,
  url: string
): Promise<CompetitorAnalysis> {
  try {
    const authString = Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64');
    
    const response = await axios.post(
      `${DATAFORSEO_API_BASE}/on_page/instant_pages`,
      [{
        url,
        enable_javascript: false,
        custom_js: null
      }],
      {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const tasks = response.data?.tasks || [];
    if (tasks.length === 0 || !tasks[0].result) {
      throw new Error('No on-page data returned');
    }

    const result = tasks[0].result[0];
    const items = result.items || [];
    const pageData = items[0] || {};

    // Extract headings
    const headings = {
      h1: [] as string[],
      h2: [] as string[],
      h3: [] as string[]
    };

    if (pageData.meta?.htags) {
      headings.h1 = pageData.meta.htags.h1 || [];
      headings.h2 = pageData.meta.htags.h2 || [];
      headings.h3 = pageData.meta.htags.h3 || [];
    }

    return {
      url,
      title: pageData.meta?.title || '',
      word_count: pageData.meta?.content?.plain_text_word_count || 0,
      headings,
      meta_description: pageData.meta?.description || ''
    };
  } catch (error: any) {
    console.error('Data for SEO on-page API error:', error.response?.data || error.message);
    throw new Error(`Failed to get on-page analysis: ${error.message}`);
  }
}

/**
 * Get "People Also Ask" questions for a keyword
 */
export async function getPeopleAlsoAsk(
  credentials: DataForSeoCredentials,
  keyword: string
): Promise<PeopleAlsoAsk[]> {
  try {
    const authString = Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64');
    
    const response = await axios.post(
      `${DATAFORSEO_API_BASE}/serp/google/organic/live/advanced`,
      [{
        keyword,
        location_name: 'United States',
        language_code: 'en',
        device: 'desktop'
      }],
      {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const tasks = response.data?.tasks || [];
    if (tasks.length === 0 || !tasks[0].result) {
      return [];
    }

    const result = tasks[0].result[0];
    const items = result.items || [];
    
    // Find "People Also Ask" section
    const paaItems = items.filter((item: any) => item.type === 'people_also_ask');
    
    if (paaItems.length === 0) {
      return [];
    }

    return paaItems.flatMap((item: any) => 
      (item.items || []).map((q: any) => ({
        question: q.title || '',
        answer: q.snippet || '',
        url: q.url || ''
      }))
    );
  } catch (error: any) {
    console.error('Data for SEO PAA API error:', error.response?.data || error.message);
    // Don't throw - PAA is optional data
    return [];
  }
}
