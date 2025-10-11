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
    // 1. Get client info and objectives
    const client = await storage.getClientById(clientId);
    if (!client) {
      return { success: false, recommendationsCreated: 0, error: "Client not found" };
    }

    // 2. Get GA4 metrics (last 30 days)
    const ga4Metrics = await storage.getMetricsByClientId(clientId, 30);
    
    // 3. Get GSC metrics (last 30 days) 
    const gscMetrics = await storage.getGSCMetricsByClientId(clientId, 30);

    // 4. Check if we have enough data
    if (ga4Metrics.length === 0 && gscMetrics.length === 0) {
      return { 
        success: false, 
        recommendationsCreated: 0, 
        error: "No metrics data available. Please ensure GA4 and/or GSC integrations are set up and have data." 
      };
    }

    // 5. Format metrics for AI analysis
    const formattedGA4 = ga4Metrics.map(m => ({
      date: format(new Date(m.date), 'yyyy-MM-dd'),
      users: m.users || 0,
      sessions: m.sessions || 0,
      conversions: m.conversions || 0,
      bounceRate: m.bounceRate ? parseFloat(m.bounceRate) : 0,
      avgSessionDuration: m.avgSessionDuration || 0
    }));

    const formattedGSC = gscMetrics.map(m => ({
      date: format(new Date(m.date), 'yyyy-MM-dd'),
      clicks: m.clicks || 0,
      impressions: m.impressions || 0,
      ctr: m.ctr ? parseFloat(m.ctr) : 0,
      position: m.position ? parseFloat(m.position) : 0
    }));

    // 6. Get client objectives if available
    const objectives = client.objectives || undefined;

    // 7. Call Gemini AI to analyze and generate recommendations
    const aiRecommendations = await analyzeClientMetrics(
      client.companyName,
      formattedGA4,
      formattedGSC,
      objectives
    );

    // 8. Create initiative records from AI recommendations
    let createdCount = 0;
    for (const rec of aiRecommendations) {
      const initiative: InsertInitiative = {
        title: rec.title,
        observation: rec.observation,
        proposedAction: rec.proposedAction,
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
