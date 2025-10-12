import cron from "node-cron";
import type { IStorage } from "../storage";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { initiatives } from "@shared/schema";

export class TrashCleanupScheduler {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Start the trash cleanup scheduler
   * Runs daily at 2:00 AM to permanently delete initiatives that have been in trash for 30+ days
   */
  start(): void {
    // Run every day at 2:00 AM
    cron.schedule("0 2 * * *", async () => {
      try {
        console.log("Running trash cleanup check...");
        await this.cleanupOldDeletedInitiatives();
        console.log("Trash cleanup completed");
      } catch (error) {
        console.error("Error in scheduled trash cleanup:", error);
      }
    });

    console.log("Trash cleanup scheduler started - will run daily at 2:00 AM");
  }

  /**
   * Permanently delete initiatives that have been in trash for 30+ days
   */
  async cleanupOldDeletedInitiatives(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Find all initiatives deleted more than 30 days ago
    const oldDeletedInitiatives = await db
      .select()
      .from(initiatives)
      .where(sql`${initiatives.deletedAt} IS NOT NULL AND ${initiatives.deletedAt} < ${thirtyDaysAgo}`);

    if (oldDeletedInitiatives.length === 0) {
      console.log("No initiatives older than 30 days in trash");
      return;
    }

    console.log(`Found ${oldDeletedInitiatives.length} initiatives to permanently delete`);

    // Delete each initiative permanently
    for (const initiative of oldDeletedInitiatives) {
      try {
        await this.storage.permanentlyDeleteInitiative(initiative.id);
        console.log(`Permanently deleted initiative: ${initiative.title} (ID: ${initiative.id})`);
      } catch (error) {
        console.error(`Failed to delete initiative ${initiative.id}:`, error);
      }
    }

    console.log(`Successfully cleaned up ${oldDeletedInitiatives.length} old initiatives`);
  }

  /**
   * Run cleanup immediately for testing
   */
  async runNow(): Promise<void> {
    console.log("Running immediate trash cleanup");
    await this.cleanupOldDeletedInitiatives();
  }
}
