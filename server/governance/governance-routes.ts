import { Router, Response } from "express";
import { quotaService } from "./quota-service";
import { integrationHealthService } from "./integration-health-service";
import { db } from "../db";
import { governanceAuditLogs, agencyQuotas, agencies, profiles, policyBundles, policyBundleVersions, workflowRuleAudits, workflowEvents, aiExecutions } from "@shared/schema";
import { eq, desc, and, gte, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import logger from "../middleware/logger";
import { requireAuth, requireSuperAdmin, type AuthRequest } from "../middleware/supabase-auth";

const router = Router();
router.use(requireAuth);

async function logGovernanceAction(
  adminId: string,
  action: string,
  resourceType: string,
  resourceId?: string,
  agencyId?: string,
  previousValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>,
  reason?: string,
  req?: AuthRequest
) {
  try {
    await db.insert(governanceAuditLogs).values({
      adminId,
      action,
      resourceType,
      resourceId,
      agencyId,
      previousValue,
      newValue,
      reason,
      ipAddress: req?.ip,
      userAgent: req?.get("user-agent"),
    });
  } catch (error) {
    logger.error("[Governance] Failed to log action:", error);
  }
}

router.get(
  "/quotas",
  requireSuperAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const quotas = await db
        .select({
          quota: agencyQuotas,
          agency: agencies,
        })
        .from(agencyQuotas)
        .innerJoin(agencies, eq(agencyQuotas.agencyId, agencies.id));

      res.json(quotas);
    } catch (error) {
      logger.error("[Governance] Failed to fetch quotas:", error);
      res.status(500).json({ error: "Failed to fetch quotas" });
    }
  }
);

router.get(
  "/quotas/:agencyId",
  requireSuperAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { agencyId } = req.params;
      const summary = await quotaService.getUsageSummary(agencyId);
      res.json(summary);
    } catch (error) {
      logger.error("[Governance] Failed to fetch quota:", error);
      res.status(500).json({ error: "Failed to fetch quota" });
    }
  }
);

const updateQuotaSchema = z.object({
  aiTokenLimit: z.number().min(0).optional(),
  aiRequestLimit: z.number().min(0).optional(),
  storageLimit: z.number().min(0).optional(),
  seatLimit: z.number().min(0).optional(),
  clientLimit: z.number().min(0).optional(),
  projectLimit: z.number().min(0).optional(),
  billingPlan: z.string().optional(),
  monthlyPriceUsd: z.string().optional(),
  warningThreshold: z.number().min(0).max(100).optional(),
  resetDay: z.number().min(1).max(28).optional(),
  reason: z.string().optional(),
});

router.patch(
  "/quotas/:agencyId",
  requireSuperAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { agencyId } = req.params;
      const validation = updateQuotaSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({ error: validation.error.message });
      }

      const { reason, ...updates } = validation.data;
      const previousQuota = await quotaService.getQuota(agencyId);

      const updated = await quotaService.updateQuota(agencyId, updates);

      if (updated) {
        await logGovernanceAction(
          req.user!.id,
          "UPDATE_QUOTA",
          "agency_quota",
          updated.id,
          agencyId,
          previousQuota as unknown as Record<string, unknown>,
          updated as unknown as Record<string, unknown>,
          reason,
          req
        );
      }

      res.json(updated);
    } catch (error) {
      logger.error("[Governance] Failed to update quota:", error);
      res.status(500).json({ error: "Failed to update quota" });
    }
  }
);

router.post(
  "/quotas/:agencyId/reset",
  requireSuperAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { agencyId } = req.params;
      const { reason } = req.body;

      await quotaService.resetMonthlyQuotas(agencyId);

      await logGovernanceAction(
        req.user!.id,
        "RESET_QUOTA",
        "agency_quota",
        agencyId,
        agencyId,
        undefined,
        undefined,
        reason,
        req
      );

      res.json({ success: true, message: "Quota reset successfully" });
    } catch (error) {
      logger.error("[Governance] Failed to reset quota:", error);
      res.status(500).json({ error: "Failed to reset quota" });
    }
  }
);

router.post(
  "/quotas/:agencyId/sync",
  requireSuperAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { agencyId } = req.params;

      await quotaService.syncResourceCounts(agencyId);
      await quotaService.syncAIUsageFromTracking(agencyId);

      const summary = await quotaService.getUsageSummary(agencyId);
      res.json(summary);
    } catch (error) {
      logger.error("[Governance] Failed to sync quota:", error);
      res.status(500).json({ error: "Failed to sync quota" });
    }
  }
);

router.get(
  "/integrations/health",
  requireSuperAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const unhealthy = await integrationHealthService.getAllUnhealthyIntegrations();
      const expiring = await integrationHealthService.getExpiringTokens(7);

      res.json({
        unhealthyIntegrations: unhealthy,
        expiringTokens: expiring,
      });
    } catch (error) {
      logger.error("[Governance] Failed to fetch integration health:", error);
      res.status(500).json({ error: "Failed to fetch integration health" });
    }
  }
);

router.get(
  "/integrations/health/:agencyId",
  requireSuperAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { agencyId } = req.params;
      const summary = await integrationHealthService.getHealthSummary(agencyId);
      res.json(summary);
    } catch (error) {
      logger.error("[Governance] Failed to fetch integration health:", error);
      res.status(500).json({ error: "Failed to fetch integration health" });
    }
  }
);

router.post(
  "/integrations/health/:agencyId/check",
  requireSuperAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { agencyId } = req.params;
      const results = await integrationHealthService.runHealthChecks(agencyId);

      await logGovernanceAction(
        req.user!.id,
        "RUN_HEALTH_CHECK",
        "integration_health",
        undefined,
        agencyId,
        undefined,
        { results } as Record<string, unknown>,
        undefined,
        req
      );

      res.json(results);
    } catch (error) {
      logger.error("[Governance] Failed to run health checks:", error);
      res.status(500).json({ error: "Failed to run health checks" });
    }
  }
);

router.get(
  "/agencies",
  requireSuperAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const agencyList = await db
        .select({
          agency: agencies,
          quota: agencyQuotas,
          userCount: sql<number>`(
            SELECT count(*)::int FROM profiles 
            WHERE profiles.agency_id = agencies.id
          )`,
        })
        .from(agencies)
        .leftJoin(agencyQuotas, eq(agencies.id, agencyQuotas.agencyId));

      res.json(agencyList);
    } catch (error) {
      logger.error("[Governance] Failed to fetch agencies:", error);
      res.status(500).json({ error: "Failed to fetch agencies" });
    }
  }
);

router.get(
  "/agencies/:agencyId/users",
  requireSuperAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { agencyId } = req.params;

      const users = await db
        .select()
        .from(profiles)
        .where(eq(profiles.agencyId, agencyId));

      res.json(users);
    } catch (error) {
      logger.error("[Governance] Failed to fetch users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  }
);

router.get(
  "/audit-logs",
  requireSuperAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { agencyId, action, limit = "100", offset = "0" } = req.query;

      let query = db
        .select({
          log: governanceAuditLogs,
          admin: profiles,
          agency: agencies,
        })
        .from(governanceAuditLogs)
        .innerJoin(profiles, eq(governanceAuditLogs.adminId, profiles.id))
        .leftJoin(agencies, eq(governanceAuditLogs.agencyId, agencies.id));

      const conditions = [];
      if (agencyId && typeof agencyId === "string") {
        conditions.push(eq(governanceAuditLogs.agencyId, agencyId));
      }
      if (action && typeof action === "string") {
        conditions.push(eq(governanceAuditLogs.action, action));
      }

      const logs = await query
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(governanceAuditLogs.createdAt))
        .limit(Number(limit))
        .offset(Number(offset));

      res.json(logs);
    } catch (error) {
      logger.error("[Governance] Failed to fetch audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  }
);

router.get(
  "/dashboard",
  requireSuperAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const [agencyCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(agencies);

      const [userCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(profiles);

      const unhealthyIntegrations = await integrationHealthService.getAllUnhealthyIntegrations();
      const expiringTokens = await integrationHealthService.getExpiringTokens(3);

      const quotasNearLimit = await db
        .select()
        .from(agencyQuotas)
        .where(
          sql`(${agencyQuotas.aiTokenUsed}::float / ${agencyQuotas.aiTokenLimit}::float) * 100 >= ${agencyQuotas.warningThreshold}`
        );

      const recentLogs = await db
        .select()
        .from(governanceAuditLogs)
        .orderBy(desc(governanceAuditLogs.createdAt))
        .limit(10);

      res.json({
        stats: {
          totalAgencies: agencyCount?.count || 0,
          totalUsers: userCount?.count || 0,
          unhealthyIntegrations: unhealthyIntegrations.length,
          expiringTokens: expiringTokens.length,
          quotasNearLimit: quotasNearLimit.length,
        },
        alerts: {
          unhealthyIntegrations,
          expiringTokens,
          quotasNearLimit,
        },
        recentActivity: recentLogs,
      });
    } catch (error) {
      logger.error("[Governance] Failed to fetch dashboard:", error);
      res.status(500).json({ error: "Failed to fetch dashboard" });
    }
  }
);

router.get(
  "/ops/summary",
  requireSuperAdmin,
  async (_req: AuthRequest, res: Response) => {
    try {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [rulePublishes] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(workflowRuleAudits)
        .where(and(eq(workflowRuleAudits.changeType, "published"), gte(workflowRuleAudits.createdAt, since)));

      const [failedWorkflows] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(workflowEvents)
        .where(and(eq(workflowEvents.eventType, "failed"), gte(workflowEvents.timestamp, since)));

      const [aiExecutionsCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(aiExecutions)
        .where(gte(aiExecutions.createdAt, since));

      res.json({
        windowDays: 7,
        rulePublishes: rulePublishes?.count || 0,
        failedWorkflows: failedWorkflows?.count || 0,
        aiExecutions: aiExecutionsCount?.count || 0,
      });
    } catch (error) {
      logger.error("[Governance] Failed to fetch ops summary:", error);
      res.status(500).json({ error: "Failed to fetch ops summary" });
    }
  }
);

router.get(
  "/ops/trends",
  requireSuperAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const windowDays = Number(req.query.windowDays ?? 30);
      const safeWindowDays = Number.isFinite(windowDays) && windowDays > 0 ? Math.min(windowDays, 180) : 30;
      const since = new Date(Date.now() - safeWindowDays * 24 * 60 * 60 * 1000);

      const rulePublishTrend = await db
        .select({
          day: sql<Date>`date_trunc('day', ${workflowRuleAudits.createdAt})`,
          count: sql<number>`count(*)::int`,
        })
        .from(workflowRuleAudits)
        .where(and(eq(workflowRuleAudits.changeType, "published"), gte(workflowRuleAudits.createdAt, since)))
        .groupBy(sql`date_trunc('day', ${workflowRuleAudits.createdAt})`)
        .orderBy(sql`date_trunc('day', ${workflowRuleAudits.createdAt})`);

      const workflowFailureTrend = await db
        .select({
          day: sql<Date>`date_trunc('day', ${workflowEvents.timestamp})`,
          count: sql<number>`count(*)::int`,
        })
        .from(workflowEvents)
        .where(and(eq(workflowEvents.eventType, "failed"), gte(workflowEvents.timestamp, since)))
        .groupBy(sql`date_trunc('day', ${workflowEvents.timestamp})`)
        .orderBy(sql`date_trunc('day', ${workflowEvents.timestamp})`);

      const formatTrend = (rows: Array<{ day: Date | string | null; count: number | null }>) =>
        rows.map((row) => ({
          day: row.day ? new Date(row.day).toISOString().slice(0, 10) : null,
          count: row.count ?? 0,
        }));

      res.json({
        windowDays: safeWindowDays,
        rulePublishes: formatTrend(rulePublishTrend),
        workflowFailures: formatTrend(workflowFailureTrend),
      });
    } catch (error) {
      logger.error("[Governance] Failed to fetch ops trends:", error);
      res.status(500).json({ error: "Failed to fetch ops trends" });
    }
  }
);

router.get(
  "/ops/ai-usage",
  requireSuperAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const windowDays = Number(req.query.windowDays ?? 30);
      const safeWindowDays = Number.isFinite(windowDays) && windowDays > 0 ? Math.min(windowDays, 180) : 30;
      const since = new Date(Date.now() - safeWindowDays * 24 * 60 * 60 * 1000);

      const usage = await db
        .select({
          provider: aiExecutions.provider,
          model: aiExecutions.model,
          totalRequests: sql<number>`count(*)::int`,
          totalPromptTokens: sql<number>`coalesce(sum(${aiExecutions.promptTokens}), 0)::int`,
          totalCompletionTokens: sql<number>`coalesce(sum(${aiExecutions.completionTokens}), 0)::int`,
          totalTokens: sql<number>`coalesce(sum(${aiExecutions.totalTokens}), 0)::int`,
        })
        .from(aiExecutions)
        .where(gte(aiExecutions.createdAt, since))
        .groupBy(aiExecutions.provider, aiExecutions.model)
        .orderBy(desc(sql`count(*)`));

      res.json({
        windowDays: safeWindowDays,
        usage,
      });
    } catch (error) {
      logger.error("[Governance] Failed to fetch AI usage summary:", error);
      res.status(500).json({ error: "Failed to fetch AI usage summary" });
    }
  }
);

router.get(
  "/ops/workflow-failures",
  requireSuperAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const windowDays = Number(req.query.windowDays ?? 30);
      const safeWindowDays = Number.isFinite(windowDays) && windowDays > 0 ? Math.min(windowDays, 180) : 30;
      const since = new Date(Date.now() - safeWindowDays * 24 * 60 * 60 * 1000);

      const failures = await db
        .select({
          workflowId: workflowEvents.workflowId,
          count: sql<number>`count(*)::int`,
        })
        .from(workflowEvents)
        .where(and(eq(workflowEvents.eventType, "failed"), gte(workflowEvents.timestamp, since)))
        .groupBy(workflowEvents.workflowId)
        .orderBy(desc(sql`count(*)`))
        .limit(50);

      res.json({
        windowDays: safeWindowDays,
        failures,
      });
    } catch (error) {
      logger.error("[Governance] Failed to fetch workflow failures summary:", error);
      res.status(500).json({ error: "Failed to fetch workflow failures summary" });
    }
  }
);

router.get(
  "/policy-bundles",
  requireSuperAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { agencyId } = req.query;
      if (!agencyId || typeof agencyId !== "string") {
        return res.status(400).json({ error: "agencyId is required" });
      }

      const bundles = await db
        .select()
        .from(policyBundles)
        .where(eq(policyBundles.agencyId, agencyId))
        .orderBy(desc(policyBundles.createdAt));

      const bundleIds = bundles.map((b) => b.id);
      const versions = bundleIds.length
        ? await db
            .select()
            .from(policyBundleVersions)
            .where(inArray(policyBundleVersions.bundleId, bundleIds))
            .orderBy(desc(policyBundleVersions.version))
        : [];

      const latestByBundle = new Map<string, number>();
      for (const version of versions) {
        if (!latestByBundle.has(version.bundleId)) {
          latestByBundle.set(version.bundleId, version.version);
        }
      }

      res.json(
        bundles.map((bundle) => ({
          ...bundle,
          latestVersion: latestByBundle.get(bundle.id) ?? null,
        }))
      );
    } catch (error) {
      logger.error("[Governance] Failed to fetch policy bundles:", error);
      res.status(500).json({ error: "Failed to fetch policy bundles" });
    }
  }
);

router.get(
  "/policy-bundles/:bundleId/versions",
  requireSuperAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { bundleId } = req.params;
      const [bundle] = await db
        .select()
        .from(policyBundles)
        .where(eq(policyBundles.id, bundleId))
        .limit(1);

      if (!bundle) {
        return res.status(404).json({ error: "Policy bundle not found" });
      }

      const versions = await db
        .select()
        .from(policyBundleVersions)
        .where(eq(policyBundleVersions.bundleId, bundleId))
        .orderBy(desc(policyBundleVersions.version));

      res.json({
        bundle,
        versions,
      });
    } catch (error) {
      logger.error("[Governance] Failed to fetch policy bundle versions:", error);
      res.status(500).json({ error: "Failed to fetch policy bundle versions" });
    }
  }
);

export default router;
