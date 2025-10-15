import { Router } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/supabase-auth";
import { z } from "zod";
import { insertCompanySchema, insertContactSchema, insertDealSchema, insertFormSchema, insertFormFieldSchema } from "@shared/schema";

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

// Update a contact
crmRouter.patch("/contacts/:id", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const agencyId = req.user!.agencyId;
    
    if (!agencyId) {
      return res.status(403).json({ message: "No agency access" });
    }

    // Verify contact exists and belongs to agency
    const existingContact = await storage.getContactById(id);
    
    if (!existingContact) {
      return res.status(404).json({ message: "Contact not found" });
    }
    
    if (existingContact.agencyId !== agencyId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Exclude agencyId and clientId from updates to prevent tenant isolation breach
    const updateContactSchema = insertContactSchema.omit({ 
      agencyId: true, 
      clientId: true 
    }).partial().extend({
      companyId: z.string().uuid().optional().nullable(),
    });
    
    const validatedData = updateContactSchema.parse(req.body);

    // Verify companyId belongs to caller's agency if provided (tenant isolation)
    if (validatedData.companyId) {
      const company = await storage.getCompanyById(validatedData.companyId);
      
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      if (company.agencyId !== agencyId) {
        return res.status(403).json({ message: "Access denied: Company belongs to different agency" });
      }
    }

    const updatedContact = await storage.updateContact(id, validatedData);
    res.json(updatedContact);
  } catch (error: any) {
    console.error("Update contact error:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    res.status(500).json({ message: error.message || "Failed to update contact" });
  }
});

// Delete a contact
crmRouter.delete("/contacts/:id", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const agencyId = req.user!.agencyId;
    
    if (!agencyId) {
      return res.status(403).json({ message: "No agency access" });
    }

    // Verify contact exists and belongs to agency
    const existingContact = await storage.getContactById(id);
    
    if (!existingContact) {
      return res.status(404).json({ message: "Contact not found" });
    }
    
    if (existingContact.agencyId !== agencyId) {
      return res.status(403).json({ message: "Access denied" });
    }

    await storage.deleteContact(id);
    res.json({ message: "Contact deleted successfully" });
  } catch (error: any) {
    console.error("Delete contact error:", error);
    res.status(500).json({ message: error.message || "Failed to delete contact" });
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
    
    // Join with contact and company data - verify tenant isolation
    const dealsWithRelations = await Promise.all(
      deals.map(async (deal) => {
        const contact = await storage.getContactById(deal.contactId);
        
        // Verify contact belongs to this agency
        if (contact && contact.agencyId !== agencyId) {
          return { ...deal, contact: null, company: null };
        }
        
        let company = null;
        if (deal.companyId) {
          const fetchedCompany = await storage.getCompanyById(deal.companyId);
          
          // Only return company if it belongs to the caller's agency
          if (fetchedCompany && fetchedCompany.agencyId === agencyId) {
            company = fetchedCompany;
          }
        }
        
        return { ...deal, contact, company };
      })
    );
    
    res.json(dealsWithRelations);
  } catch (error: any) {
    console.error("Get deals error:", error);
    res.status(500).json({ message: error.message || "Failed to fetch deals" });
  }
});

// Create a new deal
crmRouter.post("/deals", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user!.agencyId;
    
    if (!agencyId) {
      return res.status(403).json({ message: "No agency access" });
    }

    // Validate request body - exclude agencyId, ownerId as they come from server
    const createDealSchema = insertDealSchema.omit({ 
      agencyId: true, 
      ownerId: true 
    }).extend({
      name: z.string().min(1, "Deal name is required"),
      value: z.number().int().optional(),
      stage: z.enum(["lead", "qualified", "proposal", "closed-won", "closed-lost"]).default("lead"),
      closeDate: z.string().optional(),
      contactId: z.string().uuid("Please select a contact"),
      companyId: z.string().uuid().optional(),
    });

    const validatedData = createDealSchema.parse(req.body);

    // Verify contactId belongs to caller's agency (required field - tenant isolation)
    const contact = await storage.getContactById(validatedData.contactId);
    
    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }
    
    if (contact.agencyId !== agencyId) {
      return res.status(403).json({ message: "Access denied: Contact belongs to different agency" });
    }

    // Verify companyId belongs to caller's agency (optional field - tenant isolation)
    if (validatedData.companyId) {
      const company = await storage.getCompanyById(validatedData.companyId);
      
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      if (company.agencyId !== agencyId) {
        return res.status(403).json({ message: "Access denied: Company belongs to different agency" });
      }
    }

    const dealData = {
      ...validatedData,
      agencyId,
      ownerId: null, // Could be set to req.user.id if needed
    };

    const newDeal = await storage.createDeal(dealData);

    res.status(201).json(newDeal);
  } catch (error: any) {
    console.error("Create deal error:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    res.status(500).json({ message: error.message || "Failed to create deal" });
  }
});

// Update a deal
crmRouter.patch("/deals/:id", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const agencyId = req.user!.agencyId;
    
    if (!agencyId) {
      return res.status(403).json({ message: "No agency access" });
    }

    // Verify deal exists and belongs to agency
    const existingDeal = await storage.getDealById(id);
    
    if (!existingDeal) {
      return res.status(404).json({ message: "Deal not found" });
    }
    
    if (existingDeal.agencyId !== agencyId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Exclude agencyId and ownerId from updates to prevent tenant isolation breach
    const updateDealSchema = insertDealSchema.omit({ 
      agencyId: true, 
      ownerId: true 
    }).partial().extend({
      contactId: z.string().uuid().optional(),
      companyId: z.string().uuid().optional().nullable(),
    });
    
    const validatedData = updateDealSchema.parse(req.body);

    // Verify contactId belongs to caller's agency if provided (tenant isolation)
    if (validatedData.contactId) {
      const contact = await storage.getContactById(validatedData.contactId);
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      if (contact.agencyId !== agencyId) {
        return res.status(403).json({ message: "Access denied: Contact belongs to different agency" });
      }
    }

    // Verify companyId belongs to caller's agency if provided (tenant isolation)
    if (validatedData.companyId) {
      const company = await storage.getCompanyById(validatedData.companyId);
      
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      if (company.agencyId !== agencyId) {
        return res.status(403).json({ message: "Access denied: Company belongs to different agency" });
      }
    }

    const updatedDeal = await storage.updateDeal(id, validatedData);
    res.json(updatedDeal);
  } catch (error: any) {
    console.error("Update deal error:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    res.status(500).json({ message: error.message || "Failed to update deal" });
  }
});

// Delete a deal
crmRouter.delete("/deals/:id", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const agencyId = req.user!.agencyId;
    
    if (!agencyId) {
      return res.status(403).json({ message: "No agency access" });
    }

    // Verify deal exists and belongs to agency
    const existingDeal = await storage.getDealById(id);
    
    if (!existingDeal) {
      return res.status(404).json({ message: "Deal not found" });
    }
    
    if (existingDeal.agencyId !== agencyId) {
      return res.status(403).json({ message: "Access denied" });
    }

    await storage.deleteDeal(id);
    res.json({ message: "Deal deleted successfully" });
  } catch (error: any) {
    console.error("Delete deal error:", error);
    res.status(500).json({ message: error.message || "Failed to delete deal" });
  }
});

// ============================================================================
// FORMS
// ============================================================================

// Get all forms for the agency
crmRouter.get("/forms", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user!.agencyId;
    
    if (!agencyId) {
      return res.status(403).json({ message: "No agency access" });
    }

    const forms = await storage.getFormsByAgencyId(agencyId);
    res.json(forms);
  } catch (error: any) {
    console.error("Get forms error:", error);
    res.status(500).json({ message: error.message || "Failed to fetch forms" });
  }
});

// Get a single form by ID with fields
crmRouter.get("/forms/:id", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const agencyId = req.user!.agencyId;
    
    if (!agencyId) {
      return res.status(403).json({ message: "No agency access" });
    }

    const form = await storage.getFormById(id);
    
    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }
    
    // Verify tenant isolation
    if (form.agencyId !== agencyId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Fetch form fields
    const fields = await storage.getFormFieldsByFormId(id);
    
    res.json({ ...form, fields });
  } catch (error: any) {
    console.error("Get form error:", error);
    res.status(500).json({ message: error.message || "Failed to fetch form" });
  }
});

// Create a new form with fields
crmRouter.post("/forms", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user!.agencyId;
    
    if (!agencyId) {
      return res.status(403).json({ message: "No agency access" });
    }

    // Validate request body
    const createFormSchema = z.object({
      name: z.string().min(1, "Form name is required"),
      description: z.string().optional(),
      fields: z.array(z.object({
        label: z.string().min(1, "Field label is required"),
        fieldType: z.enum(["text", "email", "textarea", "phone"]),
        placeholder: z.string().optional(),
        // Accept boolean from frontend and coerce to number (0 or 1) for database
        required: z.union([
          z.boolean().transform((val) => val ? 1 : 0),
          z.number().int().min(0).max(1)
        ]).default(0),
        sortOrder: z.number().int().min(0),
      })).min(1, "At least one field is required"),
    });

    const validatedData = createFormSchema.parse(req.body);

    // Create form with fields in a transaction
    const newForm = await storage.createFormWithFields({
      name: validatedData.name,
      description: validatedData.description,
      agencyId,
      isDeleted: 0,
    }, validatedData.fields);

    res.status(201).json(newForm);
  } catch (error: any) {
    console.error("Create form error:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    res.status(500).json({ message: error.message || "Failed to create form" });
  }
});

// Update a form (including fields)
crmRouter.patch("/forms/:id", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const agencyId = req.user!.agencyId;
    
    if (!agencyId) {
      return res.status(403).json({ message: "No agency access" });
    }

    // Verify form exists and belongs to agency
    const existingForm = await storage.getFormById(id);
    
    if (!existingForm) {
      return res.status(404).json({ message: "Form not found" });
    }
    
    if (existingForm.agencyId !== agencyId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Validate request body
    const updateFormSchema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      fields: z.array(z.object({
        id: z.string().optional(), // Existing field ID
        label: z.string().min(1, "Field label is required"),
        fieldType: z.enum(["text", "email", "textarea", "phone"]),
        placeholder: z.string().optional(),
        required: z.number().int().min(0).max(1).default(0),
        sortOrder: z.number().int().min(0),
      })).optional(),
    });

    const validatedData = updateFormSchema.parse(req.body);

    // Update form and fields
    const updatedForm = await storage.updateFormWithFields(id, validatedData);
    
    res.json(updatedForm);
  } catch (error: any) {
    console.error("Update form error:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    res.status(500).json({ message: error.message || "Failed to update form" });
  }
});

// Delete a form (soft delete)
crmRouter.delete("/forms/:id", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const agencyId = req.user!.agencyId;
    
    if (!agencyId) {
      return res.status(403).json({ message: "No agency access" });
    }

    // Verify form exists and belongs to agency
    const existingForm = await storage.getFormById(id);
    
    if (!existingForm) {
      return res.status(404).json({ message: "Form not found" });
    }
    
    if (existingForm.agencyId !== agencyId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Soft delete the form
    await storage.softDeleteForm(id);
    res.json({ message: "Form deleted successfully" });
  } catch (error: any) {
    console.error("Delete form error:", error);
    res.status(500).json({ message: error.message || "Failed to delete form" });
  }
});

export default crmRouter;
