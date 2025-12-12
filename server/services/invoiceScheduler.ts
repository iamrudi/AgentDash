import cron from "node-cron";
import { InvoiceGeneratorService } from "./invoiceGenerator";
import type { IStorage } from "../storage";
import { cronHeartbeat } from "./cronHeartbeat";
import logger from "../middleware/logger";

const JOB_NAME = "invoice-scheduler";
const SCHEDULE = "0 9 * * *";

export class InvoiceScheduler {
  private invoiceGenerator: InvoiceGeneratorService;

  constructor(storage: IStorage) {
    this.invoiceGenerator = new InvoiceGeneratorService(storage);
  }

  start(): void {
    cronHeartbeat.register(JOB_NAME, SCHEDULE);

    cron.schedule(SCHEDULE, async () => {
      cronHeartbeat.recordStart(JOB_NAME);
      try {
        const currentDay = new Date().getDate();
        logger.info(`Running invoice generation check for day ${currentDay}`);
        await this.invoiceGenerator.generateMonthlyRetainerInvoices(currentDay);
        cronHeartbeat.recordSuccess(JOB_NAME);
        logger.info("Invoice generation check completed");
      } catch (error: any) {
        cronHeartbeat.recordError(JOB_NAME, error.message || "Unknown error");
        logger.error("Error in scheduled invoice generation:", error);
      }
    });

    logger.info("Invoice scheduler started - will run daily at 9:00 AM");
  }

  async runNow(): Promise<void> {
    const currentDay = new Date().getDate();
    logger.info(`Running immediate invoice generation for day ${currentDay}`);
    await this.invoiceGenerator.generateMonthlyRetainerInvoices(currentDay);
  }
}
