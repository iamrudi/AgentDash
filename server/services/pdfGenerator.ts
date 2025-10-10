import puppeteer from "puppeteer";
import type { IStorage } from "../storage";
import type { Invoice, InvoiceLineItem, Client } from "@shared/schema";

export class PDFGeneratorService {
  constructor(private storage: IStorage) {}

  /**
   * Generate professional PDF invoice from invoice data
   */
  async generateInvoicePDF(invoiceId: string): Promise<Buffer> {
    let browser = null;
    try {
      // Fetch invoice with client and line items
      const invoice = await this.storage.getInvoiceById(invoiceId);
      if (!invoice) {
        throw new Error("Invoice not found");
      }

      const client = await this.storage.getClientById(invoice.clientId);
      if (!client) {
        throw new Error("Client not found");
      }

      const lineItems = await this.storage.getInvoiceLineItemsByInvoiceId(invoiceId);

      // Generate HTML template
      const html = this.generateInvoiceHTML(invoice, client, lineItems);

      // Launch headless browser
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      
      // Set content and wait for fonts to load
      await page.setContent(html, { waitUntil: 'networkidle0' });

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px',
        },
      });

      return Buffer.from(pdfBuffer);
    } catch (error) {
      console.error("Error generating PDF:", error);
      throw error;
    } finally {
      // Always close browser to prevent process leaks
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Generate HTML template for invoice
   */
  private generateInvoiceHTML(invoice: Invoice, client: Client, lineItems: InvoiceLineItem[]): string {
    const formatCurrency = (amount: string | number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(Number(amount));
    };

    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice ${invoice.invoiceNumber}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            color: #1a1a1a;
            line-height: 1.6;
            padding: 40px;
          }

          .invoice-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 3px solid #3b82f6;
          }

          .company-info h1 {
            font-size: 32px;
            color: #3b82f6;
            margin-bottom: 8px;
          }

          .company-info p {
            color: #6b7280;
            font-size: 14px;
          }

          .invoice-meta {
            text-align: right;
          }

          .invoice-meta h2 {
            font-size: 24px;
            color: #1a1a1a;
            margin-bottom: 12px;
          }

          .invoice-meta p {
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 4px;
          }

          .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            margin-top: 8px;
          }

          .status-due {
            background-color: #dbeafe;
            color: #1e40af;
          }

          .status-paid {
            background-color: #d1fae5;
            color: #065f46;
          }

          .status-overdue {
            background-color: #fee2e2;
            color: #991b1b;
          }

          .status-draft {
            background-color: #f3f4f6;
            color: #374151;
          }

          .billing-section {
            margin: 40px 0;
          }

          .billing-to h3 {
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .billing-to p {
            font-size: 16px;
            color: #1a1a1a;
            font-weight: 500;
          }

          .line-items {
            margin: 40px 0;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          thead {
            background-color: #f9fafb;
            border-bottom: 2px solid #e5e7eb;
          }

          th {
            text-align: left;
            padding: 12px;
            font-size: 12px;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 600;
          }

          th.text-right {
            text-align: right;
          }

          td {
            padding: 16px 12px;
            border-bottom: 1px solid #f3f4f6;
            font-size: 14px;
          }

          td.text-right {
            text-align: right;
          }

          tbody tr:last-child td {
            border-bottom: none;
          }

          .totals-section {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
          }

          .total-row {
            display: flex;
            justify-content: flex-end;
            padding: 8px 0;
          }

          .total-label {
            width: 200px;
            text-align: right;
            font-size: 14px;
            color: #6b7280;
            padding-right: 40px;
          }

          .total-amount {
            width: 150px;
            text-align: right;
            font-size: 14px;
            font-weight: 500;
          }

          .grand-total {
            margin-top: 12px;
            padding-top: 12px;
            border-top: 2px solid #e5e7eb;
          }

          .grand-total .total-label {
            font-size: 18px;
            font-weight: 600;
            color: #1a1a1a;
          }

          .grand-total .total-amount {
            font-size: 24px;
            font-weight: 700;
            color: #3b82f6;
          }

          .payment-info {
            margin-top: 60px;
            padding: 24px;
            background-color: #f9fafb;
            border-radius: 8px;
          }

          .payment-info h3 {
            font-size: 16px;
            color: #1a1a1a;
            margin-bottom: 12px;
          }

          .payment-info p {
            font-size: 14px;
            color: #6b7280;
            line-height: 1.8;
          }

          .footer {
            margin-top: 60px;
            text-align: center;
            font-size: 12px;
            color: #9ca3af;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
          }
        </style>
      </head>
      <body>
        <div class="invoice-header">
          <div class="company-info">
            <h1>Your Agency</h1>
            <p>Professional Marketing Services</p>
          </div>
          <div class="invoice-meta">
            <h2>INVOICE</h2>
            <p><strong>${invoice.invoiceNumber}</strong></p>
            <p>Issue Date: ${formatDate(invoice.issueDate)}</p>
            <p>Due Date: ${formatDate(invoice.dueDate)}</p>
            <span class="status-badge status-${invoice.status.toLowerCase()}">${invoice.status.toUpperCase()}</span>
          </div>
        </div>

        <div class="billing-section">
          <div class="billing-to">
            <h3>Bill To</h3>
            <p>${client.companyName}</p>
          </div>
        </div>

        <div class="line-items">
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th class="text-right">Quantity</th>
                <th class="text-right">Unit Price</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${lineItems.map(item => `
                <tr>
                  <td>${item.description}</td>
                  <td class="text-right">${item.quantity}</td>
                  <td class="text-right">${formatCurrency(item.unitPrice)}</td>
                  <td class="text-right">${formatCurrency(item.lineTotal)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="totals-section">
          <div class="total-row grand-total">
            <div class="total-label">Total Amount Due</div>
            <div class="total-amount">${formatCurrency(invoice.totalAmount)}</div>
          </div>
        </div>

        <div class="payment-info">
          <h3>Payment Information</h3>
          <p>Please make payment within 30 days of the invoice date. You can pay via bank transfer, check, or online payment portal.</p>
          <p>Thank you for your business!</p>
        </div>

        <div class="footer">
          <p>Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </body>
      </html>
    `;
  }
}
