import { Router } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/supabase-auth";
import { z } from "zod";
import { insertCompanySchema, insertContactSchema, insertDealSchema } from "@shared/schema";

const crmRouter = Router();

// ============================================================================
// COMPANIES
// ============================================================================

// Get all companies for the agency
crmRouter.get("/companies", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user!.agencyId;
    
    if (!agencyId) {
      return res.status(403).json({ message: "No agency access" });
    }

    const companies = await storage.getCompaniesByAgencyId(agencyId);
    res.json(companies);
  } catch (error: any) {
    console.error("Get companies error:", error);
    res.status(500).json({ message: error.message || "Failed to fetch companies" });
  }
});

// Get a single company by ID
crmRouter.get("/companies/:id", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const agencyId = req.user!.agencyId;
    
    if (!agencyId) {
      return res.status(403).json({ message: "No agency access" });
    }

    const company = await storage.getCompanyById(id);
    
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }
    
    // Verify tenant isolation
    if (company.agencyId !== agencyId) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(company);
  } catch (error: any) {
    console.error("Get company error:", error);
    res.status(500).json({ message: error.message || "Failed to fetch company" });
  }
});

// Create a new company
crmRouter.post("/companies", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user!.agencyId;
    
    if (!agencyId) {
      return res.status(403).json({ message: "No agency access" });
    }

    // Validate request body
    const createCompanySchema = insertCompanySchema.extend({
      name: z.string().min(1, "Company name is required"),
      website: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
      phone: z.string().optional(),
      address: z.string().optional(),
      type: z.enum(["customer", "supplier", "partner", "lead"]).default("lead"),
    });

    const validatedData = createCompanySchema.parse(req.body);

    const newCompany = await storage.createCompany({
      ...validatedData,
      agencyId,
    });

    res.status(201).json(newCompany);
  } catch (error: any) {
    console.error("Create company error:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    res.status(500).json({ message: error.message || "Failed to create company" });
  }
});

// Update a company
crmRouter.patch("/companies/:id", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const agencyId = req.user!.agencyId;
    
    if (!agencyId) {
      return res.status(403).json({ message: "No agency access" });
    }

    // Verify company exists and belongs to agency
    const existingCompany = await storage.getCompanyById(id);
    
    if (!existingCompany) {
      return res.status(404).json({ message: "Company not found" });
    }
    
    if (existingCompany.agencyId !== agencyId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Exclude agencyId from updates to prevent tenant isolation breach
    const updateCompanySchema = insertCompanySchema.omit({ agencyId: true }).partial();
    const validatedData = updateCompanySchema.parse(req.body);

    const updatedCompany = await storage.updateCompany(id, validatedData);
    res.json(updatedCompany);
  } catch (error: any) {
    console.error("Update company error:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    res.status(500).json({ message: error.message || "Failed to update company" });
  }
});

// Delete a company
crmRouter.delete("/companies/:id", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const agencyId = req.user!.agencyId;
    
    if (!agencyId) {
      return res.status(403).json({ message: "No agency access" });
    }

    // Verify company exists and belongs to agency
    const existingCompany = await storage.getCompanyById(id);
    
    if (!existingCompany) {
      return res.status(404).json({ message: "Company not found" });
    }
    
    if (existingCompany.agencyId !== agencyId) {
      return res.status(403).json({ message: "Access denied" });
    }

    await storage.deleteCompany(id);
    res.json({ message: "Company deleted successfully" });
  } catch (error: any) {
    console.error("Delete company error:", error);
    res.status(500).json({ message: error.message || "Failed to delete company" });
  }
});

// ============================================================================
// CONTACTS
// ============================================================================

// Get all contacts for the agency
crmRouter.get("/contacts", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user!.agencyId;
    
    if (!agencyId) {
      return res.status(403).json({ message: "No agency access" });
    }

    const contacts = await storage.getContactsByAgencyId(agencyId);
    res.json(contacts);
  } catch (error: any) {
    console.error("Get contacts error:", error);
    res.status(500).json({ message: error.message || "Failed to fetch contacts" });
  }
});

// ============================================================================
// DEALS
// ============================================================================

// Get all deals for the agency
crmRouter.get("/deals", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user!.agencyId;
    
    if (!agencyId) {
      return res.status(403).json({ message: "No agency access" });
    }

    const deals = await storage.getDealsByAgencyId(agencyId);
    res.json(deals);
  } catch (error: any) {
    console.error("Get deals error:", error);
    res.status(500).json({ message: error.message || "Failed to fetch deals" });
  }
});

export default crmRouter;
