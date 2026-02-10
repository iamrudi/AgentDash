import { db } from "../../db";
import { workflowRetentionPolicies } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
import {
  buildRetentionPlan,
  estimateRetentionCounts,
  runRetentionExecution,
  type RetentionPlanItem,
  type RetentionExecutionResult,
} from "../../jobs/retention-job";

export class RetentionService {
  async getPolicies(agencyId: string) {
    return db
      .select()
      .from(workflowRetentionPolicies)
      .where(eq(workflowRetentionPolicies.agencyId, agencyId));
  }

  async buildPlan(agencyId: string): Promise<RetentionPlanItem[]> {
    const policies = await this.getPolicies(agencyId);
    return buildRetentionPlan(
      policies.map((policy) => ({
        resourceType: policy.resourceType,
        retentionDays: policy.retentionDays,
        enabled: policy.enabled ?? true,
        archiveBeforeDelete: policy.archiveBeforeDelete ?? false,
      }))
    );
  }

  async buildPlanWithCounts(agencyId: string): Promise<RetentionPlanItem[]> {
    const plan = await this.buildPlan(agencyId);
    return estimateRetentionCounts({ agencyId, plan });
  }

  async runCleanup(agencyId: string, dryRun: boolean): Promise<RetentionExecutionResult[]> {
    const policies = await db
      .select()
      .from(workflowRetentionPolicies)
      .where(
        and(
          eq(workflowRetentionPolicies.agencyId, agencyId),
          eq(workflowRetentionPolicies.enabled, true)
        )
      );

    const plan = buildRetentionPlan(
      policies.map((policy) => ({
        resourceType: policy.resourceType,
        retentionDays: policy.retentionDays,
        enabled: policy.enabled ?? true,
        archiveBeforeDelete: policy.archiveBeforeDelete ?? false,
      }))
    );

    const results = await runRetentionExecution({
      agencyId,
      plan,
      dryRun,
    });

    const updatedAt = new Date();
    for (const policy of policies) {
      const result = results.find((row) => row.resourceType === policy.resourceType);
      if (!result) continue;
      const deletedCount = result.deletedCount ?? 0;

      await db.update(workflowRetentionPolicies)
        .set({
          lastCleanupAt: updatedAt,
          recordsDeleted: sql`${workflowRetentionPolicies.recordsDeleted} + ${deletedCount}`,
          updatedAt,
        })
        .where(eq(workflowRetentionPolicies.id, policy.id));
    }

    return results;
  }
}
