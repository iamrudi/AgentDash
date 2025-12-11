import { storage } from "../storage";
import { signalEmitter } from "./signal-emitter";
import type {
  InsertRecommendationOutcome,
  InsertRecommendationQualityMetric,
  RecommendationOutcome,
  RecommendationQualityMetric,
} from "@shared/schema";

export interface OutcomeCapture {
  initiativeId: string;
  agencyId: string;
  clientId?: string;
  recommendationType: string;
  recommendationSourceId?: string;
  accepted: boolean;
  outcomeStatus: "pending" | "success" | "partial_success" | "failure" | "cancelled";
  predictedImpact?: Record<string, unknown>;
  actualImpact?: Record<string, unknown>;
  notes?: string;
}

export interface CalibrationSignal {
  type: "high_rejection" | "low_success" | "high_variance" | "pattern_detected";
  severity: "low" | "medium" | "high" | "critical";
  recommendationType: string;
  clientId?: string;
  metrics: Record<string, number>;
  suggestedAction: string;
}

const REJECTION_THRESHOLD = 0.4;
const SUCCESS_THRESHOLD = 0.5;
const VARIANCE_THRESHOLD = 0.3;
const MIN_SAMPLE_SIZE = 5;

export class OutcomeFeedbackService {
  
  async captureOutcome(outcome: OutcomeCapture): Promise<RecommendationOutcome> {
    const varianceScore = this.calculateImpactVariance(
      outcome.predictedImpact,
      outcome.actualImpact
    );
    
    const varianceDirection = varianceScore !== undefined
      ? varianceScore > 0.1 ? "overperformed" : varianceScore < -0.1 ? "underperformed" : "on_target"
      : undefined;

    const outcomeData: InsertRecommendationOutcome = {
      agencyId: outcome.agencyId,
      initiativeId: outcome.initiativeId,
      recommendationSourceId: outcome.recommendationSourceId,
      clientId: outcome.clientId,
      recommendationType: outcome.recommendationType,
      outcomeStatus: outcome.outcomeStatus,
      predictedImpact: outcome.predictedImpact,
      actualImpact: outcome.actualImpact,
      varianceScore: varianceScore?.toString(),
      varianceDirection,
      acceptedAt: outcome.accepted ? new Date() : undefined,
      rejectedAt: !outcome.accepted ? new Date() : undefined,
      completedAt: outcome.outcomeStatus !== "pending" ? new Date() : undefined,
      measuredAt: outcome.actualImpact ? new Date() : undefined,
      outcomeNotes: outcome.notes,
    };

    const created = await storage.createRecommendationOutcome(outcomeData);

    await this.updateQualityMetrics(outcome.agencyId, outcome.clientId, outcome.recommendationType);
    await this.checkAndEmitCalibrationSignals(outcome.agencyId, outcome.clientId, outcome.recommendationType);

    return created;
  }

  async updateOutcome(
    outcomeId: string,
    updates: {
      outcomeStatus?: "pending" | "success" | "partial_success" | "failure" | "cancelled";
      actualImpact?: Record<string, unknown>;
      notes?: string;
      lessonsLearned?: string;
    }
  ): Promise<RecommendationOutcome | undefined> {
    const existing = await storage.getRecommendationOutcome(outcomeId);
    if (!existing) return undefined;

    const varianceScore = updates.actualImpact 
      ? this.calculateImpactVariance(existing.predictedImpact as Record<string, unknown> | undefined, updates.actualImpact)
      : existing.varianceScore ? parseFloat(existing.varianceScore) : undefined;

    const varianceDirection = varianceScore !== undefined
      ? varianceScore > 0.1 ? "overperformed" : varianceScore < -0.1 ? "underperformed" : "on_target"
      : existing.varianceDirection;

    const updated = await storage.updateRecommendationOutcome(outcomeId, {
      outcomeStatus: updates.outcomeStatus,
      actualImpact: updates.actualImpact,
      varianceScore: varianceScore?.toString(),
      varianceDirection,
      completedAt: updates.outcomeStatus && updates.outcomeStatus !== "pending" ? new Date() : undefined,
      measuredAt: updates.actualImpact ? new Date() : undefined,
      outcomeNotes: updates.notes,
      lessonsLearned: updates.lessonsLearned,
    });

    if (updated) {
      await this.updateQualityMetrics(updated.agencyId, updated.clientId || undefined, updated.recommendationType);
      await this.checkAndEmitCalibrationSignals(updated.agencyId, updated.clientId || undefined, updated.recommendationType);
    }

    return updated;
  }

  calculateImpactVariance(
    predicted?: Record<string, unknown>,
    actual?: Record<string, unknown>
  ): number | undefined {
    if (!predicted || !actual) return undefined;

    const variances: number[] = [];
    
    for (const key of Object.keys(predicted)) {
      const predictedValue = Number(predicted[key]);
      const actualValue = Number(actual[key]);
      
      if (isNaN(predictedValue) || isNaN(actualValue)) continue;
      if (predictedValue === 0) continue;
      
      const variance = (actualValue - predictedValue) / predictedValue;
      variances.push(variance);
    }

    if (variances.length === 0) return undefined;
    
    return variances.reduce((a, b) => a + b, 0) / variances.length;
  }

  async updateQualityMetrics(
    agencyId: string,
    clientId: string | undefined,
    recommendationType: string
  ): Promise<void> {
    const { periodStart, periodEnd } = this.getCurrentPeriodBounds();
    
    const outcomes = await storage.getRecommendationOutcomes(agencyId, {
      clientId,
      recommendationType,
      periodStart,
      periodEnd,
    });

    if (outcomes.length === 0) return;

    const acceptedCount = outcomes.filter((o: RecommendationOutcome) => o.acceptedAt !== null).length;
    const rejectedCount = outcomes.filter((o: RecommendationOutcome) => o.rejectedAt !== null).length;
    const completedOutcomes = outcomes.filter((o: RecommendationOutcome) => o.completedAt !== null);
    const successCount = completedOutcomes.filter((o: RecommendationOutcome) => 
      o.outcomeStatus === "success" || o.outcomeStatus === "partial_success"
    ).length;
    const failureCount = completedOutcomes.filter((o: RecommendationOutcome) => 
      o.outcomeStatus === "failure"
    ).length;

    const varianceValues = outcomes
      .map((o: RecommendationOutcome) => o.varianceScore)
      .filter((v: string | null): v is string => v !== null)
      .map((v: string) => parseFloat(v));

    const avgVariance = varianceValues.length > 0
      ? varianceValues.reduce((a: number, b: number) => a + b, 0) / varianceValues.length
      : 0;

    const overperformCount = outcomes.filter((o: RecommendationOutcome) => o.varianceDirection === "overperformed").length;
    const underperformCount = outcomes.filter((o: RecommendationOutcome) => o.varianceDirection === "underperformed").length;

    const sampleCount = outcomes.length;
    const confidenceLevel = sampleCount >= 20 ? "high" : sampleCount >= 10 ? "medium" : "low";

    const acceptanceRate = sampleCount > 0 ? acceptedCount / sampleCount : 0;
    const successRate = completedOutcomes.length > 0 ? successCount / completedOutcomes.length : 0;
    const completionRate = sampleCount > 0 ? completedOutcomes.length / sampleCount : 0;

    const qualityScore = this.computeQualityScore(acceptanceRate, successRate, avgVariance);

    const metricData: InsertRecommendationQualityMetric = {
      agencyId,
      clientId,
      recommendationType,
      periodStart,
      periodEnd,
      totalRecommendations: sampleCount,
      acceptedCount,
      rejectedCount,
      completedCount: completedOutcomes.length,
      successCount,
      failureCount,
      acceptanceRate: acceptanceRate.toString(),
      successRate: successRate.toString(),
      completionRate: completionRate.toString(),
      avgVarianceScore: avgVariance.toString(),
      overperformCount,
      underperformCount,
      qualityScore: qualityScore.toString(),
      confidenceLevel,
    };

    await storage.upsertRecommendationQualityMetric(metricData);
  }

  private computeQualityScore(acceptanceRate: number, successRate: number, avgVariance: number): number {
    const variancePenalty = Math.abs(avgVariance) * 0.5;
    const score = (acceptanceRate * 0.3) + (successRate * 0.5) + ((1 - variancePenalty) * 0.2);
    return Math.max(0, Math.min(1, score));
  }

  async checkAndEmitCalibrationSignals(
    agencyId: string,
    clientId: string | undefined,
    recommendationType: string
  ): Promise<void> {
    const { periodStart, periodEnd } = this.getCurrentPeriodBounds();
    const metric = await storage.getRecommendationQualityMetric(agencyId, recommendationType, periodStart, periodEnd, clientId);
    
    if (!metric || (metric.totalRecommendations ?? 0) < MIN_SAMPLE_SIZE) return;

    const signals: CalibrationSignal[] = [];

    const acceptanceRate = metric.acceptanceRate ? parseFloat(metric.acceptanceRate) : 1;
    if (acceptanceRate < (1 - REJECTION_THRESHOLD)) {
      signals.push({
        type: "high_rejection",
        severity: acceptanceRate < 0.3 ? "critical" : "high",
        recommendationType,
        clientId,
        metrics: { acceptanceRate, rejectedCount: metric.rejectedCount ?? 0 },
        suggestedAction: "Review recommendation relevance and targeting for this client/type combination",
      });
    }

    const successRate = metric.successRate ? parseFloat(metric.successRate) : 1;
    const measuredCount = (metric.successCount ?? 0) + (metric.failureCount ?? 0);
    if (successRate < SUCCESS_THRESHOLD && measuredCount >= MIN_SAMPLE_SIZE) {
      signals.push({
        type: "low_success",
        severity: successRate < 0.3 ? "critical" : "high",
        recommendationType,
        clientId,
        metrics: { successRate, successCount: metric.successCount ?? 0, failureCount: metric.failureCount ?? 0 },
        suggestedAction: "Analyze failed recommendations and adjust confidence thresholds",
      });
    }

    const avgVariance = metric.avgVarianceScore ? parseFloat(metric.avgVarianceScore) : 0;
    if (Math.abs(avgVariance) > VARIANCE_THRESHOLD) {
      signals.push({
        type: "high_variance",
        severity: Math.abs(avgVariance) > 0.5 ? "high" : "medium",
        recommendationType,
        clientId,
        metrics: { avgVariance, underperformCount: metric.underperformCount ?? 0, overperformCount: metric.overperformCount ?? 0 },
        suggestedAction: "Recalibrate impact prediction models for this recommendation type",
      });
    }

    for (const signal of signals) {
      await signalEmitter.emit(agencyId, {
        sourceSystem: "FEEDBACK_LOOP",
        signalType: `calibration:${signal.type}`,
        category: "ai_calibration",
        severity: signal.severity,
        payload: {
          recommendationType: signal.recommendationType,
          clientId: signal.clientId,
          metrics: signal.metrics,
          suggestedAction: signal.suggestedAction,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
        },
        clientId: signal.clientId,
        correlationKey: `calibration:${recommendationType}:${clientId || "global"}`,
      });
    }
  }

  async getQualityDashboard(agencyId: string, options?: {
    clientId?: string;
    periods?: number;
  }): Promise<{
    overallMetrics: Record<string, RecommendationQualityMetric[]>;
    clientMetrics: Record<string, RecommendationQualityMetric[]>;
    calibrationNeeded: CalibrationSignal[];
  }> {
    const periodsCount = options?.periods || 6;
    const recentPeriods = this.getRecentPeriodBounds(periodsCount);
    
    const overallMetrics: Record<string, RecommendationQualityMetric[]> = {};
    const clientMetrics: Record<string, RecommendationQualityMetric[]> = {};
    const calibrationNeeded: CalibrationSignal[] = [];

    for (const period of recentPeriods) {
      const metrics = await storage.getRecommendationQualityMetrics(agencyId, { 
        periodStart: period.periodStart, 
        periodEnd: period.periodEnd,
        clientId: options?.clientId 
      });
      
      for (const metric of metrics) {
        const key = metric.recommendationType;
        
        if (metric.clientId) {
          const clientKey = `${metric.clientId}:${key}`;
          if (!clientMetrics[clientKey]) clientMetrics[clientKey] = [];
          clientMetrics[clientKey].push(metric);
        } else {
          if (!overallMetrics[key]) overallMetrics[key] = [];
          overallMetrics[key].push(metric);
        }

        if (period === recentPeriods[0] && (metric.totalRecommendations ?? 0) >= MIN_SAMPLE_SIZE) {
          const signals = this.detectCalibrationNeeds(metric);
          calibrationNeeded.push(...signals);
        }
      }
    }

    return { overallMetrics, clientMetrics, calibrationNeeded };
  }

  private detectCalibrationNeeds(metric: RecommendationQualityMetric): CalibrationSignal[] {
    const signals: CalibrationSignal[] = [];
    
    const acceptanceRate = metric.acceptanceRate ? parseFloat(metric.acceptanceRate) : 1;
    if (acceptanceRate < (1 - REJECTION_THRESHOLD)) {
      signals.push({
        type: "high_rejection",
        severity: acceptanceRate < 0.3 ? "critical" : "high",
        recommendationType: metric.recommendationType,
        clientId: metric.clientId || undefined,
        metrics: { acceptanceRate, rejectedCount: metric.rejectedCount ?? 0 },
        suggestedAction: "Review recommendation relevance and targeting",
      });
    }

    const successRate = metric.successRate ? parseFloat(metric.successRate) : 1;
    if (successRate < SUCCESS_THRESHOLD) {
      signals.push({
        type: "low_success",
        severity: successRate < 0.3 ? "critical" : "high",
        recommendationType: metric.recommendationType,
        clientId: metric.clientId || undefined,
        metrics: { successRate },
        suggestedAction: "Analyze failed recommendations and adjust models",
      });
    }

    return signals;
  }

  private getCurrentPeriodBounds(): { periodStart: Date; periodEnd: Date } {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { periodStart, periodEnd };
  }

  private getRecentPeriodBounds(count: number): { periodStart: Date; periodEnd: Date }[] {
    const periods: { periodStart: Date; periodEnd: Date }[] = [];
    const now = new Date();
    
    for (let i = 0; i < count; i++) {
      const periodStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      periods.push({ periodStart, periodEnd });
    }
    
    return periods;
  }
}

export const outcomeFeedbackService = new OutcomeFeedbackService();
