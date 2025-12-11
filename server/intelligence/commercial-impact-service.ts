import { storage } from "../storage";
import type { 
  CommercialImpactFactors,
  InsertCommercialImpactScore,
  CommercialImpactScore,
  Task,
  Client
} from "@shared/schema";

export interface ImpactScoreComponents {
  revenueScore: number;
  clientTierScore: number;
  deadlineRiskScore: number;
  strategicScore: number;
  lifecycleScore: number;
}

export interface ImpactScoreResult extends ImpactScoreComponents {
  totalImpactScore: number;
  isNonRevenueWork: boolean;
  nonRevenueType: string | null;
  daysUntilDeadline: number | null;
  slaAtRisk: boolean;
}

export interface TaskImpactContext {
  taskId: string;
  taskDescription: string;
  clientId: string | null;
  projectId: string | null;
  dueDate: string | null;
  priority: string | null;
  estimatedRevenueImpact?: number;
  revenueImpactType?: 'direct' | 'retention' | 'expansion' | 'referral';
  isNonRevenueWork?: boolean;
  nonRevenueType?: 'internal_initiative' | 'tech_debt' | 'relationship' | 'retention';
  clientTier?: string;
  clientLifecycleStage?: string;
  strategicWeight?: number;
}

export interface ClientImpactContext {
  id: string;
  tier?: string;
  lifecycleStage?: string;
  monthlyRetainer?: number;
  averageDealSize?: number;
}

const DEFAULT_FACTORS: Omit<CommercialImpactFactors, 'id' | 'agencyId' | 'createdAt' | 'updatedAt'> = {
  wRevenue: "0.25",
  wClientTier: "0.25",
  wDeadlineRisk: "0.20",
  wStrategicWeight: "0.15",
  wLifecycleWeight: "0.15",
  clientTierMapping: { platinum: 1.0, gold: 0.8, silver: 0.6, bronze: 0.4, standard: 0.2 },
  revenueScaleMin: "0",
  revenueScaleMax: "100000",
  deadlineRiskDays: { critical: 1, high: 3, medium: 7, low: 14 },
  strategicValueMapping: { internal_initiative: 0.5, tech_debt: 0.4, relationship: 0.6, retention: 0.7, expansion: 0.8 },
  lifecycleWeightMapping: { onboarding: 0.9, growth: 0.7, mature: 0.5, at_risk: 0.95, churning: 0.3 },
  feedbackDecayDays: 90
};

export class CommercialImpactService {
  async calculateImpactScore(
    agencyId: string,
    context: TaskImpactContext
  ): Promise<ImpactScoreResult> {
    const factors = await this.getFactors(agencyId);
    
    let clientContext: ClientImpactContext | null = null;
    if (context.clientId) {
      const client = await storage.getClientById(context.clientId);
      if (client) {
        clientContext = {
          id: client.id,
          tier: context.clientTier,
          lifecycleStage: context.clientLifecycleStage,
          monthlyRetainer: client.retainerAmount ? parseFloat(client.retainerAmount) : undefined,
          averageDealSize: client.averageDealSize ? parseFloat(client.averageDealSize) : undefined
        };
      }
    }

    const revenueScore = this.calculateRevenueScore(
      context.estimatedRevenueImpact,
      clientContext,
      factors
    );

    const clientTierScore = this.calculateClientTierScore(
      context.clientTier || clientContext?.tier,
      factors
    );

    const { deadlineRiskScore, daysUntilDeadline, slaAtRisk } = this.calculateDeadlineRiskScore(
      context.dueDate,
      context.priority,
      factors
    );

    const strategicScore = this.calculateStrategicScore(
      context.isNonRevenueWork,
      context.nonRevenueType,
      context.strategicWeight,
      factors
    );

    const lifecycleScore = this.calculateLifecycleScore(
      context.clientLifecycleStage || clientContext?.lifecycleStage,
      factors
    );

    const wRevenue = parseFloat(factors.wRevenue || "0.25");
    const wClientTier = parseFloat(factors.wClientTier || "0.25");
    const wDeadlineRisk = parseFloat(factors.wDeadlineRisk || "0.20");
    const wStrategicWeight = parseFloat(factors.wStrategicWeight || "0.15");
    const wLifecycleWeight = parseFloat(factors.wLifecycleWeight || "0.15");

    const totalImpactScore = 
      revenueScore * wRevenue +
      clientTierScore * wClientTier +
      deadlineRiskScore * wDeadlineRisk +
      strategicScore * wStrategicWeight +
      lifecycleScore * wLifecycleWeight;

    return {
      revenueScore: Math.round(revenueScore * 100) / 100,
      clientTierScore: Math.round(clientTierScore * 100) / 100,
      deadlineRiskScore: Math.round(deadlineRiskScore * 100) / 100,
      strategicScore: Math.round(strategicScore * 100) / 100,
      lifecycleScore: Math.round(lifecycleScore * 100) / 100,
      totalImpactScore: Math.round(totalImpactScore * 100) / 100,
      isNonRevenueWork: context.isNonRevenueWork || false,
      nonRevenueType: context.nonRevenueType || null,
      daysUntilDeadline,
      slaAtRisk
    };
  }

  private async getFactors(agencyId: string): Promise<typeof DEFAULT_FACTORS> {
    const stored = await storage.getCommercialImpactFactorsByAgencyId(agencyId);
    
    if (!stored) {
      return DEFAULT_FACTORS;
    }

    return {
      wRevenue: stored.wRevenue || DEFAULT_FACTORS.wRevenue,
      wClientTier: stored.wClientTier || DEFAULT_FACTORS.wClientTier,
      wDeadlineRisk: stored.wDeadlineRisk || DEFAULT_FACTORS.wDeadlineRisk,
      wStrategicWeight: stored.wStrategicWeight || DEFAULT_FACTORS.wStrategicWeight,
      wLifecycleWeight: stored.wLifecycleWeight || DEFAULT_FACTORS.wLifecycleWeight,
      clientTierMapping: (stored.clientTierMapping as Record<string, number>) || DEFAULT_FACTORS.clientTierMapping,
      revenueScaleMin: stored.revenueScaleMin || DEFAULT_FACTORS.revenueScaleMin,
      revenueScaleMax: stored.revenueScaleMax || DEFAULT_FACTORS.revenueScaleMax,
      deadlineRiskDays: (stored.deadlineRiskDays as Record<string, number>) || DEFAULT_FACTORS.deadlineRiskDays,
      strategicValueMapping: (stored.strategicValueMapping as Record<string, number>) || DEFAULT_FACTORS.strategicValueMapping,
      lifecycleWeightMapping: (stored.lifecycleWeightMapping as Record<string, number>) || DEFAULT_FACTORS.lifecycleWeightMapping,
      feedbackDecayDays: stored.feedbackDecayDays || DEFAULT_FACTORS.feedbackDecayDays
    };
  }

  private calculateRevenueScore(
    estimatedRevenue: number | undefined,
    clientContext: ClientImpactContext | null,
    factors: typeof DEFAULT_FACTORS
  ): number {
    if (estimatedRevenue === undefined || estimatedRevenue === null) {
      if (clientContext?.monthlyRetainer) {
        estimatedRevenue = clientContext.monthlyRetainer / 10;
      } else if (clientContext?.averageDealSize) {
        estimatedRevenue = clientContext.averageDealSize / 20;
      } else {
        return 0.3;
      }
    }

    const min = parseFloat(factors.revenueScaleMin || "0");
    const max = parseFloat(factors.revenueScaleMax || "100000");
    
    const normalized = Math.max(0, Math.min(1, (estimatedRevenue - min) / (max - min)));
    return normalized;
  }

  private calculateClientTierScore(
    tier: string | undefined,
    factors: typeof DEFAULT_FACTORS
  ): number {
    if (!tier) return 0.2;
    
    const mapping = factors.clientTierMapping as Record<string, number>;
    return mapping[tier.toLowerCase()] || 0.2;
  }

  private calculateDeadlineRiskScore(
    dueDate: string | null | undefined,
    priority: string | null | undefined,
    factors: typeof DEFAULT_FACTORS
  ): { deadlineRiskScore: number; daysUntilDeadline: number | null; slaAtRisk: boolean } {
    if (!dueDate) {
      return { deadlineRiskScore: 0.3, daysUntilDeadline: null, slaAtRisk: false };
    }

    const now = new Date();
    const due = new Date(dueDate);
    const daysUntilDeadline = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const deadlineRiskDays = factors.deadlineRiskDays as Record<string, number>;
    
    let score: number;
    let slaAtRisk = false;

    if (daysUntilDeadline <= 0) {
      score = 1.0;
      slaAtRisk = true;
    } else if (daysUntilDeadline <= deadlineRiskDays.critical) {
      score = 0.95;
      slaAtRisk = true;
    } else if (daysUntilDeadline <= deadlineRiskDays.high) {
      score = 0.8;
      slaAtRisk = priority === 'High' || priority === 'Urgent';
    } else if (daysUntilDeadline <= deadlineRiskDays.medium) {
      score = 0.5;
    } else if (daysUntilDeadline <= deadlineRiskDays.low) {
      score = 0.3;
    } else {
      score = 0.1;
    }

    return { deadlineRiskScore: score, daysUntilDeadline, slaAtRisk };
  }

  private calculateStrategicScore(
    isNonRevenueWork: boolean | undefined,
    nonRevenueType: string | undefined,
    strategicWeight: number | undefined,
    factors: typeof DEFAULT_FACTORS
  ): number {
    if (strategicWeight !== undefined) {
      return Math.max(0, Math.min(1, strategicWeight));
    }

    if (isNonRevenueWork && nonRevenueType) {
      const mapping = factors.strategicValueMapping as Record<string, number>;
      return mapping[nonRevenueType] || 0.4;
    }

    return 0.5;
  }

  private calculateLifecycleScore(
    lifecycleStage: string | undefined,
    factors: typeof DEFAULT_FACTORS
  ): number {
    if (!lifecycleStage) return 0.5;
    
    const mapping = factors.lifecycleWeightMapping as Record<string, number>;
    return mapping[lifecycleStage.toLowerCase()] || 0.5;
  }

  async saveImpactScore(
    agencyId: string,
    taskId: string,
    context: TaskImpactContext,
    result: ImpactScoreResult
  ): Promise<CommercialImpactScore> {
    const data: InsertCommercialImpactScore = {
      agencyId,
      taskId,
      projectId: context.projectId,
      clientId: context.clientId,
      clientTier: context.clientTier,
      clientLifecycleStage: context.clientLifecycleStage,
      revenueScore: result.revenueScore.toString(),
      clientTierScore: result.clientTierScore.toString(),
      deadlineRiskScore: result.deadlineRiskScore.toString(),
      strategicScore: result.strategicScore.toString(),
      lifecycleScore: result.lifecycleScore.toString(),
      totalImpactScore: result.totalImpactScore.toString(),
      estimatedRevenueImpact: context.estimatedRevenueImpact?.toString(),
      revenueImpactType: context.revenueImpactType,
      isNonRevenueWork: result.isNonRevenueWork,
      nonRevenueType: result.nonRevenueType,
      daysUntilDeadline: result.daysUntilDeadline,
      slaAtRisk: result.slaAtRisk
    };

    return storage.upsertCommercialImpactScore(data);
  }

  async getTopPrioritizedTasks(
    agencyId: string,
    limit: number = 20
  ): Promise<CommercialImpactScore[]> {
    return storage.getCommercialImpactScoresByAgencyId(agencyId, { limit });
  }

  async updateAgencyFactors(
    agencyId: string,
    factors: Partial<{
      wRevenue: string;
      wClientTier: string;
      wDeadlineRisk: string;
      wStrategicWeight: string;
      wLifecycleWeight: string;
      clientTierMapping: Record<string, number>;
      revenueScaleMax: string;
      deadlineRiskDays: Record<string, number>;
      strategicValueMapping: Record<string, number>;
      lifecycleWeightMapping: Record<string, number>;
    }>
  ): Promise<CommercialImpactFactors> {
    return storage.upsertCommercialImpactFactors({
      agencyId,
      ...factors
    });
  }

  async getAgencyFactors(agencyId: string): Promise<CommercialImpactFactors | null> {
    const factors = await storage.getCommercialImpactFactorsByAgencyId(agencyId);
    return factors || null;
  }

  async batchCalculateImpactScores(
    agencyId: string,
    tasks: TaskImpactContext[]
  ): Promise<Map<string, ImpactScoreResult>> {
    const results = new Map<string, ImpactScoreResult>();
    
    for (const task of tasks) {
      const result = await this.calculateImpactScore(agencyId, task);
      results.set(task.taskId, result);
    }
    
    return results;
  }
}

export const commercialImpactService = new CommercialImpactService();
