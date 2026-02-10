import { db } from "../db";
import logger from "../middleware/logger";
import {
  workflowRetentionPolicies,
  workflowExecutions,
  workflowEvents,
  workflowSignals,
  aiExecutions,
  workflowRules,
  workflowRuleEvaluations,
} from "@shared/schema";
import { and, eq, inArray, lt, sql } from "drizzle-orm";

export interface RetentionPlanItem {
  resourceType: string;
  retentionDays: number;
  cutoffDate: Date;
  enabled: boolean;
  archiveBeforeDelete: boolean;
  action: "delete" | "archive" | "skip";
  estimatedCount?: number;
}

export interface RetentionExecutionResult {
  resourceType: string;
  action: "delete" | "archive" | "skip";
  deletedCount: number;
  archivedCount: number;
  cutoffDate: Date;
}

export type RetentionArchiveHandler = (options: {
  agencyId: string;
  resourceType: string;
  cutoffDate: Date;
}) => Promise<number>;

export function buildRetentionPlan(
  policies: Array<{
    resourceType: string;
    retentionDays: number;
    enabled?: boolean;
    archiveBeforeDelete?: boolean;
  }>,
  now: Date = new Date()
): RetentionPlanItem[] {
  return policies.map((policy) => {
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);
    const enabled = policy.enabled ?? true;
    const archiveBeforeDelete = policy.archiveBeforeDelete ?? false;
    const action = enabled ? (archiveBeforeDelete ? "archive" : "delete") : "skip";
    return {
      resourceType: policy.resourceType,
      retentionDays: policy.retentionDays,
      cutoffDate,
      enabled,
      archiveBeforeDelete,
      action,
    };
  });
}

export async function runRetentionCleanup(options: {
  agencyId: string;
  dryRun?: boolean;
}): Promise<{ plan: RetentionPlanItem[]; dryRun: boolean }> {
  const dryRun = options.dryRun !== false;
  const policies = await db
    .select()
    .from(workflowRetentionPolicies)
    .where(eq(workflowRetentionPolicies.agencyId, options.agencyId));

  const plan = buildRetentionPlan(
    policies.map((policy) => ({
      resourceType: policy.resourceType,
      retentionDays: policy.retentionDays,
      enabled: policy.enabled ?? true,
      archiveBeforeDelete: policy.archiveBeforeDelete ?? false,
    }))
  );

  return { plan, dryRun };
}

export async function runRetentionExecution(options: {
  agencyId: string;
  plan: RetentionPlanItem[];
  dryRun?: boolean;
  archiveHandler?: RetentionArchiveHandler;
}): Promise<RetentionExecutionResult[]> {
  const dryRun = options.dryRun !== false;
  const results: RetentionExecutionResult[] = [];

  for (const item of options.plan) {
    if (item.action === "skip") {
      results.push({
        resourceType: item.resourceType,
        action: item.action,
        deletedCount: 0,
        archivedCount: 0,
        cutoffDate: item.cutoffDate,
      });
      continue;
    }

    if (item.action === "archive") {
      if (dryRun || !options.archiveHandler) {
        if (!options.archiveHandler && !dryRun) {
          logger.warn(`[RETENTION_JOB] Archive handler not configured for ${item.resourceType}`);
        }
        results.push({
          resourceType: item.resourceType,
          action: item.action,
          deletedCount: 0,
          archivedCount: 0,
          cutoffDate: item.cutoffDate,
        });
        continue;
      }

      const archivedCount = await options.archiveHandler({
        agencyId: options.agencyId,
        resourceType: item.resourceType,
        cutoffDate: item.cutoffDate,
      });

      results.push({
        resourceType: item.resourceType,
        action: item.action,
        deletedCount: 0,
        archivedCount,
        cutoffDate: item.cutoffDate,
      });
      continue;
    }

    if (dryRun) {
      results.push({
        resourceType: item.resourceType,
        action: item.action,
        deletedCount: 0,
        archivedCount: 0,
        cutoffDate: item.cutoffDate,
      });
      continue;
    }

    let deletedCount = 0;
    switch (item.resourceType) {
      case "workflow_executions": {
        const execResult = await db.delete(workflowExecutions).where(
          and(eq(workflowExecutions.agencyId, options.agencyId), lt(workflowExecutions.createdAt, item.cutoffDate))
        );
        deletedCount = (execResult as unknown as { rowCount?: number }).rowCount ?? 0;
        break;
      }
      case "workflow_events": {
        const eventsResult = await db.delete(workflowEvents).where(
          and(eq(workflowEvents.agencyId, options.agencyId), lt(workflowEvents.timestamp, item.cutoffDate))
        );
        deletedCount = (eventsResult as unknown as { rowCount?: number }).rowCount ?? 0;
        break;
      }
      case "signals": {
        const signalsResult = await db.delete(workflowSignals).where(
          and(eq(workflowSignals.agencyId, options.agencyId), lt(workflowSignals.ingestedAt, item.cutoffDate))
        );
        deletedCount = (signalsResult as unknown as { rowCount?: number }).rowCount ?? 0;
        break;
      }
      case "ai_executions": {
        const aiResult = await db.delete(aiExecutions).where(
          and(eq(aiExecutions.agencyId, options.agencyId), lt(aiExecutions.createdAt, item.cutoffDate))
        );
        deletedCount = (aiResult as unknown as { rowCount?: number }).rowCount ?? 0;
        break;
      }
      case "rule_evaluations": {
        const ruleIds = await db
          .select({ id: workflowRules.id })
          .from(workflowRules)
          .where(eq(workflowRules.agencyId, options.agencyId));
        const ids = ruleIds.map((row) => row.id);
        if (ids.length > 0) {
          const evalResult = await db.delete(workflowRuleEvaluations).where(
            and(inArray(workflowRuleEvaluations.ruleId, ids), lt(workflowRuleEvaluations.createdAt, item.cutoffDate))
          );
          deletedCount = (evalResult as unknown as { rowCount?: number }).rowCount ?? 0;
        }
        break;
      }
      default:
        deletedCount = 0;
    }

    results.push({
      resourceType: item.resourceType,
      action: item.action,
      deletedCount,
      archivedCount: 0,
      cutoffDate: item.cutoffDate,
    });
  }

  return results;
}

export async function estimateRetentionCounts(options: {
  agencyId: string;
  plan: RetentionPlanItem[];
}): Promise<RetentionPlanItem[]> {
  const { agencyId, plan } = options;
  const updated: RetentionPlanItem[] = [];

  for (const item of plan) {
    if (item.action === "skip") {
      updated.push({ ...item, estimatedCount: 0 });
      continue;
    }

    let count = 0;
    switch (item.resourceType) {
      case "workflow_executions": {
        const [row] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(workflowExecutions)
          .where(and(eq(workflowExecutions.agencyId, agencyId), lt(workflowExecutions.createdAt, item.cutoffDate)));
        count = row?.count ?? 0;
        break;
      }
      case "workflow_events": {
        const [row] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(workflowEvents)
          .where(and(eq(workflowEvents.agencyId, agencyId), lt(workflowEvents.timestamp, item.cutoffDate)));
        count = row?.count ?? 0;
        break;
      }
      case "signals": {
        const [row] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(workflowSignals)
          .where(and(eq(workflowSignals.agencyId, agencyId), lt(workflowSignals.ingestedAt, item.cutoffDate)));
        count = row?.count ?? 0;
        break;
      }
      case "ai_executions": {
        const [row] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(aiExecutions)
          .where(and(eq(aiExecutions.agencyId, agencyId), lt(aiExecutions.createdAt, item.cutoffDate)));
        count = row?.count ?? 0;
        break;
      }
      case "rule_evaluations": {
        const ruleIds = await db
          .select({ id: workflowRules.id })
          .from(workflowRules)
          .where(eq(workflowRules.agencyId, agencyId));
        const ids = ruleIds.map((row) => row.id);
        if (ids.length > 0) {
          const [row] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(workflowRuleEvaluations)
            .where(and(inArray(workflowRuleEvaluations.ruleId, ids), lt(workflowRuleEvaluations.createdAt, item.cutoffDate)));
          count = row?.count ?? 0;
        }
        break;
      }
      default:
        count = 0;
    }

    updated.push({ ...item, estimatedCount: count });
  }

  return updated;
}
