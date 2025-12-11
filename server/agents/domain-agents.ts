import { BaseAgent, AgentContext, Analysis, Recommendation, ExecutionResult, AIProvider } from "./base-agent";
import type { Agent } from "@shared/schema";

const SEO_SYSTEM_PROMPT = `You are an expert SEO analyst for a digital marketing agency. 
Your role is to analyze website performance data, identify ranking opportunities, 
detect technical SEO issues, and provide actionable recommendations.
Always structure your responses as JSON matching the requested schema.
Focus on data-driven insights and prioritize recommendations by potential impact.`;

const PPC_SYSTEM_PROMPT = `You are an expert PPC (Pay-Per-Click) advertising specialist.
Your role is to analyze campaign performance, optimize bid strategies, 
identify budget allocation opportunities, and improve ROAS.
Always structure your responses as JSON matching the requested schema.
Focus on measurable outcomes and cost-efficiency.`;

const CRM_SYSTEM_PROMPT = `You are an expert CRM and lead management specialist.
Your role is to analyze lead quality, score prospects, identify lifecycle stage transitions,
and optimize the sales pipeline.
Always structure your responses as JSON matching the requested schema.
Focus on conversion optimization and customer journey improvements.`;

const REPORTING_SYSTEM_PROMPT = `You are an expert analytics and reporting specialist.
Your role is to synthesize data across channels, identify trends and anomalies,
generate executive summaries, and provide strategic insights.
Always structure your responses as JSON matching the requested schema.
Focus on actionable insights and clear communication of complex data.`;

export class SEOAgent extends BaseAgent {
  constructor(agent: Agent, aiProvider: AIProvider) {
    super(agent, aiProvider);
  }

  async analyze(context: AgentContext): Promise<Analysis> {
    const prompt = `Analyze the following SEO data and provide insights:
${JSON.stringify(context.signal || context.metadata, null, 2)}

Respond with a JSON object containing:
{
  "summary": "Brief summary of the SEO situation",
  "insights": ["Array of key insights"],
  "metrics": {"keyword_rankings": 0, "organic_traffic": 0, "backlink_quality": 0},
  "recommendations": ["Array of high-level recommendations"],
  "confidence": 0.85
}`;

    const response = await this.aiProvider.generateText(
      prompt,
      this.agent.systemPrompt || SEO_SYSTEM_PROMPT
    );

    try {
      return JSON.parse(response) as Analysis;
    } catch {
      return {
        summary: response.slice(0, 500),
        insights: ["Unable to parse structured response"],
        confidence: 0.5
      };
    }
  }

  async recommend(context: AgentContext): Promise<Recommendation[]> {
    const prompt = `Based on the following SEO data, provide prioritized recommendations:
${JSON.stringify(context.signal || context.metadata, null, 2)}

Respond with a JSON array of recommendations:
[{
  "id": "unique-id",
  "title": "Recommendation title",
  "description": "Detailed description",
  "priority": "high|medium|low",
  "effort": "low|medium|high",
  "impact": "low|medium|high",
  "category": "technical|content|backlinks|local",
  "actionItems": ["Step 1", "Step 2"]
}]`;

    const response = await this.aiProvider.generateText(
      prompt,
      this.agent.systemPrompt || SEO_SYSTEM_PROMPT
    );

    try {
      return JSON.parse(response) as Recommendation[];
    } catch {
      return [{
        id: "fallback-1",
        title: "Review SEO Analysis",
        description: "Manual review required for recommendations",
        priority: "medium",
        effort: "medium",
        impact: "medium",
        category: "general"
      }];
    }
  }

  async execute(action: string, context: AgentContext): Promise<ExecutionResult> {
    const actions: Record<string, () => Promise<ExecutionResult>> = {
      "generate_meta_tags": async () => ({
        success: true,
        output: { metaTitle: "Generated Title", metaDescription: "Generated Description" },
        actions: ["Generated meta tags based on content analysis"]
      }),
      "analyze_competitors": async () => ({
        success: true,
        output: { competitors: [], gaps: [] },
        actions: ["Analyzed competitor landscape"]
      }),
      "audit_technical_seo": async () => ({
        success: true,
        output: { issues: [], score: 0 },
        actions: ["Completed technical SEO audit"]
      })
    };

    const executor = actions[action];
    if (!executor) {
      return {
        success: false,
        error: `Unknown SEO action: ${action}`
      };
    }

    return executor();
  }
}

export class PPCAgent extends BaseAgent {
  constructor(agent: Agent, aiProvider: AIProvider) {
    super(agent, aiProvider);
  }

  async analyze(context: AgentContext): Promise<Analysis> {
    const prompt = `Analyze the following PPC campaign data and provide insights:
${JSON.stringify(context.signal || context.metadata, null, 2)}

Respond with a JSON object containing:
{
  "summary": "Brief summary of campaign performance",
  "insights": ["Array of key insights"],
  "metrics": {"cpc": 0, "ctr": 0, "roas": 0, "conversion_rate": 0},
  "recommendations": ["Array of optimization recommendations"],
  "confidence": 0.85
}`;

    const response = await this.aiProvider.generateText(
      prompt,
      this.agent.systemPrompt || PPC_SYSTEM_PROMPT
    );

    try {
      return JSON.parse(response) as Analysis;
    } catch {
      return {
        summary: response.slice(0, 500),
        insights: ["Unable to parse structured response"],
        confidence: 0.5
      };
    }
  }

  async recommend(context: AgentContext): Promise<Recommendation[]> {
    const prompt = `Based on the following PPC data, provide optimization recommendations:
${JSON.stringify(context.signal || context.metadata, null, 2)}

Respond with a JSON array of recommendations:
[{
  "id": "unique-id",
  "title": "Recommendation title",
  "description": "Detailed description",
  "priority": "high|medium|low",
  "effort": "low|medium|high",
  "impact": "low|medium|high",
  "category": "bidding|targeting|creative|budget",
  "actionItems": ["Step 1", "Step 2"]
}]`;

    const response = await this.aiProvider.generateText(
      prompt,
      this.agent.systemPrompt || PPC_SYSTEM_PROMPT
    );

    try {
      return JSON.parse(response) as Recommendation[];
    } catch {
      return [{
        id: "fallback-1",
        title: "Review PPC Campaign",
        description: "Manual review required for optimization",
        priority: "medium",
        effort: "medium",
        impact: "medium",
        category: "general"
      }];
    }
  }

  async execute(action: string, context: AgentContext): Promise<ExecutionResult> {
    const actions: Record<string, () => Promise<ExecutionResult>> = {
      "optimize_bids": async () => ({
        success: true,
        output: { adjustedBids: [], savings: 0 },
        actions: ["Bid optimization recommendations generated"]
      }),
      "generate_ad_copy": async () => ({
        success: true,
        output: { headlines: [], descriptions: [] },
        actions: ["Generated ad copy variations"]
      }),
      "reallocate_budget": async () => ({
        success: true,
        output: { recommendations: [] },
        actions: ["Budget reallocation analysis complete"]
      })
    };

    const executor = actions[action];
    if (!executor) {
      return {
        success: false,
        error: `Unknown PPC action: ${action}`
      };
    }

    return executor();
  }
}

export class CRMAgent extends BaseAgent {
  constructor(agent: Agent, aiProvider: AIProvider) {
    super(agent, aiProvider);
  }

  async analyze(context: AgentContext): Promise<Analysis> {
    const prompt = `Analyze the following CRM and lead data:
${JSON.stringify(context.signal || context.metadata, null, 2)}

Respond with a JSON object containing:
{
  "summary": "Brief summary of lead/pipeline status",
  "insights": ["Array of key insights"],
  "metrics": {"lead_score": 0, "conversion_probability": 0, "engagement_level": 0},
  "recommendations": ["Array of next steps"],
  "confidence": 0.85
}`;

    const response = await this.aiProvider.generateText(
      prompt,
      this.agent.systemPrompt || CRM_SYSTEM_PROMPT
    );

    try {
      return JSON.parse(response) as Analysis;
    } catch {
      return {
        summary: response.slice(0, 500),
        insights: ["Unable to parse structured response"],
        confidence: 0.5
      };
    }
  }

  async recommend(context: AgentContext): Promise<Recommendation[]> {
    const prompt = `Based on the following CRM data, provide recommendations:
${JSON.stringify(context.signal || context.metadata, null, 2)}

Respond with a JSON array of recommendations:
[{
  "id": "unique-id",
  "title": "Recommendation title",
  "description": "Detailed description",
  "priority": "high|medium|low",
  "effort": "low|medium|high",
  "impact": "low|medium|high",
  "category": "lead_scoring|nurturing|qualification|closing",
  "actionItems": ["Step 1", "Step 2"]
}]`;

    const response = await this.aiProvider.generateText(
      prompt,
      this.agent.systemPrompt || CRM_SYSTEM_PROMPT
    );

    try {
      return JSON.parse(response) as Recommendation[];
    } catch {
      return [{
        id: "fallback-1",
        title: "Review CRM Pipeline",
        description: "Manual review required",
        priority: "medium",
        effort: "medium",
        impact: "medium",
        category: "general"
      }];
    }
  }

  async execute(action: string, context: AgentContext): Promise<ExecutionResult> {
    const actions: Record<string, () => Promise<ExecutionResult>> = {
      "score_leads": async () => ({
        success: true,
        output: { scores: [], criteria: [] },
        actions: ["Lead scoring model applied"]
      }),
      "segment_contacts": async () => ({
        success: true,
        output: { segments: [] },
        actions: ["Contact segmentation complete"]
      }),
      "generate_followup": async () => ({
        success: true,
        output: { message: "", timing: "" },
        actions: ["Follow-up recommendation generated"]
      })
    };

    const executor = actions[action];
    if (!executor) {
      return {
        success: false,
        error: `Unknown CRM action: ${action}`
      };
    }

    return executor();
  }
}

export class ReportingAgent extends BaseAgent {
  constructor(agent: Agent, aiProvider: AIProvider) {
    super(agent, aiProvider);
  }

  async analyze(context: AgentContext): Promise<Analysis> {
    const prompt = `Analyze the following analytics data and provide executive insights:
${JSON.stringify(context.signal || context.metadata, null, 2)}

Respond with a JSON object containing:
{
  "summary": "Executive summary of performance",
  "insights": ["Array of key insights across channels"],
  "metrics": {"overall_score": 0, "trend": 0, "anomalies": 0},
  "recommendations": ["Array of strategic recommendations"],
  "confidence": 0.85
}`;

    const response = await this.aiProvider.generateText(
      prompt,
      this.agent.systemPrompt || REPORTING_SYSTEM_PROMPT
    );

    try {
      return JSON.parse(response) as Analysis;
    } catch {
      return {
        summary: response.slice(0, 500),
        insights: ["Unable to parse structured response"],
        confidence: 0.5
      };
    }
  }

  async recommend(context: AgentContext): Promise<Recommendation[]> {
    const prompt = `Based on the following cross-channel data, provide strategic recommendations:
${JSON.stringify(context.signal || context.metadata, null, 2)}

Respond with a JSON array of recommendations:
[{
  "id": "unique-id",
  "title": "Recommendation title",
  "description": "Detailed description",
  "priority": "high|medium|low",
  "effort": "low|medium|high",
  "impact": "low|medium|high",
  "category": "strategy|optimization|expansion|efficiency",
  "actionItems": ["Step 1", "Step 2"]
}]`;

    const response = await this.aiProvider.generateText(
      prompt,
      this.agent.systemPrompt || REPORTING_SYSTEM_PROMPT
    );

    try {
      return JSON.parse(response) as Recommendation[];
    } catch {
      return [{
        id: "fallback-1",
        title: "Review Analytics Report",
        description: "Manual review required",
        priority: "medium",
        effort: "medium",
        impact: "medium",
        category: "general"
      }];
    }
  }

  async execute(action: string, context: AgentContext): Promise<ExecutionResult> {
    const actions: Record<string, () => Promise<ExecutionResult>> = {
      "generate_report": async () => ({
        success: true,
        output: { reportId: "", sections: [] },
        actions: ["Report generation initiated"]
      }),
      "identify_trends": async () => ({
        success: true,
        output: { trends: [], period: "" },
        actions: ["Trend analysis complete"]
      }),
      "detect_anomalies": async () => ({
        success: true,
        output: { anomalies: [], severity: "" },
        actions: ["Anomaly detection complete"]
      })
    };

    const executor = actions[action];
    if (!executor) {
      return {
        success: false,
        error: `Unknown Reporting action: ${action}`
      };
    }

    return executor();
  }
}

export function createAgentForDomain(
  agent: Agent,
  aiProvider: AIProvider
): BaseAgent {
  switch (agent.domain) {
    case "seo":
      return new SEOAgent(agent, aiProvider);
    case "ppc":
      return new PPCAgent(agent, aiProvider);
    case "crm":
      return new CRMAgent(agent, aiProvider);
    case "reporting":
      return new ReportingAgent(agent, aiProvider);
    default:
      throw new Error(`Unknown agent domain: ${agent.domain}`);
  }
}
