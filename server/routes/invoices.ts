/**
 * Invoices Router
 * 
 * Invoice management routes for creating, updating, and generating PDFs.
 * Includes line item management and client access controls.
 * 
 * Routes: 6
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, requireInvoiceAccess, type AuthRequest } from '../middleware/supabase-auth';
import { storage } from '../storage';
import { insertInvoiceSchema, insertInvoiceLineItemSchema } from '@shared/schema';
import { PDFGeneratorService } from '../services/pdfGenerator';
import { PDFStorageService } from '../services/pdfStorage';

const invoicesRouter = Router();

const pdfStorageService = new PDFStorageService();
pdfStorageService.initialize().catch(err => {
  console.error('[Invoices Router] Failed to initialize PDF storage:', err);
});

invoicesRouter.post("/", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const validatedData = insertInvoiceSchema.parse(req.body);
    const invoice = await storage.createInvoice(validatedData);
    const client = await storage.getClientById(invoice.clientId);
    res.status(201).json({ ...invoice, client });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: "Validation failed", 
        errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }
    res.status(500).json({ message: error.message || "Failed to create invoice" });
  }
});

invoicesRouter.patch("/:invoiceId/status", requireAuth, requireRole("Admin"), requireInvoiceAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { invoiceId } = req.params;
    const { status } = z.object({ 
      status: z.enum(["Draft", "Due", "Paid", "Overdue"]) 
    }).parse(req.body);

    const invoice = await storage.getInvoiceById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const updatedInvoice = await storage.updateInvoiceStatus(invoiceId, status);
    const client = await storage.getClientById(updatedInvoice.clientId);
    res.json({ ...updatedInvoice, client });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: "Validation failed", 
        errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }
    console.error("Update invoice status error:", error);
    res.status(500).json({ message: error.message || "Failed to update invoice status" });
  }
});

invoicesRouter.get("/:invoiceId", requireAuth, requireRole("Client", "Admin"), requireInvoiceAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { invoiceId } = req.params;
    const invoice = await storage.getInvoiceById(invoiceId);
    
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    if (req.user!.role === "Client") {
      const profile = await storage.getProfileById(req.user!.id);
      if (!profile) {
        return res.status(403).json({ message: "Profile not found" });
      }
      const client = await storage.getClientByProfileId(profile.id);
      
      if (!client) {
        return res.status(403).json({ message: "Client not found" });
      }
      
      if (invoice.clientId !== client.id) {
        return res.status(403).json({ message: "Not authorized to view this invoice" });
      }
    }

    const client = await storage.getClientById(invoice.clientId);
    res.json({ ...invoice, client });
  } catch (error: any) {
    console.error("Get invoice by ID error:", error);
    res.status(500).json({ message: error.message || "Failed to fetch invoice" });
  }
});

invoicesRouter.get("/:invoiceId/line-items", requireAuth, requireInvoiceAccess(storage), async (req: AuthRequest, res) => {
  try {
    if (req.user!.role !== "Client" && req.user!.role !== "Admin") {
      return res.status(403).json({ message: "Not authorized to access invoice line items" });
    }
    
    const { invoiceId } = req.params;
    
    const invoice = await storage.getInvoiceById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    
    if (req.user!.role === "Client") {
      const profile = await storage.getProfileById(req.user!.id);
      if (!profile) {
        return res.status(403).json({ message: "Profile not found" });
      }
      const client = await storage.getClientByProfileId(profile.id);
      
      if (!client) {
        return res.status(403).json({ message: "Client not found" });
      }
      
      if (invoice.clientId !== client.id) {
        return res.status(403).json({ message: "Not authorized to view these invoice line items" });
      }
    }
    
    const lineItems = await storage.getInvoiceLineItemsByInvoiceId(invoiceId);
    res.json(lineItems);
  } catch (error: any) {
    console.error("Get invoice line items error:", error);
    res.status(500).json({ message: error.message || "Failed to fetch invoice line items" });
  }
});

invoicesRouter.post("/:invoiceId/line-items", requireAuth, requireRole("Admin"), requireInvoiceAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { invoiceId } = req.params;
    
    const invoice = await storage.getInvoiceById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    
    const client = await storage.getClientById(invoice.clientId);
    if (!client) {
      return res.status(404).json({ message: "Client not found for this invoice" });
    }
    
    const lineItems = Array.isArray(req.body) ? req.body : [req.body];
    
    const validatedItems = lineItems.map(item => 
      insertInvoiceLineItemSchema.omit({ invoiceId: true }).parse(item)
    );
    
    const createdItems = await storage.createInvoiceLineItems(
      validatedItems.map(item => ({ ...item, invoiceId }))
    );
    
    res.status(201).json(createdItems);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: "Validation failed", 
        errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }
    console.error("Create invoice line items error:", error);
    res.status(500).json({ message: error.message || "Failed to create invoice line items" });
  }
});

invoicesRouter.post("/:invoiceId/generate-pdf", requireAuth, requireRole("Admin"), requireInvoiceAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { invoiceId } = req.params;
    
    const invoice = await storage.getInvoiceById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const pdfGenerator = new PDFGeneratorService(storage);
    const pdfBuffer = await pdfGenerator.generateInvoicePDF(invoiceId);

    const pdfUrl = await pdfStorageService.savePDF(invoice.invoiceNumber, pdfBuffer);

    await storage.updateInvoice(invoiceId, { pdfUrl });

    res.json({ pdfUrl, message: "PDF generated successfully" });
  } catch (error: any) {
    console.error("Generate PDF error:", error);
    res.status(500).json({ message: error.message || "Failed to generate PDF" });
  }
});

export default invoicesRouter;
