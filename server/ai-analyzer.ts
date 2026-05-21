import { IStorage } from "./storage";
import { InsertInitiative } from "@shared/schema";
import { subDays, format } from "date-fns";
import { z } from "zod";
import { hardenedAIExecutor } from "./ai/hardened-executor";
import { buildAIInput, defaultFieldCatalogPath, loadFieldCatalog } from "./ai/ai-input-builder";

interface AIRecommendationResult {
  success: boolean;
  recommendationsCreated: number;
  error?: string;
}

type Preset = "quick-wins" | "strategic-growth" | "full-audit";

interface GenerateRecommendationsOptions {
  preset: Preset;
  includeCompetitors?: boolean;
  competitorDomains?: string[];
}

export async function generateAIRecommendations(
  storage: IStorage,
  clientId: string,
  options: GenerateRecommendationsOptions = { preset: "full-audit" }
): Promise<AIRecommendationResult> {
  try {
    // 1. Get client info
    const client = await storage.getClientById(clientId);
    if (!client) {
      return { success: false, recommendationsCreated: 0, error: "Client not found" };
    }

    // 2. Check if at least one integration is connected (with error handling for decryption issues)
    let ga4Integration;
    let gscIntegration;
    
    try {
      ga4Integration = await storage.getIntegrationByClientId(clientId, 'GA4');
    } catch (error) {
      if (error instanceof Error && error.message.includes('Decryption failed')) {
        console.error('GA4 integration decryption failed - likely encryption key mismatch:', error.message);
        // Continue without GA4 data
      } else {
        throw error;
      }
    }
    
    try {
      gscIntegration = await storage.getIntegrationByClientId(clientId, 'GSC');
    } catch (error) {
      if (error instanceof Error && error.message.includes('Decryption failed')) {
        console.error('GSC integration decryption failed - likely encryption key mismatch:', error.message);
        // Continue without GSC data
      } else {
        throw error;
      }
    }
    
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

    // 11. Fetch HubSpot CRM data if available (agency-scoped)
    let hubspotData: any = null;
    try {
      const { isHubSpotConfigured, fetchHubSpotCRMData } = await import("./lib/hubspot");
      const configured = await isHubSpotConfigured(client.agencyId);
      if (configured) {
        hubspotData = await fetchHubSpotCRMData(client.agencyId);
        console.log(`[HubSpot] Fetched ${hubspotData.totalContacts} contacts, ${hubspotData.totalDeals} deals, ${hubspotData.totalCompanies} companies for agency ${client.agencyId}`);
      }
    } catch (error) {
      console.error("[HubSpot] Failed to fetch CRM data:", error instanceof Error ? error.message : error);
      // Continue without HubSpot data - it's optional
    }

    // 12. Fetch LinkedIn data if available (agency-scoped)
    let linkedinData: any = null;
    try {
      const { isLinkedInConfigured, fetchLinkedInData } = await import("./lib/linkedin");
      const configured = await isLinkedInConfigured(client.agencyId);
      if (configured) {
        linkedinData = await fetchLinkedInData(client.agencyId);
        console.log(`[LinkedIn] Fetched ${linkedinData.organization?.followerCount} followers, ${linkedinData.recentPosts.length} posts for agency ${client.agencyId}`);
      }
    } catch (error) {
      console.error("[LinkedIn] Failed to fetch data:", error instanceof Error ? error.message : error);
      // Continue without LinkedIn data - it's optional
    }

    // 13. Note: DataForSEO integration available but requires client website field
    // TODO: Add website field to clients schema to enable DataForSEO keyword gap analysis
    // Once added, we can fetch keyword opportunities by comparing client domain to competitors
    // For now, DataForSEO connection status is displayed but not used in AI analysis

    // 13. Prepare competitor context if provided
    let competitorContext: string | undefined;
    if (options.includeCompetitors && options.competitorDomains && options.competitorDomains.length > 0) {
      competitorContext = `Competitor domains to analyze against: ${options.competitorDomains.join(", ")}. 
Include competitive analysis and opportunities to outperform these competitors.`;
    }

    // 14. Fetch client knowledge records for AI context
    const [knowledgeEntries, categories] = await Promise.all([
      storage.getClientKnowledge(client.agencyId, { clientId, status: "active" }),
      storage.getKnowledgeCategoriesByAgencyId(client.agencyId),
    ]);

    const categoryMap = new Map(categories.map(c => [c.id, c.displayName || c.name]));
    const knowledgeRecords: Record<string, Array<{ title: string; structuredData?: unknown; content?: string | null; confidenceScore?: string | number | null }>> = {};
    for (const entry of knowledgeEntries) {
      const categoryName = categoryMap.get(entry.categoryId) || "Other";
      if (!knowledgeRecords[categoryName]) {
        knowledgeRecords[categoryName] = [];
      }
      knowledgeRecords[categoryName].push({
        title: entry.title,
        structuredData: entry.structuredData || undefined,
        content: entry.structuredData ? undefined : entry.content,
        confidenceScore: entry.confidenceScore,
      });
    }

    const catalog = loadFieldCatalog(defaultFieldCatalogPath());
    const inputResult = buildAIInput(catalog, {
      client: {
        companyName: client.companyName,
        businessContext: client.businessContext || null,
        retainerAmount: client.retainerAmount || null,
        monthlyRetainerHours: client.monthlyRetainerHours || null,
        leadEvents: client.leadEvents || null,
      },
      metrics: {
        ga4: formattedGA4,
        gsc: formattedGSC,
      },
      objectives: clientObjectives.filter(o => o.isActive === "true").map(o => o.description),
      signals: {
        hubspot: hubspotData,
        linkedin: linkedinData,
        competitors: options.competitorDomains || null,
      },
      knowledgeRecords,
    });

    if (!inputResult.ok) {
      return {
        success: false,
        recommendationsCreated: 0,
        error: `AI input validation failed: ${inputResult.error}`,
      };
    }

    const presetConfig = {
      "quick-wins": {
        focus: "Quick wins across multiple marketing channels",
        areas: ["Conversion rate optimisation", "Paid search efficiencies", "Content quick wins", "Email / CRM engagement", "Social media engagement"],
        count: 3,
        taskComplexity: "Quick, low-lift actions",
        timeframe: "Immediate to 2 weeks",
      },
      "strategic-growth": {
        focus: "Strategic growth spanning brand, demand generation, and customer lifecycle",
        areas: ["Pipeline & demand generation", "Brand positioning & thought leadership", "Content strategy & SEO", "Customer retention & upsell", "Paid media diversification", "CRM & email automation"],
        count: 4,
        taskComplexity: "Mid-term initiatives with clear owners",
        timeframe: "1-3 months",
      },
      "full-audit": {
        focus: "Full multi-channel audit covering the entire marketing mix",
        areas: ["Organic search & technical SEO", "Paid media (PPC, social ads)", "Content marketing & thought leadership", "Email marketing & CRM nurture", "Social media & community", "Conversion rate optimisation", "Analytics & measurement gaps"],
        count: 5,
        taskComplexity: "Mix of quick wins and strategic initiatives",
        timeframe: "Immediate to 3+ months",
      },
    } as const;

    const presetMeta = presetConfig[options.preset];

    const availableDataSources: string[] = [];
    if (formattedGA4.length > 0) availableDataSources.push("Google Analytics 4 (GA4) — website traffic, sessions, conversions, paid channel performance");
    if (formattedGSC.length > 0) availableDataSources.push("Google Search Console (GSC) — organic search clicks, impressions, average position");
    if (hubspotData) availableDataSources.push("HubSpot CRM — contacts, deals, pipeline data");
    if (linkedinData) availableDataSources.push("LinkedIn — follower growth, post engagement, company page performance");
    if (Object.keys(knowledgeRecords).length > 0) availableDataSources.push("Client Knowledge Records — KPIs, business goals, brand voice, competitive landscape, constraints");

    const dataSourceContext = availableDataSources.length > 0
      ? `\n\nAVAILABLE DATA SOURCES:\n${availableDataSources.map(s => `- ${s}`).join("\n")}\n\nUse evidence from ALL available data sources, not just one. Where data is limited for a channel, use the client's business context, knowledge records, and industry best practices to form recommendations.`
      : "";

    const knowledgeInstructions = Object.keys(knowledgeRecords).length > 0
      ? `\n\nCLIENT KNOWLEDGE RECORDS (HIGH PRIORITY):\nThe input data includes 'knowledgeRecords' grouped by category (e.g. KPI Targets, Business Goals, Business Constraints, Competitive Landscape, Industry Context, Brand Voice).\nThese records are the client's strategic foundation. You MUST:\n- Use Business Goals as the PRIMARY driver for recommendation themes — each recommendation should connect back to a stated goal\n- Align recommendations with KPI Targets — reference specific numeric targets\n- Respect Business Constraints (budget limits, capacity, compliance) — do not recommend actions that violate them\n- Leverage Competitive Landscape to identify differentiation opportunities\n- Incorporate Industry Context to make recommendations forward-looking\n- Reflect Brand Voice guidelines in how actions are framed\n- Reference specific records by name (e.g. 'Business Goal: Launch Productised SEO Packages', 'KPI: Monthly Qualified Leads Target — 50')`
      : "";

    const systemPrompt = `You are a senior digital marketing strategist providing actionable, multi-channel recommendations for an agency's client.

ANALYSIS TYPE: ${options.preset.toUpperCase().replace("-", " ")}
FOCUS: ${presetMeta.focus}

CRITICAL RULE — CHANNEL DIVERSITY:
Your ${presetMeta.count} recommendations MUST span at least 3 different marketing channels or disciplines. Do NOT cluster all recommendations in a single area (e.g. do not produce 5 SEO recommendations). Spread recommendations across channels such as:
- Organic search / SEO
- Paid media (PPC, paid social)
- Content marketing & thought leadership
- Email marketing & marketing automation
- CRM & sales enablement
- Social media & community building
- Conversion rate optimisation & UX
- Analytics, measurement & reporting
- Brand strategy & positioning

If the available data is weighted toward one channel (e.g. mostly search data), still diversify:
- Use the client's business goals, constraints, and competitive landscape to infer opportunities in other channels
- Recommend improvements to under-represented channels where gaps are apparent
- Connect data-rich channel insights to actions in data-sparse channels (e.g. search intent data informing content or email strategy)

Generate strategic recommendations that are:
- Data-driven where data exists, insight-driven where it does not
- Actionable with clear, specific next steps
- Prioritised by business impact (revenue, pipeline, efficiency)
- Inclusive of estimated costs where applicable
- Directly tied to the client's stated business goals and KPIs
${dataSourceContext}
For each recommendation, provide:
1. A concise title (max 60 characters)
2. A summary observation (1-2 sentences stating the problem or opportunity)
3. Structured observation insights — 2-4 key data points as an array of objects with:
   - label: the metric or insight name (e.g. "Current CTR", "Pipeline Gap", "Email Open Rate", "Competitor Advantage")
   - value: the specific value or finding
   - context (optional): brief explanation if needed
4. A summary of the proposed action (1-2 sentences)
5. Action tasks — specific, actionable steps (${presetMeta.taskComplexity})
6. Impact level (High/Medium/Low)
7. Estimated cost in USD (or 0 if no cost)
8. The metric that triggered this recommendation
9. Baseline value of that metric

PRESET REQUIREMENTS:
- Focus areas: ${presetMeta.areas.join(", ")}
- Number of recommendations: ${presetMeta.count}
- Implementation timeframe: ${presetMeta.timeframe}${knowledgeInstructions}

Respond with a JSON array of recommendations.`;

    const prompt = `${systemPrompt}\n\nINPUT DATA (schema-validated):\n${JSON.stringify(inputResult.aiInput, null, 2)}`;

    const recommendationSchema = z.array(z.object({
      title: z.string(),
      observation: z.string(),
      observationInsights: z.array(z.object({
        label: z.string(),
        value: z.string(),
        context: z.string().optional(),
      })),
      proposedAction: z.string(),
      actionTasks: z.array(z.string()),
      impact: z.enum(["High", "Medium", "Low"]),
      estimatedCost: z.number(),
      triggerMetric: z.string(),
      baselineValue: z.number(),
    }));

    const aiResult = await hardenedAIExecutor.executeWithSchema(
      {
        agencyId: client.agencyId,
        operation: "ai_recommendations",
      },
      { prompt },
      recommendationSchema
    );

    if (!aiResult.success) {
      return {
        success: false,
        recommendationsCreated: 0,
        error: aiResult.error || "AI recommendation generation failed",
      };
    }

    const aiRecommendations = aiResult.data;

    // 12. Create initiative records from AI recommendations
    let createdCount = 0;
    for (const rec of aiRecommendations) {
      console.log("[AI Recommendation Debug]:", JSON.stringify(rec, null, 2));
      
      // Handle both field name variations from different AI providers
      // OpenAI returns summaryObservation/summaryAction/impactLevel
      // Gemini may return observation/proposedAction/impact
      // Use type assertion to handle the flexible response format
      const recAny = rec as any;
      const observationText = recAny.observation || recAny.summaryObservation || rec.title;
      const proposedActionText = recAny.proposedAction || recAny.summaryAction || recAny.action || rec.title;
      const impactLevel = recAny.impact || recAny.impactLevel || "Medium";
      
      const initiative: InsertInitiative = {
        title: rec.title,
        observation: observationText,
        observationInsights: rec.observationInsights,
        proposedAction: proposedActionText,
        actionTasks: rec.actionTasks,
        status: "Needs Review",
        cost: rec.estimatedCost?.toString() || "0",
        impact: impactLevel,
        clientId: clientId,
        triggerMetric: rec.triggerMetric,
        baselineValue: rec.baselineValue?.toString() || "0",
        sentToClient: "false",
        responseViewedByAdmin: "false"
      };

      console.log("[Initiative to be saved]:", JSON.stringify(initiative, null, 2));
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
