import fs from "fs/promises";
import path from "path";

export class PDFStorageService {
  private storageDir: string;

  constructor() {
    // Store PDFs in a public directory
    this.storageDir = path.join(process.cwd(), "public", "invoices");
  }

  /**
   * Initialize storage directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      console.log("PDF storage directory initialized");
    } catch (error) {
      console.error("Error initializing PDF storage:", error);
      throw error;
    }
  }

  /**
   * Save PDF buffer to file and return public URL
   */
  async savePDF(invoiceNumber: string, pdfBuffer: Buffer): Promise<string> {
    try {
      // Ensure directory exists
      await this.initialize();

      // Create filename from invoice number
      const filename = `${invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      const filePath = path.join(this.storageDir, filename);

      // Save PDF to file
      await fs.writeFile(filePath, pdfBuffer);

      // Return public URL
      const publicUrl = `/invoices/${filename}`;
      console.log(`PDF saved successfully: ${publicUrl}`);
      
      return publicUrl;
    } catch (error) {
      console.error("Error saving PDF:", error);
      throw error;
    }
  }

  /**
   * Delete PDF file
   */
  async deletePDF(pdfUrl: string): Promise<void> {
    try {
      const filename = path.basename(pdfUrl);
      const filePath = path.join(this.storageDir, filename);
      
      await fs.unlink(filePath);
      console.log(`PDF deleted: ${pdfUrl}`);
    } catch (error) {
      console.error("Error deleting PDF:", error);
      // Don't throw - file might not exist
    }
  }

  /**
   * Check if PDF exists
   */
  async pdfExists(pdfUrl: string): Promise<boolean> {
    try {
      const filename = path.basename(pdfUrl);
      const filePath = path.join(this.storageDir, filename);
      
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
