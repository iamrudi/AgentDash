import { db } from "../db";
import { workflowRetentionPolicies } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface RetentionPlanItem {
  resourceType: string;
  retentionDays: number;
  cutoffDate: Date;
  enabled: boolean;
  archiveBeforeDelete: boolean;
  action: "delete" | "archive" | "skip";
}

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
