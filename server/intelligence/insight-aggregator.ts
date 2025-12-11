import { storage } from "../storage";
import type { IntelligenceSignal, InsertIntelligenceInsight } from "@shared/schema";

export interface AggregatorConfig {
  correlationWindow: number;
  minConfidenceThreshold: number;
  maxSignalsPerBatch: number;
}

const DEFAULT_CONFIG: AggregatorConfig = {
  correlationWindow: 24 * 60 * 60 * 1000,
  minConfidenceThreshold: 0.3,
  maxSignalsPerBatch: 100,
};

export interface SignalGroup {
  correlationKey: string | null;
  signals: IntelligenceSignal[];
  category: string;
  severity: string | null;
  clientId: string | null;
}

export class InsightAggregator {
  private config: AggregatorConfig;

  constructor(config: Partial<AggregatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async processSignals(agencyId: string): Promise<{ processed: number; insightsCreated: number }> {
    const unprocessedSignals = await storage.getUnprocessedIntelligenceSignals(
      agencyId, 
      this.config.maxSignalsPerBatch
    );

    if (unprocessedSignals.length === 0) {
      return { processed: 0, insightsCreated: 0 };
    }

    const groups = this.groupSignals(unprocessedSignals);
    let insightsCreated = 0;

    for (const group of groups) {
      const insight = await this.aggregateToInsight(agencyId, group);
      if (insight) {
        await storage.createIntelligenceInsight(insight);
        insightsCreated++;

        for (const signal of group.signals) {
          await storage.markSignalProcessedToInsight(signal.id);
        }
      }
    }

    return { processed: unprocessedSignals.length, insightsCreated };
  }

  private groupSignals(signals: IntelligenceSignal[]): SignalGroup[] {
    const groups = new Map<string, SignalGroup>();

    for (const signal of signals) {
      const groupKey = this.computeGroupKey(signal);
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          correlationKey: signal.correlationKey,
          signals: [],
          category: signal.category,
          severity: signal.severity,
          clientId: signal.clientId,
        });
      }

      const group = groups.get(groupKey)!;
      group.signals.push(signal);

      const signalSeverity = signal.severity || "low";
      const groupSeverity = group.severity || "low";
      if (this.compareSeverity(signalSeverity, groupSeverity) > 0) {
        group.severity = signal.severity;
      }
    }

    return Array.from(groups.values());
  }

  private computeGroupKey(signal: IntelligenceSignal): string {
    const parts = [
      signal.agencyId,
      signal.category,
      signal.signalType,
      signal.correlationKey || "no-correlation",
      signal.clientId || "no-client",
    ];
    return parts.join("::");
  }

  private compareSeverity(a: string, b: string): number {
    const order = ["low", "medium", "high", "critical"];
    return order.indexOf(a) - order.indexOf(b);
  }

  private async aggregateToInsight(agencyId: string, group: SignalGroup): Promise<InsertIntelligenceInsight | null> {
    if (group.signals.length === 0) {
      return null;
    }

    const confidence = this.calculateConfidence(group);
    if (confidence < this.config.minConfidenceThreshold) {
      for (const signal of group.signals) {
        await storage.discardSignal(signal.id, `Low confidence: ${confidence.toFixed(2)}`);
      }
      return null;
    }

    const sourceSignalIds = group.signals.map(s => s.id);
    const summary = this.generateSummary(group);
    const suggestedAction = this.generateSuggestedAction(group);
    const potentialImpact = this.estimateImpact(group);

    return {
      agencyId,
      title: this.generateTitle(group),
      description: `${summary}\n\nPotential Impact: ${potentialImpact}`,
      insightType: group.category,
      severity: group.severity || "medium",
      confidenceScore: confidence.toString(),
      sourceSignalIds,
      suggestedAction,
      clientId: group.clientId,
      status: "open",
      createdByAgent: "insight_aggregator_v1",
    };
  }

  private calculateConfidence(group: SignalGroup): number {
    const signalCount = group.signals.length;
    const countFactor = Math.min(signalCount / 5, 1) * 0.3;

    const severityScores: Record<string, number> = {
      critical: 1.0,
      high: 0.8,
      medium: 0.6,
      low: 0.4,
    };
    const groupSeverity = group.severity || "medium";
    const severityFactor = (severityScores[groupSeverity] || 0.5) * 0.3;

    const hasCorrelation = group.correlationKey !== null;
    const correlationFactor = hasCorrelation ? 0.2 : 0.1;

    const baseConfidence = 0.5;
    const signalConfidenceFactor = baseConfidence * 0.2;

    return Math.min(countFactor + severityFactor + correlationFactor + signalConfidenceFactor, 1.0);
  }

  private generateTitle(group: SignalGroup): string {
    const categoryTitles: Record<string, string> = {
      analytics: "Analytics Alert",
      crm: "CRM Activity",
      workflow: "Workflow Event",
      performance: "Performance Issue",
      engagement: "Engagement Change",
      revenue: "Revenue Signal",
    };

    const base = categoryTitles[group.category] || "Intelligence Insight";
    const groupSeverity = group.severity || "medium";
    const severityPrefix = groupSeverity === "critical" || groupSeverity === "high" 
      ? `[${groupSeverity.toUpperCase()}] ` 
      : "";

    return `${severityPrefix}${base}: ${group.signals.length} related signal(s)`;
  }

  private generateSummary(group: SignalGroup): string {
    const signalTypes = Array.from(new Set(group.signals.map(s => s.signalType)));
    const sources = Array.from(new Set(group.signals.map(s => s.sourceSystem)));
    
    const lines = [
      `Aggregated from ${group.signals.length} signal(s) in the ${group.category} category.`,
      `Signal types: ${signalTypes.join(", ")}`,
      `Sources: ${sources.join(", ")}`,
    ];

    if (group.correlationKey) {
      lines.push(`Correlation key: ${group.correlationKey}`);
    }

    const timeRange = this.getTimeRange(group.signals);
    lines.push(`Time range: ${timeRange.start.toISOString()} to ${timeRange.end.toISOString()}`);

    return lines.join("\n");
  }

  private getTimeRange(signals: IntelligenceSignal[]): { start: Date; end: Date } {
    const times = signals.map(s => new Date(s.occurredAt).getTime());
    return {
      start: new Date(Math.min(...times)),
      end: new Date(Math.max(...times)),
    };
  }

  private generateSuggestedAction(group: SignalGroup): string {
    const actionTemplates: Record<string, Record<string, string>> = {
      analytics: {
        critical: "Investigate traffic anomaly immediately and check for technical issues",
        high: "Review analytics data and assess impact on campaign performance",
        medium: "Monitor trends and prepare adjustment recommendations",
        low: "Note for next reporting cycle",
      },
      crm: {
        critical: "Urgent: Contact key account immediately",
        high: "Schedule follow-up call within 24 hours",
        medium: "Add to weekly review queue",
        low: "Update CRM records as needed",
      },
      workflow: {
        critical: "Immediate intervention required - check workflow execution",
        high: "Review workflow configuration and recent executions",
        medium: "Schedule workflow optimization review",
        low: "Document for process improvement",
      },
      performance: {
        critical: "Emergency: Site/campaign performance critical - investigate now",
        high: "Priority optimization needed - technical review required",
        medium: "Add to optimization backlog",
        low: "Monitor and document",
      },
    };

    const categoryActions = actionTemplates[group.category] || actionTemplates.workflow;
    const severityKey = group.severity || "medium";
    return categoryActions[severityKey] || "Review and assess appropriate action";
  }

  private estimateImpact(group: SignalGroup): string {
    const impactFactors = [];

    if (group.severity === "critical") {
      impactFactors.push("Immediate business risk");
    } else if (group.severity === "high") {
      impactFactors.push("Significant performance impact");
    }

    if (group.clientId) {
      impactFactors.push("Client-specific");
    }

    if (group.signals.length > 3) {
      impactFactors.push("Pattern indicates systemic issue");
    }

    const categoryImpacts: Record<string, string> = {
      revenue: "Direct revenue impact",
      analytics: "Traffic/conversion impact",
      crm: "Client relationship impact",
      engagement: "User experience impact",
    };

    if (categoryImpacts[group.category]) {
      impactFactors.push(categoryImpacts[group.category]);
    }

    return impactFactors.join("; ") || "Impact assessment pending";
  }
}

export const insightAggregator = new InsightAggregator();
