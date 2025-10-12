import { analyzeClientMetrics } from "./gemini";
import { IStorage } from "./storage";
import { InsertInitiative } from "@shared/schema";
import { subDays, format } from "date-fns";

interface AIRecommendationResult {
  success: boolean;
  recommendationsCreated: number;
  error?: string;
}

export async function generateAIRecommendations(
  storage: IStorage,
  clientId: string
): Promise<AIRecommendationResult> {
  try {
    // 1. Get client info
    const client = await storage.getClientById(clientId);
    if (!client) {
      return { success: false, recommendationsCreated: 0, error: "Client not found" };
    }

    // 2. Check if at least one integration is connected
    const ga4Integration = await storage.getIntegrationByClientId(clientId, 'GA4');
    const gscIntegration = await storage.getIntegrationByClientId(clientId, 'GSC');
    
    if (!ga4Integration && !gscIntegration) {
      return { 
        success: false, 
        recommendationsCreated: 0, 
        error: "No analytics integrations connected. Please connect GA4 and/or Google Search Console first." 
      };
    }

    // 3. Get all metrics (last 30 days)
    const allMetrics = await storage.getMetricsByClientId(clientId, 30);
    
    // 4. Check if we have enough data
    if (allMetrics.length === 0) {
      return { 
        success: false, 
        recommendationsCreated: 0, 
        error: "No metrics data available. Please sync metrics data first using the 'Sync Metrics' button, then try again." 
      };
    }

    // 5. Separate GA4 and GSC metrics by filtering rows
    // GA4 metrics: rows with sessions/conversions/spend data (paid channels like Google Ads, Facebook, etc.)
    const ga4Rows = allMetrics.filter(m => 
      (m.sessions || 0) > 0 || 
      (m.conversions || 0) > 0 || 
      (m.clicks || 0) > 0 || 
      (m.impressions || 0) > 0 ||
      (m.spend && parseFloat(m.spend) > 0)
    );
    
    // GSC metrics: rows with organic search data (organicClicks, organicImpressions, avgPosition)
    const gscRows = allMetrics.filter(m => 
      (m.organicClicks || 0) > 0 || 
      (m.organicImpressions || 0) > 0 || 
      (m.avgPosition !== null && m.avgPosition !== undefined)
    );

    // 6. Validate we have meaningful data from at least one source
    if (ga4Rows.length === 0 && gscRows.length === 0) {
      return { 
        success: false, 
        recommendationsCreated: 0, 
        error: "No meaningful analytics data found. Please ensure your integrations are collecting data." 
      };
    }

    // 8. Format GA4 metrics for AI analysis
    const formattedGA4 = ga4Rows.map(m => ({
      date: format(new Date(m.date), 'yyyy-MM-dd'),
      source: m.source,
      sessions: m.sessions || 0,
      conversions: m.conversions || 0,
      clicks: m.clicks || 0,
      impressions: m.impressions || 0,
      spend: m.spend ? parseFloat(m.spend) : 0
    }));

    // 9. Format GSC metrics for AI analysis
    const formattedGSC = gscRows.map(m => ({
      date: format(new Date(m.date), 'yyyy-MM-dd'),
      organicClicks: m.organicClicks || 0,
      organicImpressions: m.organicImpressions || 0,
      avgPosition: m.avgPosition ? parseFloat(m.avgPosition) : 0
    }));

    // 10. Get client objectives if available
    const clientObjectives = await storage.getObjectivesByClientId(clientId);
    const objectives = clientObjectives.filter(o => o.isActive === "true")
      .map(o => o.description)
      .join("; ") || undefined;

    // 11. Call Gemini AI to analyze and generate recommendations
    const aiRecommendations = await analyzeClientMetrics(
      client.companyName,
      formattedGA4,
      formattedGSC,
      objectives
    );

    // 12. Create initiative records from AI recommendations
    let createdCount = 0;
    for (const rec of aiRecommendations) {
      const initiative: InsertInitiative = {
        title: rec.title,
        observation: rec.observation,
        observationInsights: rec.observationInsights,
        proposedAction: rec.proposedAction,
        actionTasks: rec.actionTasks,
        status: "Needs Review",
        cost: rec.estimatedCost.toString(),
        impact: rec.impact,
        clientId: clientId,
        triggerMetric: rec.triggerMetric,
        baselineValue: rec.baselineValue.toString(),
        sentToClient: "false",
        responseViewedByAdmin: "false"
      };

      await storage.createInitiative(initiative);
      createdCount++;
    }

    return {
      success: true,
      recommendationsCreated: createdCount
    };

  } catch (error) {
    console.error("AI recommendation generation error:", error);
    return {
      success: false,
      recommendationsCreated: 0,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
}
