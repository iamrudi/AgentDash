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

interface ObservationInsight {
  label: string;
  value: string;
  context?: string;
}

interface RecommendationOutput {
  title: string;
  observation: string; // Kept for backward compatibility
  observationInsights: ObservationInsight[];
  proposedAction: string; // Kept for backward compatibility
  actionTasks: string[];
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
2. A summary observation (1-2 sentences overview)
3. Structured observation insights - key data points as an array of objects with:
   - label: the metric or insight name (e.g., "Current CTR", "Sessions Lost", "Opportunity")
   - value: the specific value or finding
   - context (optional): brief explanation if needed
4. A summary of the proposed action (1-2 sentences)
5. Action tasks - a numbered list of specific, actionable steps
6. Impact level (High/Medium/Low)
7. Estimated cost in USD (or 0 if no cost)
8. The metric that triggered this recommendation
9. Baseline value of that metric

The observationInsights should contain 2-4 key data points that support your recommendation.
The actionTasks should contain 3-5 specific steps the agency will take.

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
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              observation: { type: "STRING" },
              observationInsights: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    label: { type: "STRING" },
                    value: { type: "STRING" },
                    context: { type: "STRING" }
                  },
                  required: ["label", "value"]
                }
              },
              proposedAction: { type: "STRING" },
              actionTasks: {
                type: "ARRAY",
                items: { type: "STRING" }
              },
              impact: { type: "STRING", enum: ["High", "Medium", "Low"] },
              estimatedCost: { type: "NUMBER" },
              triggerMetric: { type: "STRING" },
              baselineValue: { type: "NUMBER" }
            },
            required: ["title", "observation", "observationInsights", "proposedAction", "actionTasks", "impact", "estimatedCost", "triggerMetric", "baselineValue"]
          }
        }
      },
      contents: metricsContext,
    });

    const rawJson = response.text;

    if (!rawJson) {
      throw new Error("Empty response from Gemini AI");
    }

    console.log("[Gemini AI Raw Response]:", rawJson);
    const recommendations: RecommendationOutput[] = JSON.parse(rawJson);
    console.log("[Gemini AI Parsed Recommendations]:", JSON.stringify(recommendations, null, 2));
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
2. Provide a clear observation summary (1-2 sentences) that DIRECTLY answers their question.
3. Provide structured observation insights - key data points as an array of objects with label, value, and optional context.
4. Provide a proposed action summary (1-2 sentences).
5. Provide action tasks - a numbered list of 3-5 specific, actionable steps the agency will take.
6. Estimate the impact and a reasonable one-time cost for this action.

IMPORTANT: 
- Use SPECIFIC numbers and metrics from the data in your observation insights
- The observationInsights should contain 2-4 key data points (e.g., {label: "Current CTR", value: "2.3%", context: "Industry average is 3.5%"})
- The actionTasks should be specific steps (e.g., "Audit all meta descriptions for keyword optimization")
- If data is sparse, identify data gaps as opportunities
- NEVER return empty strings or arrays - always provide meaningful, data-driven content

Respond with a single JSON object matching the required schema.`;

    const prompt = `
CLIENT: ${clientName}
CONTEXT DATA:
${JSON.stringify(contextData, null, 2)}

CLIENT'S QUESTION: "${question}"

Based on the data and the question, generate a single, actionable recommendation.
- The title should be a concise, action-oriented summary (e.g., "Improve Organic Search Visibility")
- The observation should be a 1-2 sentence summary directly answering their question
- The observationInsights should be 2-4 key data points in structured format (e.g., {label: "Organic Clicks", value: "1,234", context: "Down 15% from last month"})
- The proposedAction should be a 1-2 sentence summary of what the agency will do
- The actionTasks should be 3-5 specific, numbered steps (e.g., "Audit all meta descriptions for target keywords", "Implement schema markup on key landing pages")
- The trigger metric should be the primary metric from the context (e.g., 'Organic Clicks', 'CTR', 'Conversions', 'Average Position')
- The baseline value should be the current value of that metric from the data
- If data is limited, identify this as an opportunity
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            observation: { type: "STRING" },
            observationInsights: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  label: { type: "STRING" },
                  value: { type: "STRING" },
                  context: { type: "STRING" }
                },
                required: ["label", "value"]
              }
            },
            proposedAction: { type: "STRING" },
            actionTasks: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            impact: { type: "STRING", enum: ["High", "Medium", "Low"] },
            estimatedCost: { type: "NUMBER" },
            triggerMetric: { type: "STRING" },
            baselineValue: { type: "NUMBER" },
          },
          required: ["title", "observation", "observationInsights", "proposedAction", "actionTasks", "impact"],
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
    
    if (!result.observationInsights || result.observationInsights.length === 0) {
      throw new Error("AI returned empty observation insights. Please ensure analytics data is available and try again.");
    }
    
    if (!result.actionTasks || result.actionTasks.length === 0) {
      throw new Error("AI returned empty action tasks. Please ensure analytics data is available and try again.");
    }
    
    return result;
  } catch (error) {
    console.error("Gemini on-demand analysis error:", error);
    throw new Error(`Failed to analyze data on demand: ${error}`);
  }
}

export async function summarizeLighthouseReport(
  url: string,
  lighthouseReport: any
): Promise<{ summary: string; recommendations: string[] }> {
  try {
    const systemPrompt = `You are an expert SEO analyst. Your task is to summarize a Google Lighthouse report for an agency account manager. Provide a high-level overview and a prioritized list of actionable recommendations. Focus on the most critical issues found in the SEO, Performance, and Accessibility categories.`;

    const prompt = `
    Lighthouse Audit Summary for: ${url}

    Here is the raw Lighthouse JSON report data:
    ${JSON.stringify(lighthouseReport.audits, null, 2)}

    Please provide:
    1.  A "summary" (2-3 paragraphs) of the website's overall SEO health, performance, and accessibility.
    2.  A "recommendations" array of the top 5 most impactful, actionable items the agency should focus on to improve the site's scores.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            recommendations: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["summary", "recommendations"],
        },
      },
      contents: prompt,
    });

    const rawJson = response.text;
    if (!rawJson) {
      throw new Error("Empty response from Gemini AI");
    }
    return JSON.parse(rawJson);

  } catch (error) {
    console.error("Gemini AI Lighthouse summary error:", error);
    throw new Error(`Failed to summarize Lighthouse report: ${error}`);
  }
}

export async function analyzeChatHistory(
  chatHistory: string
): Promise<{ painPoints: string[]; recentWins: string[]; activeQuestions: string[] }> {
  try {
    const systemPrompt = `You are an expert Account Manager analyzing a recent conversation history with a client. Your task is to distill this conversation into actionable insights. 

IMPORTANT: Even in casual or brief conversations, look for any Client concerns, questions, or positive feedback. Be perceptive and extract insights even from informal language. If a Client asks a question or expresses a need (even informally), capture it. If they seem happy or frustrated, note it.

Focus on messages from the "Client" role - these are the most important for understanding their needs and sentiment.`;

    const prompt = `
    Here is the recent chat history between the agency and the client:
    ---
    ${chatHistory}
    ---
    Based on this conversation, extract actionable insights:
    
    1. **painPoints**: Problems, frustrations, concerns, or improvement requests from the Client (even if expressed casually like "can we improve X?"). Look for Client messages expressing dissatisfaction, concern, or desire for change.
    
    2. **recentWins**: Positive feedback, satisfaction, or happy comments from the Client. Even brief positive acknowledgments count (e.g., "great", "thanks", "love it").
    
    3. **activeQuestions**: Any unanswered questions or requests from the Client that need follow-up. Include questions about improving performance, traffic, conversions, or any service-related inquiries.
    
    If the conversation contains only greetings/small talk with no substantive content, return empty arrays. Otherwise, be perceptive and capture real insights even from brief messages.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            painPoints: { type: "ARRAY", items: { type: "STRING" } },
            recentWins: { type: "ARRAY", items: { type: "STRING" } },
            activeQuestions: { type: "ARRAY", items: { type: "STRING" } },
          },
          required: ["painPoints", "recentWins", "activeQuestions"],
        },
      },
      contents: prompt,
    });

    const rawJson = response.text;
    if (!rawJson) {
      throw new Error("Empty response from Gemini AI during chat analysis");
    }
    return JSON.parse(rawJson);

  } catch (error) {
    console.error("Gemini AI chat analysis error:", error);
    throw new Error(`Failed to analyze chat history: ${error}`);
  }
}
