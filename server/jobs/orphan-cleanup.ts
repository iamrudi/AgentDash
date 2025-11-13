import cron from 'node-cron';
import { cleanupOrphanedUsers, detectOrphanedUsers } from '../lib/user-provisioning';
import logger from '../middleware/logger';

/**
 * Automated orphan user cleanup job
 * Runs nightly at 2:00 AM to detect and clean up orphaned users
 */
export function scheduleOrphanCleanup() {
  // Run every night at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    logger.info('[ORPHAN_CLEANUP_JOB] Starting scheduled orphan cleanup');
    
    try {
      // First detect to log what we find
      const orphans = await detectOrphanedUsers();
      
      if (orphans.length === 0) {
        logger.info('[ORPHAN_CLEANUP_JOB] No orphaned users found');
        return;
      }
      
      logger.warn(`[ORPHAN_CLEANUP_JOB] Found ${orphans.length} orphaned users:`);
      orphans.forEach(orphan => {
        logger.warn(`[ORPHAN_CLEANUP_JOB]   - ${orphan.id} (${orphan.email})`);
      });
      
      // Clean up orphaned users
      const result = await cleanupOrphanedUsers();
      
      logger.info(`[ORPHAN_CLEANUP_JOB] Cleanup complete: ${result.deleted} deleted, ${result.errors} errors`);
      
      if (result.errors > 0) {
        logger.error(`[ORPHAN_CLEANUP_JOB] Some orphans could not be deleted - manual intervention may be required`);
      }
    } catch (error: any) {
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
