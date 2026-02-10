import cron from "node-cron";
import logger from "../middleware/logger";
import { cronHeartbeat } from "../services/cronHeartbeat";
import { db } from "../db";
import { workflowRetentionPolicies } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { buildRetentionPlan, runRetentionExecution } from "./retention-job";

const JOB_NAME = "retention-cleanup";
const SCHEDULE = "0 3 * * *";

export function scheduleRetentionCleanup() {
  cronHeartbeat.register(JOB_NAME, SCHEDULE);

  cron.schedule(SCHEDULE, async () => {
    cronHeartbeat.recordStart(JOB_NAME);
    logger.info("[RETENTION_CLEANUP_JOB] Starting scheduled retention cleanup (dry-run)");

    try {
      const agencyIds = await db
        .selectDistinct({ agencyId: workflowRetentionPolicies.agencyId })
        .from(workflowRetentionPolicies)
        .where(eq(workflowRetentionPolicies.enabled, true));

      for (const { agencyId } of agencyIds) {
        const policies = await db
          .select()
          .from(workflowRetentionPolicies)
          .where(
            and(
              eq(workflowRetentionPolicies.agencyId, agencyId),
              eq(workflowRetentionPolicies.enabled, true)
            )
          );

        if (policies.length === 0) continue;

        const plan = buildRetentionPlan(
          policies.map((policy) => ({
            resourceType: policy.resourceType,
            retentionDays: policy.retentionDays,
            enabled: policy.enabled ?? true,
            archiveBeforeDelete: policy.archiveBeforeDelete ?? false,
          }))
        );

        await runRetentionExecution({
          agencyId,
          plan,
          dryRun: true,
        });
      }

      cronHeartbeat.recordSuccess(JOB_NAME);
      logger.info("[RETENTION_CLEANUP_JOB] Completed scheduled retention cleanup (dry-run)");
    } catch (error: any) {
      cronHeartbeat.recordError(JOB_NAME, error.message || "Unknown error");
      logger.error(`[RETENTION_CLEANUP_JOB] Job failed: ${error.message}`);
      logger.error(error);
    }
  });

  logger.info("[RETENTION_CLEANUP_JOB] Scheduled nightly retention cleanup (dry-run) at 3:00 AM");
}
