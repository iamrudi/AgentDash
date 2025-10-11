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

    // 2. Get all metrics (last 30 days)
    const allMetrics = await storage.getMetricsByClientId(clientId, 30);
    
    // 3. Check if we have enough data
    if (allMetrics.length === 0) {
      return { 
        success: false, 
        recommendationsCreated: 0, 
        error: "No metrics data available. Please ensure GA4 and/or GSC integrations are set up and have data." 
      };
    }

    // 4. Format GA4 metrics (sessions, conversions from all sources)
    const formattedGA4 = allMetrics.map(m => ({
      date: format(new Date(m.date), 'yyyy-MM-dd'),
      source: m.source,
      sessions: m.sessions || 0,
      conversions: m.conversions || 0,
      clicks: m.clicks || 0,
      impressions: m.impressions || 0,
      spend: m.spend ? parseFloat(m.spend) : 0
    }));

    // 5. Format GSC metrics (organic search data)
    const formattedGSC = allMetrics.map(m => ({
      date: format(new Date(m.date), 'yyyy-MM-dd'),
      organicClicks: m.organicClicks || 0,
      organicImpressions: m.organicImpressions || 0,
      avgPosition: m.avgPosition ? parseFloat(m.avgPosition) : 0
    }));

    // 6. Get client objectives if available
    const clientObjectives = await storage.getObjectivesByClientId(clientId);
    const objectives = clientObjectives.filter(o => o.isActive === "true")
      .map(o => o.description)
      .join("; ") || undefined;

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
