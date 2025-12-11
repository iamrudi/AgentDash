import { storage } from "../storage";
import type { 
  TaskExecutionHistory, 
  InsertTaskDurationPrediction,
  TaskDurationPrediction,
  InsertTaskExecutionHistory 
} from "@shared/schema";

export interface DurationModelConfig {
  recencyWeightDays: number;
  minSamplesForConfidence: number;
  maxSamplesForPrediction: number;
  coldStartBaselineHours: Record<string, number>;
  complexityMultipliers: Record<string, number>;
}

const DEFAULT_CONFIG: DurationModelConfig = {
  recencyWeightDays: 90,
  minSamplesForConfidence: 5,
  maxSamplesForPrediction: 50,
  coldStartBaselineHours: {
    trivial: 0.5,
    simple: 1,
    moderate: 2,
    complex: 4,
    very_complex: 8,
    default: 2,
  },
  complexityMultipliers: {
    trivial: 0.25,
    simple: 0.5,
    moderate: 1.0,
    complex: 2.0,
    very_complex: 4.0,
  },
};

export interface PredictionResult {
  predictedHours: number;
  confidenceScore: number;
  confidenceLevel: string;
  predictionRange: { min: number; max: number; p25: number; p75: number };
  baselineHours: number;
  assigneeOffset: number;
  clientOffset: number;
  contextSizeAdjustment: number;
  isColdStart: boolean;
  coldStartReason: string | null;
  fallbackLevel: string;
  sampleCount: number;
  sampleVariance: number | null;
  sampleRecencyDays: number | null;
}

export class DurationModelService {
  private config: DurationModelConfig;

  constructor(config: Partial<DurationModelConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async predictDuration(
    agencyId: string,
    taskType: string,
    complexity: string,
    assigneeId: string | null,
    clientId: string | null,
    contextSize: number | null
  ): Promise<PredictionResult> {
    const history = await storage.getTaskExecutionHistoryForPrediction(
      agencyId,
      taskType,
      complexity,
      assigneeId,
      clientId,
      this.config.maxSamplesForPrediction
    );

    let result: PredictionResult;

    if (history.length < this.config.minSamplesForConfidence) {
      result = this.coldStartPrediction(
        taskType,
        complexity,
        history,
        assigneeId,
        clientId
      );
    } else {
      result = this.layeredPrediction(
        history,
        taskType,
        complexity,
        assigneeId,
        clientId,
        contextSize
      );
    }

    return result;
  }

  private coldStartPrediction(
    taskType: string,
    complexity: string,
    availableHistory: TaskExecutionHistory[],
    assigneeId: string | null,
    clientId: string | null
  ): PredictionResult {
    const baselineHours = this.getBaselineHours(complexity);
    
    let coldStartReason = "insufficient_data";
    let fallbackLevel = "global";
    
    if (availableHistory.length === 0) {
      if (!clientId && !assigneeId) {
        coldStartReason = "new_agency";
        fallbackLevel = "global";
      } else if (clientId && !assigneeId) {
        coldStartReason = "new_client";
        fallbackLevel = "agency";
      } else if (assigneeId && !clientId) {
        coldStartReason = "new_assignee";
        fallbackLevel = "agency";
      } else {
        coldStartReason = "new_task_type";
        fallbackLevel = "channel";
      }
    }

    const variance = baselineHours * 0.5;
    
    return {
      predictedHours: baselineHours,
      confidenceScore: 0.2,
      confidenceLevel: "very_low",
      predictionRange: {
        min: Math.max(0.25, baselineHours - variance),
        max: baselineHours + variance,
        p25: Math.max(0.25, baselineHours - variance * 0.5),
        p75: baselineHours + variance * 0.5,
      },
      baselineHours,
      assigneeOffset: 0,
      clientOffset: 0,
      contextSizeAdjustment: 0,
      isColdStart: true,
      coldStartReason,
      fallbackLevel,
      sampleCount: availableHistory.length,
      sampleVariance: null,
      sampleRecencyDays: null,
    };
  }

  private layeredPrediction(
    history: TaskExecutionHistory[],
    taskType: string,
    complexity: string,
    assigneeId: string | null,
    clientId: string | null,
    contextSize: number | null
  ): PredictionResult {
    const baselineHours = this.calculateWeightedBaseline(history);
    
    const assigneeOffset = this.calculateAssigneeOffset(history, assigneeId);
    
    const clientOffset = this.calculateClientOffset(history, clientId);
    
    const contextSizeAdjustment = this.calculateContextSizeAdjustment(
      history,
      contextSize
    );

    const predictedHours = Math.max(
      0.25,
      baselineHours + assigneeOffset + clientOffset + contextSizeAdjustment
    );

    const { variance, stdDev } = this.calculateVariance(history);
    
    const { confidenceScore, confidenceLevel } = this.calculateConfidence(
      history.length,
      variance,
      this.calculateAverageRecencyDays(history)
    );

    const predictionRange = this.calculatePredictionRange(
      predictedHours,
      stdDev,
      confidenceScore
    );

    return {
      predictedHours: Math.round(predictedHours * 100) / 100,
      confidenceScore,
      confidenceLevel,
      predictionRange,
      baselineHours: Math.round(baselineHours * 100) / 100,
      assigneeOffset: Math.round(assigneeOffset * 100) / 100,
      clientOffset: Math.round(clientOffset * 100) / 100,
      contextSizeAdjustment: Math.round(contextSizeAdjustment * 100) / 100,
      isColdStart: false,
      coldStartReason: null,
      fallbackLevel: "full",
      sampleCount: history.length,
      sampleVariance: Math.round(variance * 100) / 100,
      sampleRecencyDays: Math.round(this.calculateAverageRecencyDays(history)),
    };
  }

  private getBaselineHours(complexity: string): number {
    return (
      this.config.coldStartBaselineHours[complexity] ||
      this.config.coldStartBaselineHours.default
    );
  }

  private calculateWeightedBaseline(history: TaskExecutionHistory[]): number {
    if (history.length === 0) return 2;

    let totalWeight = 0;
    let weightedSum = 0;

    for (const record of history) {
      const recencyWeight = this.getRecencyWeight(record.completedAt);
      const hours = parseFloat(record.actualHours);
      
      weightedSum += hours * recencyWeight;
      totalWeight += recencyWeight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 2;
  }

  private calculateAssigneeOffset(
    history: TaskExecutionHistory[],
    assigneeId: string | null
  ): number {
    if (!assigneeId) return 0;

    const assigneeHistory = history.filter(h => h.assigneeId === assigneeId);
    const otherHistory = history.filter(h => h.assigneeId !== assigneeId);

    if (assigneeHistory.length < 3 || otherHistory.length < 3) return 0;

    const assigneeAvg = this.averageActualHours(assigneeHistory);
    const otherAvg = this.averageActualHours(otherHistory);

    const offset = assigneeAvg - otherAvg;
    return Math.max(-2, Math.min(2, offset));
  }

  private calculateClientOffset(
    history: TaskExecutionHistory[],
    clientId: string | null
  ): number {
    if (!clientId) return 0;

    const clientHistory = history.filter(h => h.clientId === clientId);
    const otherHistory = history.filter(h => h.clientId !== clientId);

    if (clientHistory.length < 3 || otherHistory.length < 3) return 0;

    const clientAvg = this.averageActualHours(clientHistory);
    const otherAvg = this.averageActualHours(otherHistory);

    const offset = clientAvg - otherAvg;
    return Math.max(-1.5, Math.min(1.5, offset));
  }

  private calculateContextSizeAdjustment(
    history: TaskExecutionHistory[],
    contextSize: number | null
  ): number {
    if (!contextSize || contextSize <= 1) return 0;

    const withContext = history.filter(
      h => h.contextSize && h.contextSize > 1
    );

    if (withContext.length < 3) {
      return Math.log2(contextSize) * 0.5;
    }

    const hourPerContext = withContext.reduce((sum, h) => {
      const hours = parseFloat(h.actualHours);
      return sum + hours / (h.contextSize || 1);
    }, 0) / withContext.length;

    return hourPerContext * (contextSize - 1);
  }

  private averageActualHours(records: TaskExecutionHistory[]): number {
    if (records.length === 0) return 0;
    const sum = records.reduce((s, r) => s + parseFloat(r.actualHours), 0);
    return sum / records.length;
  }

  private getRecencyWeight(completedAt: Date): number {
    const now = new Date();
    const daysDiff = (now.getTime() - new Date(completedAt).getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysDiff <= 30) return 1.0;
    if (daysDiff <= 60) return 0.8;
    if (daysDiff <= 90) return 0.6;
    if (daysDiff <= 180) return 0.3;
    return 0.1;
  }

  private calculateVariance(history: TaskExecutionHistory[]): { variance: number; stdDev: number } {
    if (history.length < 2) return { variance: 0, stdDev: 0 };

    const hours = history.map(h => parseFloat(h.actualHours));
    const mean = hours.reduce((s, h) => s + h, 0) / hours.length;
    const squaredDiffs = hours.map(h => Math.pow(h - mean, 2));
    const variance = squaredDiffs.reduce((s, d) => s + d, 0) / hours.length;
    
    return { variance, stdDev: Math.sqrt(variance) };
  }

  private calculateAverageRecencyDays(history: TaskExecutionHistory[]): number {
    if (history.length === 0) return 0;

    const now = new Date();
    const totalDays = history.reduce((sum, h) => {
      const daysDiff = (now.getTime() - new Date(h.completedAt).getTime()) / (1000 * 60 * 60 * 24);
      return sum + daysDiff;
    }, 0);

    return totalDays / history.length;
  }

  private calculateConfidence(
    sampleCount: number,
    variance: number,
    avgRecencyDays: number
  ): { confidenceScore: number; confidenceLevel: string } {
    let score = 0;

    if (sampleCount >= 20) score += 0.4;
    else if (sampleCount >= 10) score += 0.3;
    else if (sampleCount >= 5) score += 0.2;
    else score += 0.1;

    if (variance < 0.5) score += 0.3;
    else if (variance < 1) score += 0.2;
    else if (variance < 2) score += 0.1;

    if (avgRecencyDays < 30) score += 0.3;
    else if (avgRecencyDays < 60) score += 0.2;
    else if (avgRecencyDays < 90) score += 0.1;

    score = Math.min(1, Math.max(0, score));

    let level: string;
    if (score >= 0.8) level = "very_high";
    else if (score >= 0.6) level = "high";
    else if (score >= 0.4) level = "medium";
    else if (score >= 0.2) level = "low";
    else level = "very_low";

    return { confidenceScore: Math.round(score * 100) / 100, confidenceLevel: level };
  }

  private calculatePredictionRange(
    predictedHours: number,
    stdDev: number,
    confidenceScore: number
  ): { min: number; max: number; p25: number; p75: number } {
    const uncertaintyMultiplier = 2 - confidenceScore;
    const range = stdDev * uncertaintyMultiplier;

    return {
      min: Math.max(0.25, Math.round((predictedHours - range * 1.5) * 100) / 100),
      max: Math.round((predictedHours + range * 1.5) * 100) / 100,
      p25: Math.max(0.25, Math.round((predictedHours - range * 0.67) * 100) / 100),
      p75: Math.round((predictedHours + range * 0.67) * 100) / 100,
    };
  }

  async savePrediction(
    agencyId: string,
    taskId: string,
    prediction: PredictionResult
  ): Promise<TaskDurationPrediction> {
    const insertData: InsertTaskDurationPrediction = {
      agencyId,
      taskId,
      predictedHours: prediction.predictedHours.toString(),
      confidenceScore: prediction.confidenceScore.toString(),
      confidenceLevel: prediction.confidenceLevel,
      predictionRange: prediction.predictionRange,
      baselineHours: prediction.baselineHours.toString(),
      assigneeOffset: prediction.assigneeOffset.toString(),
      clientOffset: prediction.clientOffset.toString(),
      contextSizeAdjustment: prediction.contextSizeAdjustment.toString(),
      isColdStart: prediction.isColdStart,
      coldStartReason: prediction.coldStartReason,
      fallbackLevel: prediction.fallbackLevel,
      sampleCount: prediction.sampleCount,
      sampleVariance: prediction.sampleVariance?.toString() || null,
      sampleRecencyDays: prediction.sampleRecencyDays,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    return storage.upsertTaskDurationPrediction(insertData);
  }

  async recordTaskCompletion(
    agencyId: string,
    taskId: string,
    taskType: string,
    complexity: string,
    channel: string | null,
    clientId: string | null,
    projectId: string | null,
    assigneeId: string | null,
    estimatedHours: number | null,
    actualHours: number,
    aiInvolved: boolean,
    contextSize: number | null,
    urgencyTier: string | null,
    startedAt: Date | null,
    completedAt: Date
  ): Promise<TaskExecutionHistory> {
    const varianceHours = estimatedHours ? actualHours - estimatedHours : null;
    const variancePercent = estimatedHours && estimatedHours > 0
      ? ((actualHours - estimatedHours) / estimatedHours) * 100
      : null;

    const insertData: InsertTaskExecutionHistory = {
      agencyId,
      taskId,
      taskType,
      channel,
      complexity,
      clientId,
      projectId,
      assigneeId,
      aiInvolved,
      contextSize,
      urgencyTier,
      estimatedHours: estimatedHours?.toString() || null,
      actualHours: actualHours.toString(),
      varianceHours: varianceHours?.toString() || null,
      variancePercent: variancePercent?.toString() || null,
      startedAt,
      completedAt,
    };

    return storage.createTaskExecutionHistory(insertData);
  }

  async getModelStats(agencyId: string): Promise<{
    totalHistoricalRecords: number;
    avgVariancePercent: number;
    coldStartRate: number;
    confidenceDistribution: Record<string, number>;
    topTaskTypes: Array<{ taskType: string; count: number; avgHours: number }>;
  }> {
    return storage.getDurationModelStats(agencyId);
  }
}

export const durationModelService = new DurationModelService();
