import { storage } from "../storage";
import type { IntelligenceInsight, InsertIntelligencePriority, IntelligencePriorityConfig } from "@shared/schema";

export interface PriorityWeights {
  wImpact: number;
  wUrgency: number;
  wConfidence: number;
  wResource: number;
}

const DEFAULT_WEIGHTS: PriorityWeights = {
  wImpact: 0.4,
  wUrgency: 0.3,
  wConfidence: 0.2,
  wResource: 0.1,
};

export interface PriorityBucket {
  name: string;
  minScore: number;
  maxScore: number;
}

const PRIORITY_BUCKETS: PriorityBucket[] = [
  { name: "critical", minScore: 0.85, maxScore: 1.0 },
  { name: "high", minScore: 0.7, maxScore: 0.85 },
  { name: "medium", minScore: 0.5, maxScore: 0.7 },
  { name: "low", minScore: 0.3, maxScore: 0.5 },
  { name: "monitor", minScore: 0.0, maxScore: 0.3 },
];

export class PriorityEngine {
  async processInsights(agencyId: string): Promise<{ processed: number; prioritiesCreated: number }> {
    const insights = await storage.getOpenIntelligenceInsights(agencyId);
    
    if (insights.length === 0) {
      return { processed: 0, prioritiesCreated: 0 };
    }

    const weights = await this.getAgencyWeights(agencyId);
    let prioritiesCreated = 0;

    for (const insight of insights) {
      const priority = await this.computePriority(agencyId, insight, weights);
      await storage.createIntelligencePriority(priority);
      await storage.updateIntelligenceInsightStatus(insight.id, "prioritised");
      prioritiesCreated++;
    }

    return { processed: insights.length, prioritiesCreated };
  }

  private async getAgencyWeights(agencyId: string): Promise<PriorityWeights> {
    const config = await storage.getIntelligencePriorityConfig(agencyId);
    if (!config) {
      return DEFAULT_WEIGHTS;
    }

    return {
      wImpact: parseFloat(config.wImpact) || DEFAULT_WEIGHTS.wImpact,
      wUrgency: parseFloat(config.wUrgency) || DEFAULT_WEIGHTS.wUrgency,
      wConfidence: parseFloat(config.wConfidence) || DEFAULT_WEIGHTS.wConfidence,
      wResource: parseFloat(config.wResource) || DEFAULT_WEIGHTS.wResource,
    };
  }

  private async computePriority(
    agencyId: string,
    insight: IntelligenceInsight,
    weights: PriorityWeights
  ): Promise<InsertIntelligencePriority> {
    const impactScore = this.calculateImpactScore(insight);
    const urgencyScore = this.calculateUrgencyScore(insight);
    const confidenceScore = insight.confidenceScore ? parseFloat(insight.confidenceScore) : 0.5;
    const resourceScore = this.calculateResourceScore(insight);

    const totalWeight = weights.wImpact + weights.wUrgency + weights.wConfidence + weights.wResource;
    const normalizedWeights = {
      wImpact: weights.wImpact / totalWeight,
      wUrgency: weights.wUrgency / totalWeight,
      wConfidence: weights.wConfidence / totalWeight,
      wResource: weights.wResource / totalWeight,
    };

    const priorityScore = 
      impactScore * normalizedWeights.wImpact +
      urgencyScore * normalizedWeights.wUrgency +
      confidenceScore * normalizedWeights.wConfidence +
      resourceScore * normalizedWeights.wResource;

    const rankingBucket = this.determineBucket(priorityScore);

    return {
      agencyId,
      insightId: insight.id,
      priorityScore: priorityScore.toString(),
      commercialImpactScore: impactScore.toString(),
      urgencyScore: urgencyScore.toString(),
      confidenceScore: confidenceScore.toString(),
      resourceFeasibilityScore: resourceScore.toString(),
      rankingBucket,
      status: "pending",
      recommendedDueDate: this.calculateDeadline(rankingBucket),
    };
  }

  private calculateImpactScore(insight: IntelligenceInsight): number {
    let score = 0.5;

    const severityScores: Record<string, number> = {
      critical: 1.0,
      high: 0.8,
      medium: 0.6,
      low: 0.4,
    };
    if (insight.severity) {
      score = severityScores[insight.severity] || 0.5;
    }

    if (insight.deltaPercent) {
      const delta = Math.abs(parseFloat(insight.deltaPercent));
      if (delta > 50) score = Math.min(score + 0.2, 1.0);
      else if (delta > 25) score = Math.min(score + 0.1, 1.0);
    }

    if (insight.clientId) {
      score = Math.min(score + 0.05, 1.0);
    }

    const highImpactTypes = ["revenue_drop", "conversion_rate_issue", "pipeline_shortfall"];
    if (highImpactTypes.includes(insight.insightType)) {
      score = Math.min(score + 0.1, 1.0);
    }

    return Math.max(0, Math.min(score, 1.0));
  }

  private calculateUrgencyScore(insight: IntelligenceInsight): number {
    let score = 0.5;

    const severityUrgency: Record<string, number> = {
      critical: 1.0,
      high: 0.75,
      medium: 0.5,
      low: 0.25,
    };
    if (insight.severity) {
      score = severityUrgency[insight.severity] || 0.5;
    }

    const ageHours = (Date.now() - new Date(insight.createdAt).getTime()) / (1000 * 60 * 60);
    if (ageHours > 72) {
      score = Math.min(score + 0.2, 1.0);
    } else if (ageHours > 24) {
      score = Math.min(score + 0.1, 1.0);
    }

    const urgentTypes = ["sla_breach", "deadline_approaching", "critical_alert"];
    if (urgentTypes.includes(insight.insightType)) {
      score = Math.min(score + 0.15, 1.0);
    }

    return Math.max(0, Math.min(score, 1.0));
  }

  private calculateResourceScore(insight: IntelligenceInsight): number {
    let score = 0.6;

    const lowEffortTypes = ["content_update", "notification", "review_request"];
    const highEffortTypes = ["infrastructure_change", "major_campaign", "strategy_pivot"];

    if (lowEffortTypes.includes(insight.insightType)) {
      score = 0.9;
    } else if (highEffortTypes.includes(insight.insightType)) {
      score = 0.4;
    }

    if (insight.suggestedAction) {
      score = Math.min(score + 0.1, 1.0);
    }

    return Math.max(0, Math.min(score, 1.0));
  }

  private determineBucket(score: number): string {
    for (const bucket of PRIORITY_BUCKETS) {
      if (score >= bucket.minScore && score < bucket.maxScore) {
        return bucket.name;
      }
    }
    return "monitor";
  }

  private calculateDeadline(bucket: string): Date {
    const now = new Date();
    const deadlineHours: Record<string, number> = {
      critical: 4,
      high: 24,
      medium: 72,
      low: 168,
      monitor: 336,
    };

    const hours = deadlineHours[bucket] || 72;
    return new Date(now.getTime() + hours * 60 * 60 * 1000);
  }

  async getPriorityQueue(agencyId: string, limit?: number): Promise<InsertIntelligencePriority[]> {
    const priorities = await storage.getPendingIntelligencePriorities(agencyId);
    
    const sorted = priorities.sort((a, b) => {
      const scoreA = parseFloat(a.priorityScore);
      const scoreB = parseFloat(b.priorityScore);
      return scoreB - scoreA;
    });

    if (limit) {
      return sorted.slice(0, limit) as InsertIntelligencePriority[];
    }
    return sorted as InsertIntelligencePriority[];
  }

  computeScoreBreakdown(priority: InsertIntelligencePriority, weights: PriorityWeights): Record<string, number> {
    const impact = parseFloat(priority.commercialImpactScore);
    const urgency = parseFloat(priority.urgencyScore);
    const confidence = parseFloat(priority.confidenceScore);
    const resource = parseFloat(priority.resourceFeasibilityScore);

    const totalWeight = weights.wImpact + weights.wUrgency + weights.wConfidence + weights.wResource;

    return {
      impactContribution: (impact * weights.wImpact / totalWeight) * 100,
      urgencyContribution: (urgency * weights.wUrgency / totalWeight) * 100,
      confidenceContribution: (confidence * weights.wConfidence / totalWeight) * 100,
      resourceContribution: (resource * weights.wResource / totalWeight) * 100,
      totalScore: parseFloat(priority.priorityScore) * 100,
    };
  }
}

export const priorityEngine = new PriorityEngine();
