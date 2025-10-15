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

    // Validate request body - exclude agencyId as it comes from authenticated user
    const createCompanySchema = insertCompanySchema.omit({ agencyId: true }).extend({
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
    
    // Join with companies data - verify tenant isolation
    const contactsWithCompanies = await Promise.all(
      contacts.map(async (contact) => {
        if (contact.companyId) {
          const company = await storage.getCompanyById(contact.companyId);
          
          // Only return company if it belongs to the caller's agency (tenant isolation)
          if (company && company.agencyId === agencyId) {
            return { ...contact, company };
          }
          
          // Company doesn't belong to this agency - return null
          return { ...contact, company: null };
        }
        return { ...contact, company: null };
      })
    );
    
    res.json(contactsWithCompanies);
  } catch (error: any) {
    console.error("Get contacts error:", error);
    res.status(500).json({ message: error.message || "Failed to fetch contacts" });
  }
});

// Create a new contact
crmRouter.post("/contacts", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user!.agencyId;
    
    if (!agencyId) {
      return res.status(403).json({ message: "No agency access" });
    }

    // Validate request body - exclude agencyId, clientId as they come from server
    const createContactSchema = insertContactSchema.omit({ 
      agencyId: true, 
      clientId: true 
    }).extend({
      firstName: z.string().min(1, "First name is required"),
      lastName: z.string().min(1, "Last name is required"),
      email: z.string().email("Please enter a valid email address"),
      phone: z.string().optional(),
      companyId: z.string().uuid().optional().nullable(),
    });

    const validatedData = createContactSchema.parse(req.body);

    // Verify companyId belongs to caller's agency (tenant isolation)
    if (validatedData.companyId) {
      const company = await storage.getCompanyById(validatedData.companyId);
      
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      if (company.agencyId !== agencyId) {
        return res.status(403).json({ message: "Access denied: Company belongs to different agency" });
      }
    }

    const contactData = {
      ...validatedData,
      agencyId,
      clientId: null,
    };

    const newContact = await storage.createContact(contactData);

    res.status(201).json(newContact);
  } catch (error: any) {
    console.error("Create contact error:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    res.status(500).json({ message: error.message || "Failed to create contact" });
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
