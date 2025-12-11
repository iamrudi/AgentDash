import cron from "node-cron";
import { slaService } from "./sla-service";
import { db } from "../db";
import { profiles } from "@shared/schema";
import { isNotNull } from "drizzle-orm";
import logger from "../middleware/logger";

let slaMonitoringJob: ReturnType<typeof cron.schedule> | null = null;

export async function startSlaMonitoring(): Promise<void> {
  if (slaMonitoringJob) {
    logger.info("SLA monitoring already running");
    return;
  }

  slaMonitoringJob = cron.schedule("*/5 * * * *", async () => {
    logger.info("Running SLA breach detection scan");
    
    try {
      const agencies = await db
        .selectDistinct({ agencyId: profiles.agencyId })
        .from(profiles)
        .where(isNotNull(profiles.agencyId));

      const uniqueAgencyIds = Array.from(new Set(
        agencies
          .map(a => a.agencyId)
          .filter((id): id is string => id !== null)
      ));

      for (const agencyId of uniqueAgencyIds) {
        try {
          const breaches = await slaService.detectBreaches(agencyId);
          
          if (breaches.length > 0) {
            logger.info(`Detected ${breaches.length} SLA breaches for agency ${agencyId}`);
            
            for (const breach of breaches) {
              try {
                await slaService.escalateBreach(breach.id);
              } catch (escalationError) {
                logger.error(`Failed to escalate breach ${breach.id}:`, escalationError);
              }
            }
          }
        } catch (agencyError) {
          logger.error(`SLA scan failed for agency ${agencyId}:`, agencyError);
        }
      }

      logger.info("SLA breach detection scan completed");
    } catch (error) {
      logger.error("SLA monitoring job failed:", error);
    }
  });

  logger.info("SLA monitoring started (runs every 5 minutes)");
}

export function stopSlaMonitoring(): void {
  if (slaMonitoringJob) {
    slaMonitoringJob.stop();
    slaMonitoringJob = null;
    logger.info("SLA monitoring stopped");
  }
}

export async function runManualScan(agencyId: string): Promise<{
  breachesDetected: number;
  escalationsTriggered: number;
}> {
  const breaches = await slaService.detectBreaches(agencyId);
  let escalationsTriggered = 0;

  for (const breach of breaches) {
    try {
      await slaService.escalateBreach(breach.id);
      escalationsTriggered++;
    } catch (error) {
      logger.error(`Failed to escalate breach ${breach.id}:`, error);
    }
  }

  return {
    breachesDetected: breaches.length,
    escalationsTriggered,
  };
}
