import type { IStorage } from "../storage";
import type { InsertInvoice, InsertInvoiceLineItem } from "@shared/schema";

export class InvoiceGeneratorService {
  constructor(private storage: IStorage) {}

  /**
   * Generate monthly retainer invoices for all clients with retainer amounts
   * Called by cron job on the billing day of each month
   */
  async generateMonthlyRetainerInvoices(currentDay: number): Promise<void> {
    try {
      const clients = await this.storage.getAllClients();
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      for (const client of clients) {
        // Skip if client doesn't have retainer or billing day doesn't match
        if (!client.retainerAmount || client.billingDay !== currentDay) {
          continue;
        }

        // Check if invoice already exists for this month
        const existingInvoices = await this.storage.getInvoicesByClientId(client.id);
        const hasInvoiceThisMonth = existingInvoices.some(invoice => {
          const issueDate = new Date(invoice.issueDate);
          return issueDate.getMonth() === currentMonth && issueDate.getFullYear() === currentYear;
        });

        if (hasInvoiceThisMonth) {
          console.log(`Invoice already exists for client ${client.companyName} this month`);
          continue;
        }

        // Generate invoice number
        const invoiceNumber = this.generateInvoiceNumber(client.id, today);

        // Calculate due date (30 days from issue)
        const dueDate = new Date(today);
        dueDate.setDate(dueDate.getDate() + 30);

        // Create invoice
        const invoice: InsertInvoice = {
          clientId: client.id,
          invoiceNumber,
          issueDate: today.toISOString().split('T')[0],
          dueDate: dueDate.toISOString().split('T')[0],
          totalAmount: client.retainerAmount.toString(),
          status: "Due",
          pdfUrl: null,
        };

        const createdInvoice = await this.storage.createInvoice(invoice);

        // Create line item for retainer
        const lineItem: InsertInvoiceLineItem = {
          invoiceId: createdInvoice.id,
          description: `Monthly Retainer - ${today.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
          quantity: 1,
          unitPrice: client.retainerAmount.toString(),
          lineTotal: client.retainerAmount.toString(),
          projectId: null,
          taskId: null,
        };

        await this.storage.createInvoiceLineItems([lineItem]);

        console.log(`Generated retainer invoice ${invoiceNumber} for client ${client.companyName}`);
      }
    } catch (error) {
      console.error("Error generating monthly retainer invoices:", error);
      throw error;
    }
  }

  /**
   * Generate invoice from approved recommendation
   * Called when admin approves a paid recommendation
   */
  async generateInvoiceFromRecommendation(recommendationId: string): Promise<string> {
    try {
      const recommendation = await this.storage.getRecommendationById(recommendationId);
      
      if (!recommendation) {
        throw new Error("Recommendation not found");
      }

      if (recommendation.status !== "Approved") {
        throw new Error("Only approved recommendations can be invoiced");
      }

      const client = await this.storage.getClientById(recommendation.clientId);
      if (!client) {
        throw new Error("Client not found");
      }

      const today = new Date();
      const invoiceNumber = this.generateInvoiceNumber(client.id, today);
      
      // Due in 30 days
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + 30);

      // Get cost value
      const costValue = recommendation.cost || "0";

      // Create invoice
      const invoice: InsertInvoice = {
        clientId: client.id,
        invoiceNumber,
        issueDate: today.toISOString().split('T')[0],
        dueDate: dueDate.toISOString().split('T')[0],
        totalAmount: costValue,
        status: "Due",
        pdfUrl: null,
      };

      const createdInvoice = await this.storage.createInvoice(invoice);

      // Create line item from recommendation
      const lineItem: InsertInvoiceLineItem = {
        invoiceId: createdInvoice.id,
        description: recommendation.title,
        quantity: 1,
        unitPrice: costValue,
        lineTotal: costValue,
        projectId: null,
        taskId: null,
      };

      await this.storage.createInvoiceLineItems([lineItem]);

      console.log(`Generated invoice ${invoiceNumber} from recommendation ${recommendationId}`);
      
      return createdInvoice.id;
    } catch (error) {
      console.error("Error generating invoice from recommendation:", error);
      throw error;
    }
  }

  /**
   * Generate a unique invoice number
   * Format: INV-CLIENTID-YYYYMMDD-XXX
   */
  private generateInvoiceNumber(clientId: string, date: Date): string {
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const clientPrefix = clientId.substring(0, 8).toUpperCase();
    return `INV-${clientPrefix}-${dateStr}-${random}`;
  }
}
