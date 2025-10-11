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

    if (rawJson) {
      const recommendations: RecommendationOutput[] = JSON.parse(rawJson);
      return recommendations;
    } else {
      throw new Error("Empty response from Gemini AI");
    }
  } catch (error) {
    console.error("Gemini AI analysis error:", error);
    throw new Error(`Failed to analyze client metrics: ${error}`);
  }
}
