import OpenAI from "openai";
import type {
  AIProvider,
  MetricData,
  RecommendationOutput,
  Preset,
  LighthouseSummary,
  ChatAnalysis,
} from "./types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

const PRESET_CONFIGS = {
  "quick-wins": {
    focus: "Quick, low-effort, high-impact optimizations that can be implemented immediately",
    areas: ["Title tag optimization", "Meta description improvements", "CTR enhancement", "Low-hanging keyword opportunities", "Technical quick fixes"],
    count: "2-3",
    taskComplexity: "Simple, actionable tasks (1-3 steps each)",
    timeframe: "Can be completed within 1-2 weeks"
  },
  "strategic-growth": {
    focus: "Long-term growth strategies and content roadmap",
    areas: ["Content cluster development", "Keyword expansion strategies", "Landing page optimization", "Link building opportunities", "Authority building"],
    count: "3-5",
    taskComplexity: "Strategic initiatives with clear execution plans (3-5 steps each)",
    timeframe: "1-3 month implementation timeline"
  },
  "full-audit": {
    focus: "Comprehensive analysis across all marketing categories",
    areas: ["Technical SEO", "Content optimization", "User experience", "Conversion funnel", "Traffic acquisition", "Performance issues"],
    count: "5-8",
    taskComplexity: "Mix of quick wins and strategic initiatives with detailed action plans",
    timeframe: "Immediate to 3+ months"
  }
};

export class OpenAIProvider implements AIProvider {
  async analyzeClientMetrics(
    clientName: string,
    ga4Metrics: MetricData[],
    gscMetrics: MetricData[],
    objectives?: string,
    preset: Preset = "full-audit",
    competitorContext?: string,
    hubspotData?: any
  ): Promise<RecommendationOutput[]> {
    try {
      const presetConfig = PRESET_CONFIGS[preset];
      
      const systemPrompt = `You are an expert digital marketing strategist analyzing client performance data.

ANALYSIS TYPE: ${preset.toUpperCase().replace("-", " ")}
FOCUS: ${presetConfig.focus}

Generate strategic recommendations that are:
- Data-driven and specific
- Actionable with clear next steps
- Prioritized by impact
- Include estimated costs where applicable
- Aligned with the ${preset} preset requirements

For each recommendation, provide:
1. A concise title (max 60 characters)
2. A summary observation (1-2 sentences overview)
3. Structured observation insights - key data points as an array of objects with:
   - label: the metric or insight name (e.g., "Current CTR", "Sessions Lost", "Opportunity")
   - value: the specific value or finding
   - context (optional): brief explanation if needed
4. A summary of the proposed action (1-2 sentences)
5. Action tasks - specific, actionable steps (${presetConfig.taskComplexity})
6. Impact level (High/Medium/Low)
7. Estimated cost in USD (or 0 if no cost)
8. The metric that triggered this recommendation
9. Baseline value of that metric

The observationInsights should contain 2-4 key data points that support your recommendation.

PRESET REQUIREMENTS:
- Focus areas: ${presetConfig.areas.join(", ")}
- Number of recommendations: ${presetConfig.count}
- Implementation timeframe: ${presetConfig.timeframe}

Respond with a JSON array of recommendations.`;

      const userPrompt = `
CLIENT: ${clientName}
${objectives ? `OBJECTIVES: ${objectives}` : ''}
${competitorContext ? `\nCOMPETITOR ANALYSIS:\n${competitorContext}` : ''}

GA4 METRICS (last 30 days):
${JSON.stringify(ga4Metrics, null, 2)}

GOOGLE SEARCH CONSOLE METRICS (last 30 days):
${JSON.stringify(gscMetrics, null, 2)}

${hubspotData ? `HUBSPOT CRM DATA:
Total Contacts: ${hubspotData.totalContacts}
Total Companies: ${hubspotData.totalCompanies}
Total Deals: ${hubspotData.totalDeals}
Total Deal Value: $${hubspotData.dealValue.toLocaleString()}

Recent Contacts (sample):
${JSON.stringify(hubspotData.contacts.slice(0, 5), null, 2)}

Recent Deals (sample):
${JSON.stringify(hubspotData.deals.slice(0, 5), null, 2)}

Use this CRM data to identify sales pipeline opportunities, lead nurturing needs, and conversion optimization recommendations.
` : ''}

Generate ${presetConfig.count} recommendations focusing on: ${presetConfig.areas.join(", ")}
${competitorContext ? '\nInclude competitive insights and opportunities to outperform the specified competitors.' : ''}
${hubspotData ? '\nConsider HubSpot CRM data to suggest sales enablement, lead nurturing, and pipeline acceleration strategies.' : ''}
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response from OpenAI");
      }

      const parsed = JSON.parse(content);
      const recommendations = parsed.recommendations || parsed;
      
      if (!Array.isArray(recommendations)) {
        throw new Error("OpenAI response is not an array");
      }

      console.log("[OpenAI Parsed Recommendations]:", JSON.stringify(recommendations, null, 2));
      return recommendations;
    } catch (error) {
      console.error("OpenAI analysis error:", error);
      throw new Error(`Failed to analyze client metrics: ${error}`);
    }
  }

  async analyzeDataOnDemand(
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

      const userPrompt = `
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

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response from OpenAI");
      }

      const result = JSON.parse(content) as RecommendationOutput;

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
      console.error("OpenAI on-demand analysis error:", error);
      throw new Error(`Failed to analyze data on demand: ${error}`);
    }
  }

  async summarizeLighthouseReport(
    url: string,
    lighthouseReport: any
  ): Promise<LighthouseSummary> {
    try {
      const systemPrompt = `You are an expert SEO analyst. Your task is to summarize a Google Lighthouse report for an agency account manager. Provide a high-level overview and a prioritized list of actionable recommendations. Focus on the most critical issues found in the SEO, Performance, and Accessibility categories.`;

      const userPrompt = `
Lighthouse Audit Summary for: ${url}

Here is the raw Lighthouse JSON report data:
${JSON.stringify(lighthouseReport.audits, null, 2)}

Please provide:
1. A "summary" (2-3 paragraphs) of the website's overall SEO health, performance, and accessibility.
2. A "recommendations" array of the top 5 most impactful, actionable items the agency should focus on to improve the site's scores.
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response from OpenAI");
      }

      return JSON.parse(content) as LighthouseSummary;
    } catch (error) {
      console.error("OpenAI Lighthouse summary error:", error);
      throw new Error(`Failed to summarize Lighthouse report: ${error}`);
    }
  }

  async analyzeChatHistory(chatHistory: string): Promise<ChatAnalysis> {
    try {
      const systemPrompt = `You are an expert Account Manager analyzing a recent conversation history with a client. Your task is to distill this conversation into actionable insights. 

IMPORTANT: Even in casual or brief conversations, look for any Client concerns, questions, or positive feedback. Be perceptive and extract insights even from informal language. If a Client asks a question or expresses a need (even informally), capture it. If they seem happy or frustrated, note it.

Focus on messages from the "Client" role - these are the most important for understanding their needs and sentiment.`;

      const userPrompt = `
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

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response from OpenAI during chat analysis");
      }

      return JSON.parse(content) as ChatAnalysis;
    } catch (error) {
      console.error("OpenAI chat analysis error:", error);
      throw new Error(`Failed to analyze chat history: ${error}`);
    }
  }
}
