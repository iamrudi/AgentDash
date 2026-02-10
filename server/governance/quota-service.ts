import { db } from "../db";
import {
  agencyQuotas,
  aiUsageTracking,
  profiles,
  clients,
  projects,
  AgencyQuota,
  InsertAgencyQuota,
} from "@shared/schema";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import logger from "../middleware/logger";

export interface QuotaCheckResult {
  allowed: boolean;
  quotaType: string;
  currentUsage: number;
  limit: number;
  percentUsed: number;
  message?: string;
}

export interface QuotaUsageSummary {
  agencyId: string;
  aiTokens: { used: number; limit: number; percent: number };
  aiRequests: { used: number; limit: number; percent: number };
  storage: { used: number; limit: number; percent: number };
  seats: { used: number; limit: number; percent: number };
  clients: { used: number; limit: number; percent: number };
  projects: { used: number; limit: number; percent: number };
  billingPlan: string;
  lastResetAt: Date | null;
  warningThreshold: number;
  quotaExceeded: boolean;
  quotaWarning: boolean;
}

export class QuotaService {
  async getQuota(agencyId: string): Promise<AgencyQuota | null> {
    const [quota] = await db
      .select()
      .from(agencyQuotas)
      .where(eq(agencyQuotas.agencyId, agencyId))
      .limit(1);
    return quota || null;
  }

  async getOrCreateQuota(agencyId: string): Promise<AgencyQuota> {
    let quota = await this.getQuota(agencyId);
    if (!quota) {
      const [newQuota] = await db
        .insert(agencyQuotas)
        .values({ agencyId })
        .returning();
      quota = newQuota;
    }
    return quota;
  }

  async updateQuota(
    agencyId: string,
    updates: Partial<InsertAgencyQuota>
  ): Promise<AgencyQuota | null> {
    const [updated] = await db
      .update(agencyQuotas)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(agencyQuotas.agencyId, agencyId))
      .returning();
    return updated || null;
  }

  async checkAITokenQuota(
    agencyId: string,
    requestedTokens: number
  ): Promise<QuotaCheckResult> {
    const quota = await this.getOrCreateQuota(agencyId);
    const newUsage = quota.aiTokenUsed + requestedTokens;
    const percentUsed = (newUsage / quota.aiTokenLimit) * 100;

    if (newUsage > quota.aiTokenLimit) {
      if (!quota.quotaExceededAt) {
        await this.updateQuota(agencyId, { quotaExceededAt: new Date() });
      }
      return {
        allowed: false,
        quotaType: "ai_tokens",
        currentUsage: quota.aiTokenUsed,
        limit: quota.aiTokenLimit,
        percentUsed,
        message: `AI token quota exceeded. Used: ${quota.aiTokenUsed}, Limit: ${quota.aiTokenLimit}`,
      };
    }

    if (percentUsed >= quota.warningThreshold && !quota.quotaWarningAt) {
      await this.updateQuota(agencyId, { quotaWarningAt: new Date() });
      logger.warn(`[QuotaService] Agency ${agencyId} at ${percentUsed.toFixed(1)}% of AI token quota`);
    }

    return {
      allowed: true,
      quotaType: "ai_tokens",
      currentUsage: quota.aiTokenUsed,
      limit: quota.aiTokenLimit,
      percentUsed,
    };
  }

  async checkAIRequestQuota(agencyId: string): Promise<QuotaCheckResult> {
    const quota = await this.getOrCreateQuota(agencyId);
    const newUsage = quota.aiRequestUsed + 1;
    const percentUsed = (newUsage / quota.aiRequestLimit) * 100;

    if (newUsage > quota.aiRequestLimit) {
      return {
        allowed: false,
        quotaType: "ai_requests",
        currentUsage: quota.aiRequestUsed,
        limit: quota.aiRequestLimit,
        percentUsed,
        message: `AI request quota exceeded. Used: ${quota.aiRequestUsed}, Limit: ${quota.aiRequestLimit}`,
      };
    }

    return {
      allowed: true,
      quotaType: "ai_requests",
      currentUsage: quota.aiRequestUsed,
      limit: quota.aiRequestLimit,
      percentUsed,
    };
  }

  async checkEmbeddingTokenQuota(
    agencyId: string,
    requestedTokens: number
  ): Promise<QuotaCheckResult> {
    const quota = await this.getOrCreateQuota(agencyId);
    const newUsage = quota.embeddingTokenUsed + requestedTokens;
    const percentUsed = (newUsage / quota.embeddingTokenLimit) * 100;

    if (newUsage > quota.embeddingTokenLimit) {
      return {
        allowed: false,
        quotaType: "embedding_tokens",
        currentUsage: quota.embeddingTokenUsed,
        limit: quota.embeddingTokenLimit,
        percentUsed,
        message: `Embedding token quota exceeded. Used: ${quota.embeddingTokenUsed}, Limit: ${quota.embeddingTokenLimit}`,
      };
    }

    return {
      allowed: true,
      quotaType: "embedding_tokens",
      currentUsage: quota.embeddingTokenUsed,
      limit: quota.embeddingTokenLimit,
      percentUsed,
    };
  }

  async checkEmbeddingRequestQuota(agencyId: string): Promise<QuotaCheckResult> {
    const quota = await this.getOrCreateQuota(agencyId);
    const newUsage = quota.embeddingRequestUsed + 1;
    const percentUsed = (newUsage / quota.embeddingRequestLimit) * 100;

    if (newUsage > quota.embeddingRequestLimit) {
      return {
        allowed: false,
        quotaType: "embedding_requests",
        currentUsage: quota.embeddingRequestUsed,
        limit: quota.embeddingRequestLimit,
        percentUsed,
        message: `Embedding request quota exceeded. Used: ${quota.embeddingRequestUsed}, Limit: ${quota.embeddingRequestLimit}`,
      };
    }

    return {
      allowed: true,
      quotaType: "embedding_requests",
      currentUsage: quota.embeddingRequestUsed,
      limit: quota.embeddingRequestLimit,
      percentUsed,
    };
  }

  async incrementAIUsage(
    agencyId: string,
    tokensUsed: number
  ): Promise<void> {
    await db
      .update(agencyQuotas)
      .set({
        aiTokenUsed: sql`${agencyQuotas.aiTokenUsed} + ${tokensUsed}`,
        aiRequestUsed: sql`${agencyQuotas.aiRequestUsed} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(agencyQuotas.agencyId, agencyId));
  }

  async incrementEmbeddingUsage(
    agencyId: string,
    tokensUsed: number
  ): Promise<void> {
    await db
      .update(agencyQuotas)
      .set({
        embeddingTokenUsed: sql`${agencyQuotas.embeddingTokenUsed} + ${tokensUsed}`,
        embeddingRequestUsed: sql`${agencyQuotas.embeddingRequestUsed} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(agencyQuotas.agencyId, agencyId));
  }

  async checkSeatQuota(agencyId: string): Promise<QuotaCheckResult> {
    const quota = await this.getOrCreateQuota(agencyId);
    const newUsage = quota.seatsUsed + 1;
    const percentUsed = (newUsage / quota.seatLimit) * 100;

    if (newUsage > quota.seatLimit) {
      return {
        allowed: false,
        quotaType: "seats",
        currentUsage: quota.seatsUsed,
        limit: quota.seatLimit,
        percentUsed,
        message: `Seat limit reached. Used: ${quota.seatsUsed}, Limit: ${quota.seatLimit}`,
      };
    }

    return {
      allowed: true,
      quotaType: "seats",
      currentUsage: quota.seatsUsed,
      limit: quota.seatLimit,
      percentUsed,
    };
  }

  async checkClientQuota(agencyId: string): Promise<QuotaCheckResult> {
    const quota = await this.getOrCreateQuota(agencyId);
    const newUsage = quota.clientsUsed + 1;
    const percentUsed = (newUsage / quota.clientLimit) * 100;

    if (newUsage > quota.clientLimit) {
      return {
        allowed: false,
        quotaType: "clients",
        currentUsage: quota.clientsUsed,
        limit: quota.clientLimit,
        percentUsed,
        message: `Client limit reached. Used: ${quota.clientsUsed}, Limit: ${quota.clientLimit}`,
      };
    }

    return {
      allowed: true,
      quotaType: "clients",
      currentUsage: quota.clientsUsed,
      limit: quota.clientLimit,
      percentUsed,
    };
  }

  async checkProjectQuota(agencyId: string): Promise<QuotaCheckResult> {
    const quota = await this.getOrCreateQuota(agencyId);
    const newUsage = quota.projectsUsed + 1;
    const percentUsed = (newUsage / quota.projectLimit) * 100;

    if (newUsage > quota.projectLimit) {
      return {
        allowed: false,
        quotaType: "projects",
        currentUsage: quota.projectsUsed,
        limit: quota.projectLimit,
        percentUsed,
        message: `Project limit reached. Used: ${quota.projectsUsed}, Limit: ${quota.projectLimit}`,
      };
    }

    return {
      allowed: true,
      quotaType: "projects",
      currentUsage: quota.projectsUsed,
      limit: quota.projectLimit,
      percentUsed,
    };
  }

  async incrementResourceUsage(
    agencyId: string,
    resourceType: "seats" | "clients" | "projects",
    delta: number = 1
  ): Promise<void> {
    const field = {
      seats: agencyQuotas.seatsUsed,
      clients: agencyQuotas.clientsUsed,
      projects: agencyQuotas.projectsUsed,
    }[resourceType];

    await db
      .update(agencyQuotas)
      .set({
        [resourceType === "seats" ? "seatsUsed" : resourceType === "clients" ? "clientsUsed" : "projectsUsed"]:
          sql`${field} + ${delta}`,
        updatedAt: new Date(),
      })
      .where(eq(agencyQuotas.agencyId, agencyId));
  }

  async syncResourceCounts(agencyId: string): Promise<void> {
    const [seatCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(profiles)
      .where(eq(profiles.agencyId, agencyId));

    const [clientCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(clients)
      .where(eq(clients.agencyId, agencyId));

    const [projectCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(projects)
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(eq(clients.agencyId, agencyId));

    await this.updateQuota(agencyId, {
      seatsUsed: seatCount?.count || 0,
      clientsUsed: clientCount?.count || 0,
      projectsUsed: projectCount?.count || 0,
    });
  }

  async syncAIUsageFromTracking(agencyId: string): Promise<void> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [usage] = await db
      .select({
        totalTokens: sql<number>`coalesce(sum(${aiUsageTracking.totalTokens}), 0)::int`,
        totalRequests: sql<number>`coalesce(sum(${aiUsageTracking.totalRequests}), 0)::int`,
      })
      .from(aiUsageTracking)
      .where(
        and(
          eq(aiUsageTracking.agencyId, agencyId),
          gte(aiUsageTracking.periodStart, monthStart),
          lte(aiUsageTracking.periodEnd, monthEnd)
        )
      );

    await this.updateQuota(agencyId, {
      aiTokenUsed: usage?.totalTokens || 0,
      aiRequestUsed: usage?.totalRequests || 0,
    });
  }

  async getUsageSummary(agencyId: string): Promise<QuotaUsageSummary> {
    const quota = await this.getOrCreateQuota(agencyId);

    const aiTokenPercent = (quota.aiTokenUsed / quota.aiTokenLimit) * 100;
    const aiRequestPercent = (quota.aiRequestUsed / quota.aiRequestLimit) * 100;
    const storagePercent = (quota.storageUsed / quota.storageLimit) * 100;
    const seatPercent = (quota.seatsUsed / quota.seatLimit) * 100;
    const clientPercent = (quota.clientsUsed / quota.clientLimit) * 100;
    const projectPercent = (quota.projectsUsed / quota.projectLimit) * 100;

    const quotaExceeded =
      aiTokenPercent >= 100 ||
      aiRequestPercent >= 100 ||
      storagePercent >= 100 ||
      seatPercent >= 100 ||
      clientPercent >= 100 ||
      projectPercent >= 100;

    const quotaWarning =
      aiTokenPercent >= quota.warningThreshold ||
      aiRequestPercent >= quota.warningThreshold ||
      storagePercent >= quota.warningThreshold ||
      seatPercent >= quota.warningThreshold ||
      clientPercent >= quota.warningThreshold ||
      projectPercent >= quota.warningThreshold;

    return {
      agencyId,
      aiTokens: {
        used: quota.aiTokenUsed,
        limit: quota.aiTokenLimit,
        percent: aiTokenPercent,
      },
      aiRequests: {
        used: quota.aiRequestUsed,
        limit: quota.aiRequestLimit,
        percent: aiRequestPercent,
      },
      storage: {
        used: quota.storageUsed,
        limit: quota.storageLimit,
        percent: storagePercent,
      },
      seats: {
        used: quota.seatsUsed,
        limit: quota.seatLimit,
        percent: seatPercent,
      },
      clients: {
        used: quota.clientsUsed,
        limit: quota.clientLimit,
        percent: clientPercent,
      },
      projects: {
        used: quota.projectsUsed,
        limit: quota.projectLimit,
        percent: projectPercent,
      },
      billingPlan: quota.billingPlan,
      lastResetAt: quota.lastResetAt,
      warningThreshold: quota.warningThreshold,
      quotaExceeded,
      quotaWarning,
    };
  }

  async resetMonthlyQuotas(agencyId: string): Promise<void> {
    await this.updateQuota(agencyId, {
      aiTokenUsed: 0,
      aiRequestUsed: 0,
      lastResetAt: new Date(),
      quotaExceededAt: null,
      quotaWarningAt: null,
    });
    logger.info(`[QuotaService] Reset monthly quotas for agency ${agencyId}`);
  }

  async getAllQuotas(): Promise<AgencyQuota[]> {
    return await db.select().from(agencyQuotas);
  }

  async getQuotasNeedingReset(): Promise<AgencyQuota[]> {
    const today = new Date();
    const dayOfMonth = today.getDate();

    return await db
      .select()
      .from(agencyQuotas)
      .where(eq(agencyQuotas.resetDay, dayOfMonth));
  }

  async processMonthlyResets(): Promise<number> {
    const quotasToReset = await this.getQuotasNeedingReset();
    let resetCount = 0;

    for (const quota of quotasToReset) {
      const lastReset = quota.lastResetAt;
      if (lastReset) {
        const lastResetMonth = lastReset.getMonth();
        const currentMonth = new Date().getMonth();
        if (lastResetMonth === currentMonth) {
          continue;
        }
      }

      await this.resetMonthlyQuotas(quota.agencyId);
      resetCount++;
    }

    return resetCount;
  }
}

export const quotaService = new QuotaService();
