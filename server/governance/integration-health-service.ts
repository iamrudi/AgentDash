import { db } from "../db";
import {
  integrationHealth,
  agencySettings,
  IntegrationHealth,
  InsertIntegrationHealth,
} from "@shared/schema";
import { eq, and, sql, lte } from "drizzle-orm";
import logger from "../middleware/logger";

export type IntegrationStatus = "healthy" | "degraded" | "failed" | "unknown";

export interface HealthCheckResult {
  integration: string;
  status: IntegrationStatus;
  responseTimeMs: number;
  errorMessage?: string;
  tokenValid: boolean;
  tokenExpiresAt?: Date;
}

export interface IntegrationHealthSummary {
  agencyId: string;
  integrations: Array<{
    name: string;
    status: IntegrationStatus;
    healthScore: number;
    lastCheckAt: Date | null;
    lastSuccessAt: Date | null;
    errorCount: number;
    consecutiveFailures: number;
    tokenExpiresAt: Date | null;
    responseTimeMs: number | null;
  }>;
  overallHealth: IntegrationStatus;
  unhealthyCount: number;
  expiringTokenCount: number;
}

export class IntegrationHealthService {
  private static readonly SUPPORTED_INTEGRATIONS = [
    "hubspot",
    "linkedin",
    "google_analytics",
    "google_search_console",
  ];

  async getHealth(
    agencyId: string,
    integration: string
  ): Promise<IntegrationHealth | null> {
    const [health] = await db
      .select()
      .from(integrationHealth)
      .where(
        and(
          eq(integrationHealth.agencyId, agencyId),
          eq(integrationHealth.integration, integration)
        )
      )
      .limit(1);
    return health || null;
  }

  async getOrCreateHealth(
    agencyId: string,
    integration: string
  ): Promise<IntegrationHealth> {
    let health = await this.getHealth(agencyId, integration);
    if (!health) {
      const [newHealth] = await db
        .insert(integrationHealth)
        .values({ agencyId, integration })
        .returning();
      health = newHealth;
    }
    return health;
  }

  async updateHealth(
    agencyId: string,
    integration: string,
    updates: Partial<InsertIntegrationHealth>
  ): Promise<IntegrationHealth | null> {
    const [updated] = await db
      .update(integrationHealth)
      .set({ ...updates, updatedAt: new Date() })
      .where(
        and(
          eq(integrationHealth.agencyId, agencyId),
          eq(integrationHealth.integration, integration)
        )
      )
      .returning();
    return updated || null;
  }

  async recordSuccess(
    agencyId: string,
    integration: string,
    responseTimeMs: number
  ): Promise<void> {
    const health = await this.getOrCreateHealth(agencyId, integration);
    
    const avgResponseTime = health.responseTimeMs
      ? Math.round((health.responseTimeMs + responseTimeMs) / 2)
      : responseTimeMs;

    const newScore = Math.min(100, health.healthScore + 5);

    await this.updateHealth(agencyId, integration, {
      status: "healthy",
      lastCheckAt: new Date(),
      lastSuccessAt: new Date(),
      consecutiveFailures: 0,
      responseTimeMs: avgResponseTime,
      healthScore: newScore,
    });
  }

  async recordFailure(
    agencyId: string,
    integration: string,
    errorMessage: string
  ): Promise<void> {
    const health = await this.getOrCreateHealth(agencyId, integration);
    
    const newConsecutiveFailures = health.consecutiveFailures + 1;
    const newErrorCount = health.errorCount + 1;
    const scorePenalty = Math.min(20, newConsecutiveFailures * 5);
    const newScore = Math.max(0, health.healthScore - scorePenalty);

    let status: IntegrationStatus = "degraded";
    if (newConsecutiveFailures >= 3) {
      status = "failed";
    }

    await this.updateHealth(agencyId, integration, {
      status,
      lastCheckAt: new Date(),
      lastErrorAt: new Date(),
      lastErrorMessage: errorMessage,
      errorCount: newErrorCount,
      consecutiveFailures: newConsecutiveFailures,
      healthScore: newScore,
    });

    logger.warn(
      `[IntegrationHealth] ${integration} for agency ${agencyId} failed: ${errorMessage}`
    );
  }

  async checkHubSpotHealth(agencyId: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const [settings] = await db
        .select()
        .from(agencySettings)
        .where(eq(agencySettings.agencyId, agencyId))
        .limit(1);

      if (!settings?.hubspotAccessToken) {
        return {
          integration: "hubspot",
          status: "unknown",
          responseTimeMs: Date.now() - startTime,
          tokenValid: false,
          errorMessage: "No HubSpot access token configured",
        };
      }

      const responseTimeMs = Date.now() - startTime;
      await this.recordSuccess(agencyId, "hubspot", responseTimeMs);

      return {
        integration: "hubspot",
        status: "healthy",
        responseTimeMs,
        tokenValid: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const responseTimeMs = Date.now() - startTime;
      await this.recordFailure(agencyId, "hubspot", errorMessage);

      return {
        integration: "hubspot",
        status: "failed",
        responseTimeMs,
        tokenValid: false,
        errorMessage,
      };
    }
  }

  async checkLinkedInHealth(agencyId: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const [settings] = await db
        .select()
        .from(agencySettings)
        .where(eq(agencySettings.agencyId, agencyId))
        .limit(1);

      if (!settings?.linkedinAccessToken) {
        return {
          integration: "linkedin",
          status: "unknown",
          responseTimeMs: Date.now() - startTime,
          tokenValid: false,
          errorMessage: "No LinkedIn access token configured",
        };
      }

      const responseTimeMs = Date.now() - startTime;
      await this.recordSuccess(agencyId, "linkedin", responseTimeMs);

      return {
        integration: "linkedin",
        status: "healthy",
        responseTimeMs,
        tokenValid: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const responseTimeMs = Date.now() - startTime;
      await this.recordFailure(agencyId, "linkedin", errorMessage);

      return {
        integration: "linkedin",
        status: "failed",
        responseTimeMs,
        tokenValid: false,
        errorMessage,
      };
    }
  }

  async runHealthChecks(agencyId: string): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];

    results.push(await this.checkHubSpotHealth(agencyId));
    results.push(await this.checkLinkedInHealth(agencyId));

    return results;
  }

  async getHealthSummary(agencyId: string): Promise<IntegrationHealthSummary> {
    const healthRecords = await db
      .select()
      .from(integrationHealth)
      .where(eq(integrationHealth.agencyId, agencyId));

    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const integrations = healthRecords.map((h) => ({
      name: h.integration,
      status: h.status as IntegrationStatus,
      healthScore: h.healthScore,
      lastCheckAt: h.lastCheckAt,
      lastSuccessAt: h.lastSuccessAt,
      errorCount: h.errorCount,
      consecutiveFailures: h.consecutiveFailures,
      tokenExpiresAt: h.tokenExpiresAt,
      responseTimeMs: h.responseTimeMs,
    }));

    const unhealthyCount = integrations.filter(
      (i) => i.status === "failed" || i.status === "degraded"
    ).length;

    const expiringTokenCount = healthRecords.filter(
      (h) => h.tokenExpiresAt && h.tokenExpiresAt <= threeDaysFromNow
    ).length;

    let overallHealth: IntegrationStatus = "healthy";
    if (integrations.some((i) => i.status === "failed")) {
      overallHealth = "failed";
    } else if (integrations.some((i) => i.status === "degraded")) {
      overallHealth = "degraded";
    } else if (integrations.every((i) => i.status === "unknown")) {
      overallHealth = "unknown";
    }

    return {
      agencyId,
      integrations,
      overallHealth,
      unhealthyCount,
      expiringTokenCount,
    };
  }

  async getExpiringTokens(daysAhead: number = 7): Promise<IntegrationHealth[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return await db
      .select()
      .from(integrationHealth)
      .where(lte(integrationHealth.tokenExpiresAt, futureDate));
  }

  async getAllUnhealthyIntegrations(): Promise<IntegrationHealth[]> {
    return await db
      .select()
      .from(integrationHealth)
      .where(
        sql`${integrationHealth.status} IN ('failed', 'degraded')`
      );
  }

  async updateTokenExpiry(
    agencyId: string,
    integration: string,
    expiresAt: Date
  ): Promise<void> {
    await this.updateHealth(agencyId, integration, {
      tokenExpiresAt: expiresAt,
      tokenRefreshedAt: new Date(),
    });
  }

  async runAllAgencyHealthChecks(): Promise<Map<string, HealthCheckResult[]>> {
    const allSettings = await db.select().from(agencySettings);
    const results = new Map<string, HealthCheckResult[]>();

    for (const settings of allSettings) {
      try {
        const agencyResults = await this.runHealthChecks(settings.agencyId);
        results.set(settings.agencyId, agencyResults);
      } catch (error) {
        logger.error(
          `[IntegrationHealth] Failed to run health checks for agency ${settings.agencyId}:`,
          error
        );
      }
    }

    return results;
  }
}

export const integrationHealthService = new IntegrationHealthService();
