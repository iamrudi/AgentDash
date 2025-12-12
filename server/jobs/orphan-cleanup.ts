import cron from 'node-cron';
import { cleanupOrphanedUsers, detectOrphanedUsers } from '../lib/user-provisioning';
import logger from '../middleware/logger';
import { cronHeartbeat } from '../services/cronHeartbeat';

const JOB_NAME = "orphan-cleanup";
const SCHEDULE = "0 2 * * *";

export function scheduleOrphanCleanup() {
  cronHeartbeat.register(JOB_NAME, SCHEDULE);

  cron.schedule(SCHEDULE, async () => {
    cronHeartbeat.recordStart(JOB_NAME);
    logger.info('[ORPHAN_CLEANUP_JOB] Starting scheduled orphan cleanup');
    
    try {
      const orphans = await detectOrphanedUsers();
      
      if (orphans.length === 0) {
        logger.info('[ORPHAN_CLEANUP_JOB] No orphaned users found');
        cronHeartbeat.recordSuccess(JOB_NAME);
        return;
      }
      
      logger.warn(`[ORPHAN_CLEANUP_JOB] Found ${orphans.length} orphaned users:`);
      orphans.forEach(orphan => {
        logger.warn(`[ORPHAN_CLEANUP_JOB]   - ${orphan.id} (${orphan.email})`);
      });
      
      const result = await cleanupOrphanedUsers();
      
      logger.info(`[ORPHAN_CLEANUP_JOB] Cleanup complete: ${result.deleted} deleted, ${result.errors} errors`);
      
      if (result.errors > 0) {
        logger.error(`[ORPHAN_CLEANUP_JOB] Some orphans could not be deleted - manual intervention may be required`);
      }
      
      cronHeartbeat.recordSuccess(JOB_NAME);
    } catch (error: any) {
      cronHeartbeat.recordError(JOB_NAME, error.message || "Unknown error");
      logger.error(`[ORPHAN_CLEANUP_JOB] Job failed: ${error.message}`);
      logger.error(error);
    }
  });
  
  logger.info('[ORPHAN_CLEANUP_JOB] Scheduled nightly orphan cleanup at 2:00 AM');
}

/**
 * Manually trigger orphan cleanup (for testing or emergency use)
 */
export async function runOrphanCleanupNow(): Promise<{ deleted: number; errors: number }> {
  logger.info('[ORPHAN_CLEANUP_JOB] Manual cleanup triggered');
  return await cleanupOrphanedUsers();
}
