export interface MetricData {
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

export interface ObservationInsight {
  label: string;
  value: string;
  context?: string;
}

export interface RecommendationOutput {
  title: string;
  observation: string;
  observationInsights: ObservationInsight[];
  proposedAction: string;
  actionTasks: string[];
  impact: "High" | "Medium" | "Low";
  estimatedCost: number;
  triggerMetric: string;
  baselineValue: number;
}

export type Preset = "quick-wins" | "strategic-growth" | "full-audit";

export interface LighthouseSummary {
  summary: string;
  recommendations: string[];
}

export interface ChatAnalysis {
  painPoints: string[];
  recentWins: string[];
  activeQuestions: string[];
}

export interface GenerateTextOptions {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIProvider {
  analyzeClientMetrics(
    clientName: string,
    ga4Metrics: MetricData[],
    gscMetrics: MetricData[],
    objectives?: string,
    preset?: Preset,
    competitorContext?: string,
    hubspotData?: any,
    linkedinData?: any
  ): Promise<RecommendationOutput[]>;

  analyzeDataOnDemand(
    clientName: string,
    contextData: any,
    question: string
  ): Promise<RecommendationOutput>;

  summarizeLighthouseReport(
    url: string,
    lighthouseReport: any
  ): Promise<LighthouseSummary>;

  analyzeChatHistory(
    chatHistory: string
  ): Promise<ChatAnalysis>;

  generateText(options: GenerateTextOptions): Promise<string>;
}
