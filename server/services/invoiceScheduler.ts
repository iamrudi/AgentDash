import cron from "node-cron";
import { InvoiceGeneratorService } from "./invoiceGenerator";
import type { IStorage } from "../storage";

export class InvoiceScheduler {
  private invoiceGenerator: InvoiceGeneratorService;

  constructor(storage: IStorage) {
    this.invoiceGenerator = new InvoiceGeneratorService(storage);
  }

  /**
   * Start the invoice generation scheduler
   * Runs daily at 9:00 AM to check if any invoices need to be generated
   */
  start(): void {
    // Run every day at 9:00 AM
    cron.schedule("0 9 * * *", async () => {
      try {
        const currentDay = new Date().getDate();
        console.log(`Running invoice generation check for day ${currentDay}`);
        await this.invoiceGenerator.generateMonthlyRetainerInvoices(currentDay);
        console.log("Invoice generation check completed");
      } catch (error) {
        console.error("Error in scheduled invoice generation:", error);
      }
    });

    console.log("Invoice scheduler started - will run daily at 9:00 AM");
  }

  /**
   * Run invoice generation immediately for testing
   */
  async runNow(): Promise<void> {
    const currentDay = new Date().getDate();
    console.log(`Running immediate invoice generation for day ${currentDay}`);
    await this.invoiceGenerator.generateMonthlyRetainerInvoices(currentDay);
  }
}
