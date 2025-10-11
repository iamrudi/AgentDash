import { GoogleGenAI } from "@google/genai";

// DON'T DELETE THIS COMMENT
// Follow these instructions when using this blueprint:
// - Note that the newest Gemini model series is "gemini-2.5-flash" or gemini-2.5-pro"
//   - do not change this unless explicitly requested by the user

// This API key is from Gemini Developer API Key, not vertex AI API Key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface MetricData {
  date: string;
  users?: number;
  sessions?: number;
  conversions?: number;
  bounceRate?: number;
  avgSessionDuration?: number;
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

interface RecommendationOutput {
  title: string;
  observation: string;
  proposedAction: string;
  impact: "High" | "Medium" | "Low";
  estimatedCost: number;
  triggerMetric: string;
  baselineValue: number;
}

export async function analyzeClientMetrics(
  clientName: string,
  ga4Metrics: MetricData[],
  gscMetrics: MetricData[],
  objectives?: string
): Promise<RecommendationOutput[]> {
  try {
    const systemPrompt = `You are an expert digital marketing strategist analyzing client performance data.
Your task is to identify actionable opportunities and issues based on GA4 and Google Search Console metrics.

Generate strategic recommendations that are:
- Data-driven and specific
- Actionable with clear next steps
- Prioritized by impact
- Include estimated costs where applicable

For each recommendation, provide:
1. A concise title (max 60 characters)
2. Clear observation based on the data
3. Specific proposed action
4. Impact level (High/Medium/Low)
5. Estimated cost in USD (or 0 if no cost)
6. The metric that triggered this recommendation
7. Baseline value of that metric

Respond with a JSON array of recommendations.`;

    const metricsContext = `
CLIENT: ${clientName}
${objectives ? `OBJECTIVES: ${objectives}` : ''}

GA4 METRICS (last 30 days):
${JSON.stringify(ga4Metrics, null, 2)}

GOOGLE SEARCH CONSOLE METRICS (last 30 days):
${JSON.stringify(gscMetrics, null, 2)}

Analyze this data and generate 2-5 strategic recommendations focusing on:
- Conversion optimization opportunities
- Traffic growth strategies
- User experience improvements
- Search visibility enhancements
- Performance issues that need attention
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              observation: { type: "string" },
              proposedAction: { type: "string" },
              impact: { type: "string", enum: ["High", "Medium", "Low"] },
              estimatedCost: { type: "number" },
              triggerMetric: { type: "string" },
              baselineValue: { type: "number" }
            },
            required: ["title", "observation", "proposedAction", "impact", "estimatedCost", "triggerMetric", "baselineValue"]
          }
        }
      },
      contents: metricsContext,
    });

    const rawJson = response.text;

    if (!rawJson) {
      throw new Error("Empty response from Gemini AI");
    }

    const recommendations: RecommendationOutput[] = JSON.parse(rawJson);
    return recommendations;
  } catch (error) {
    console.error("Gemini AI analysis error:", error);
    throw new Error(`Failed to analyze client metrics: ${error}`);
  }
}

export async function analyzeDataOnDemand(
  clientName: string,
  contextData: any,
  question: string
): Promise<RecommendationOutput> {
  try {
    const systemPrompt = `You are an expert digital marketing analyst providing on-demand insights for a client.
The client is asking a question about a specific dataset. Your task is to:
1. Analyze the provided data in the context of their question.
2. Provide a clear, concise observation that DIRECTLY answers their question using specific data points.
3. Propose a single, actionable next step that the agency could perform for a fee.
4. Frame this as a single, valuable "Initiative" or "Recommendation".
5. Estimate the impact and a reasonable one-time cost for this action.

IMPORTANT: 
- Use SPECIFIC numbers and metrics from the data in your observation (e.g., "Your CTR is 2.3%" not "Your CTR is low")
- If data is sparse, focus on what IS available and identify data gaps as opportunities
- NEVER return empty strings - always provide meaningful, data-driven content
- The observation should be 2-3 sentences minimum with concrete insights

Respond with a single JSON object matching the required schema.`;

    const prompt = `
CLIENT: ${clientName}
CONTEXT DATA:
${JSON.stringify(contextData, null, 2)}

CLIENT'S QUESTION: "${question}"

Based on the data and the question, generate a single, actionable recommendation.
- The title should be a concise, action-oriented summary (e.g., "Improve Organic Search Visibility")
- The observation MUST directly answer their question using SPECIFIC data points from the context (e.g., "Your site received 1,234 organic clicks with an average position of 15.7...")
- The proposed action should be a clear service the agency can offer (e.g., "Conduct comprehensive SEO audit and implement on-page optimization...")
- The trigger metric should be the primary metric from the context (e.g., 'Organic Clicks', 'CTR', 'Conversions', 'Average Position')
- The baseline value should be the current value of that metric from the data
- If data is limited, identify this as an opportunity (e.g., "Limited conversion tracking indicates a need for proper analytics setup")
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            observation: { type: "string" },
            proposedAction: { type: "string" },
            impact: { type: "string", enum: ["High", "Medium", "Low"] },
            estimatedCost: { type: "number" },
            triggerMetric: { type: "string" },
            baselineValue: { type: "number" },
          },
          required: ["title", "observation", "proposedAction", "impact"],
        },
      },
      contents: prompt,
    });

    const rawJson = response.text;
    if (!rawJson) {
      throw new Error("Empty response from Gemini AI");
    }
    
    const result = JSON.parse(rawJson) as RecommendationOutput;
    
    // Validate that critical fields are not empty
    if (!result.observation || result.observation.trim().length === 0) {
      throw new Error("AI returned empty observation. Please ensure analytics data is available and try again.");
    }
    
    if (!result.proposedAction || result.proposedAction.trim().length === 0) {
      throw new Error("AI returned empty proposed action. Please ensure analytics data is available and try again.");
    }
    
    return result;
  } catch (error) {
    console.error("Gemini on-demand analysis error:", error);
    throw new Error(`Failed to analyze data on demand: ${error}`);
  }
}
