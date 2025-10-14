import { SeoAuditService } from './seoAuditService';
import { 
  getOnPageAnalysis, 
  getSerpData, 
  getPeopleAlsoAsk,
  DataForSeoCredentials,
  CompetitorAnalysis,
  SerpResult,
  PeopleAlsoAsk
} from '../lib/dataForSeo';

export interface EnhancedAuditResult {
  // Lighthouse data
  lighthouseReport: any;
  
  // Data for SEO insights
  onPageAnalysis?: CompetitorAnalysis;
  serpAnalysis?: {
    keyword: string;
    currentPosition?: number;
    topCompetitors: {
      position: number;
      url: string;
      title: string;
      domain: string;
    }[];
  };
  peopleAlsoAsk?: PeopleAlsoAsk[];
  
  // Combined insights
  insights: {
    lighthouseScore: {
      seo: number;
      performance: number;
      accessibility: number;
      bestPractices: number;
    };
    technicalSeo: {
      wordCount: number;
      h1Count: number;
      h2Count: number;
      h3Count: number;
      hasMetaDescription: boolean;
      metaDescriptionLength?: number;
    };
    competitivePosition?: {
      keyword: string;
      yourPosition?: number;
      topCompetitorDomains: string[];
    };
    contentOpportunities: string[];
  };
}

export class EnhancedSeoAuditService {
  private lighthouseService: SeoAuditService;

  constructor() {
    this.lighthouseService = new SeoAuditService();
  }

  /**
   * Run comprehensive SEO audit combining Lighthouse + Data for SEO
   */
  async runEnhancedAudit(
    url: string,
    targetKeyword?: string,
    dataForSeoCredentials?: DataForSeoCredentials
  ): Promise<EnhancedAuditResult> {
    // Always run Lighthouse audit
    const lighthouseReport = await this.lighthouseService.runLighthouseAudit(url);

    // Initialize result with Lighthouse data
    const result: EnhancedAuditResult = {
      lighthouseReport,
      insights: {
        lighthouseScore: {
          seo: lighthouseReport?.categories?.seo?.score * 100 || 0,
          performance: lighthouseReport?.categories?.performance?.score * 100 || 0,
          accessibility: lighthouseReport?.categories?.accessibility?.score * 100 || 0,
          bestPractices: lighthouseReport?.categories?.['best-practices']?.score * 100 || 0,
        },
        technicalSeo: {
          wordCount: 0,
          h1Count: 0,
          h2Count: 0,
          h3Count: 0,
          hasMetaDescription: false,
        },
        contentOpportunities: [],
      },
    };

    // If Data for SEO credentials are provided, enhance with additional data
    if (dataForSeoCredentials) {
      try {
        // 1. Get on-page analysis
        const onPageAnalysis = await getOnPageAnalysis(dataForSeoCredentials, url);
        result.onPageAnalysis = onPageAnalysis;

        // Update technical SEO insights
        result.insights.technicalSeo = {
          wordCount: onPageAnalysis.word_count,
          h1Count: onPageAnalysis.headings.h1.length,
          h2Count: onPageAnalysis.headings.h2.length,
          h3Count: onPageAnalysis.headings.h3.length,
          hasMetaDescription: !!onPageAnalysis.meta_description,
          metaDescriptionLength: onPageAnalysis.meta_description?.length,
        };

        // 2. If target keyword is provided, get SERP analysis
        if (targetKeyword) {
          const serpData = await getSerpData(dataForSeoCredentials, targetKeyword);
          
          // Find if the audited URL is ranking
          const urlDomain = new URL(url).hostname.replace('www.', '');
          const currentRanking = serpData.items.find(item => 
            item.domain.replace('www.', '') === urlDomain
          );

          result.serpAnalysis = {
            keyword: targetKeyword,
            currentPosition: currentRanking?.position,
            topCompetitors: serpData.items.slice(0, 5).map(item => ({
              position: item.position,
              url: item.url,
              title: item.title,
              domain: item.domain,
            })),
          };

          result.insights.competitivePosition = {
            keyword: targetKeyword,
            yourPosition: currentRanking?.position,
            topCompetitorDomains: serpData.items.slice(0, 5).map(item => item.domain),
          };

          // 3. Get People Also Ask questions for content opportunities
          const paaQuestions = await getPeopleAlsoAsk(dataForSeoCredentials, targetKeyword);
          result.peopleAlsoAsk = paaQuestions;

          // Add PAA questions as content opportunities
          if (paaQuestions.length > 0) {
            result.insights.contentOpportunities.push(
              `Consider answering these ${paaQuestions.length} "People Also Ask" questions in your content`
            );
          }
        }

        // Generate content opportunities based on technical analysis
        if (result.insights.technicalSeo.wordCount < 300) {
          result.insights.contentOpportunities.push(
            `Content is too short (${result.insights.technicalSeo.wordCount} words). Aim for at least 800-1000 words for better SEO`
          );
        }

        if (result.insights.technicalSeo.h1Count === 0) {
          result.insights.contentOpportunities.push('Missing H1 heading - add a clear main heading');
        } else if (result.insights.technicalSeo.h1Count > 1) {
          result.insights.contentOpportunities.push(`Multiple H1 headings found (${result.insights.technicalSeo.h1Count}). Use only one H1 per page`);
        }

        if (result.insights.technicalSeo.h2Count < 3) {
          result.insights.contentOpportunities.push('Add more H2 subheadings to improve content structure');
        }

        if (!result.insights.technicalSeo.hasMetaDescription) {
          result.insights.contentOpportunities.push('Missing meta description - add one to improve click-through rates');
        } else if (result.insights.technicalSeo.metaDescriptionLength) {
          if (result.insights.technicalSeo.metaDescriptionLength < 120) {
            result.insights.contentOpportunities.push(`Meta description is too short (${result.insights.technicalSeo.metaDescriptionLength} chars). Aim for 150-160 characters`);
          } else if (result.insights.technicalSeo.metaDescriptionLength > 160) {
            result.insights.contentOpportunities.push(`Meta description is too long (${result.insights.technicalSeo.metaDescriptionLength} chars). Keep it under 160 characters`);
          }
        }

      } catch (error: any) {
        console.error('Enhanced SEO audit - Data for SEO error:', error);
        // Continue without Data for SEO data - we still have Lighthouse results
        result.insights.contentOpportunities.push('Data for SEO analysis unavailable');
      }
    } else {
      result.insights.contentOpportunities.push('Connect Data for SEO for advanced keyword and competitor analysis');
    }

    return result;
  }
}
