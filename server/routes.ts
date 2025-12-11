import type { Express, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import settingsRouter from "./routes/settings";
import { 
  requireAuth, 
  requireRole, 
  requireClientAccess,
  requireProjectAccess,
  requireTaskAccess,
  requireInitiativeAccess,
  requireInvoiceAccess,
  requireSuperAdmin,
  type AuthRequest 
} from "./middleware/supabase-auth";
import { resolveAgencyContext } from "./middleware/agency-context";
import { generateToken } from "./lib/jwt";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { insertUserSchema, insertProfileSchema, insertClientSchema, createClientUserSchema, createStaffAdminUserSchema, insertInvoiceSchema, insertInvoiceLineItemSchema, insertProjectSchema, insertTaskSchema, updateTaskSchema, agencySettings, updateAgencySettingSchema, projects, taskLists, tasks, taskRelationships, clients, aiExecutions as aiExecutionsTable, workflowRetentionPolicies, workflowExecutions, workflowEvents, workflowSignals, workflowRuleEvaluations, workflowRules, knowledgeDocuments, documentEmbeddings, insertKnowledgeDocumentSchema, updateKnowledgeDocumentSchema, type Task, insertWorkflowRuleSchema, updateWorkflowRuleSchema, insertWorkflowRuleVersionSchema, insertWorkflowRuleConditionSchema, insertWorkflowRuleActionSchema, insertWorkflowSignalSchema, insertWorkflowSignalRouteSchema, updateWorkflowSignalRouteSchema } from "@shared/schema";
import { embeddingService } from "./vector/embedding-service";
import { signalRouter } from "./workflow/signal-router";
import { SignalAdapterFactory } from "./workflow/signal-adapters";
import { getAuthUrl, exchangeCodeForTokens, refreshAccessToken, fetchGA4Properties, fetchGSCSites, fetchGA4Data, fetchGA4AcquisitionChannels, fetchGA4KeyEvents, fetchGA4AvailableKeyEvents, fetchGSCData, fetchGSCTopQueries } from "./lib/googleOAuth";
import { generateOAuthState, verifyOAuthState } from "./lib/oauthState";
import { encrypt, decrypt, safeDecryptCredential } from "./lib/encryption";
import { InvoiceGeneratorService } from "./services/invoiceGenerator";
import { PDFGeneratorService } from "./services/pdfGenerator";
import { PDFStorageService } from "./services/pdfStorage";
import { getAIProvider, invalidateAIProviderCache } from "./ai/provider";
import { hardenedAIExecutor } from "./ai/hardened-executor";
import { cache, CACHE_TTL } from "./lib/cache";
import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { EventEmitter } from "events";
import { db } from "./db";
import { eq, sql, and, lt } from "drizzle-orm";

// Configure multer for logo uploads
const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadsDir = path.join(process.cwd(), 'uploads', 'logos');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req: AuthRequest, file, cb) => {
    const agencyId = req.user?.agencyId || 'unknown';
    const type = req.body?.type || 'logo';
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${agencyId}-${type}-${Date.now()}${ext}`;
    cb(null, filename);
  }
});

const logoUpload = multer({
  storage: logoStorage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, SVG, and WebP images are allowed.'));
    }
  }
});

// SSE event emitter for real-time message updates
const messageEmitter = new EventEmitter();

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve static invoice PDFs
  const pdfStorageService = new PDFStorageService();
  await pdfStorageService.initialize();
  app.use('/invoices', express.static(path.join(process.cwd(), 'public', 'invoices')));

  // Authentication Routes (public)
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, fullName, companyName } = req.body;
      
      // Get default agency first
      const defaultAgency = await storage.getDefaultAgency();
      if (!defaultAgency) {
        return res.status(500).json({ message: "System configuration error: No default agency found" });
      }

      // Use robust provisioning service with compensation logic
      const { provisionUser } = await import("./lib/user-provisioning");
      
      // SECURITY: Always assign Client role for self-registration
      // Admin and Staff roles must be assigned by existing administrators
      await provisionUser({
        email,
        password,
        fullName,
        role: "Client",
        agencyId: defaultAgency.id,
        clientData: companyName ? {
          companyName
        } : undefined
      });

      res.status(201).json({ message: "Account created successfully" });
    } catch (error: any) {
      console.error("Signup error:", error);
      res.status(500).json({ message: error.message || "Signup failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      // Sign in with Supabase Auth
      const { signInWithPassword } = await import("./lib/supabase-auth");
      const authResult = await signInWithPassword(email, password);

      if (!authResult.data.session) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Get profile from our database (profile.id = Supabase Auth user ID)
      const profile = await storage.getProfileByUserId(authResult.data.user!.id);
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }

      // Get agencyId and clientId for tenant isolation
      let agencyId: string | undefined;
      let clientId: string | undefined;

      if (profile.role === "Client") {
        const client = await storage.getClientByProfileId(profile.id);
        clientId = client?.id;
        agencyId = client?.agencyId;
      } else if (profile.role === "Admin" || profile.role === "Staff") {
        agencyId = profile.agencyId || undefined;
      }

      // Return Supabase session tokens (access + refresh)
      res.json({
        token: authResult.data.session!.access_token,
        refreshToken: authResult.data.session!.refresh_token,
        expiresAt: authResult.data.session!.expires_at,
        user: {
          id: authResult.data.user!.id,
          email: authResult.data.user!.email || email,
          profile,
          clientId,
          agencyId,
        },
      });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ message: error.message || "Login failed" });
    }
  });

  // Refresh access token using refresh token
  app.post("/api/auth/refresh", async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ message: "Refresh token required" });
      }

      // Refresh session with Supabase
      const { refreshAccessToken } = await import("./lib/supabase-auth");
      const authResult = await refreshAccessToken(refreshToken);

      if (!authResult.data.session) {
        return res.status(401).json({ message: "Invalid or expired refresh token" });
      }

      // Get profile from our database
      const profile = await storage.getProfileByUserId(authResult.data.user!.id);
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }

      // Get agencyId and clientId for tenant isolation
      let agencyId: string | undefined;
      let clientId: string | undefined;

      if (profile.role === "Client") {
        const client = await storage.getClientByProfileId(profile.id);
        clientId = client?.id;
        agencyId = client?.agencyId;
      } else if (profile.role === "Admin" || profile.role === "Staff") {
        agencyId = profile.agencyId || undefined;
      }

      // Return new tokens
      res.json({
        token: authResult.data.session!.access_token,
        refreshToken: authResult.data.session!.refresh_token,
        expiresAt: authResult.data.session!.expires_at,
        user: {
          id: authResult.data.user!.id,
          email: authResult.data.user!.email || "",
          profile,
          clientId,
          agencyId,
        },
      });
    } catch (error: any) {
      console.error("Token refresh error:", error);
      res.status(401).json({ message: "Token refresh failed" });
    }
  });

  // Update user's own profile (Staff Settings page)
  app.patch("/api/user/profile", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { updateUserProfileSchema } = await import("@shared/schema");
      
      // Validate request body
      const validation = updateUserProfileSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid profile data",
          errors: validation.error.errors,
        });
      }
      
      const { fullName, skills } = validation.data;
      
      // IDOR Protection: Users can ONLY update their own profile
      const userId = req.user!.id;
      
      // Build update object with only provided fields
      const updateData: { fullName?: string; skills?: string[] } = {};
      if (fullName !== undefined) {
        updateData.fullName = fullName;
      }
      if (skills !== undefined) {
        updateData.skills = skills;
      }
      
      // Update profile in database
      const updatedProfile = await storage.updateUserProfile(userId, updateData);
      
      if (!updatedProfile) {
        return res.status(404).json({ message: "Profile not found" });
      }
      
      res.json({
        message: "Profile updated successfully",
        profile: updatedProfile,
      });
    } catch (error: any) {
      console.error("Profile update error:", error);
      res.status(500).json({ message: error.message || "Failed to update profile" });
    }
  });

  // Get current user's profile (for settings page)
  app.get("/api/user/profile", requireAuth, async (req: AuthRequest, res) => {
    try {
      const profile = await storage.getProfileByUserId(req.user!.id);
      
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }
      
      res.json(profile);
    } catch (error: any) {
      console.error("Profile fetch error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch profile" });
    }
  });

  // Public Form Routes (no authentication required)
  
  // Get form metadata for embedding (publicId lookup)
  app.get("/api/public/forms/:publicId", async (req, res) => {
    try {
      const { publicId } = req.params;
      
      const form = await storage.getFormByPublicId(publicId);
      if (!form) {
        return res.status(404).json({ message: "Form not found" });
      }
      
      const fields = await storage.getFormFieldsByFormId(form.id);
      
      res.json({
        name: form.name,
        description: form.description,
        fields: fields.map(f => ({
          id: f.id,
          label: f.label,
          fieldType: f.fieldType,
          placeholder: f.placeholder,
          required: f.required,
          sortOrder: f.sortOrder,
        })),
      });
    } catch (error: any) {
      console.error("Form metadata fetch error:", error);
      res.status(500).json({ message: "Failed to fetch form metadata" });
    }
  });

  // Submit form (public endpoint with rate limiting and honeypot)
  app.post("/api/public/forms/:publicId/submit", async (req, res) => {
    try {
      const { publicId } = req.params;
      const { formData, honeypot } = req.body;
      
      // Honeypot validation (if honeypot field is filled, it's a bot)
      if (honeypot && honeypot.trim() !== "") {
        console.log("Honeypot triggered - potential bot submission blocked");
        // Return success to avoid revealing the honeypot to bots
        return res.status(200).json({ message: "Form submitted successfully" });
      }
      
      // Get form
      const form = await storage.getFormByPublicId(publicId);
      if (!form) {
        return res.status(404).json({ message: "Form not found" });
      }
      
      // Get form fields for validation
      const fields = await storage.getFormFieldsByFormId(form.id);
      
      // Validate required fields
      for (const field of fields) {
        if (field.required && (!formData[field.id] || formData[field.id].trim() === "")) {
          return res.status(400).json({ 
            message: `Field "${field.label}" is required`,
            field: field.id,
          });
        }
      }
      
      // Create form submission
      const submission = await storage.createFormSubmission({
        formId: form.id,
        agencyId: form.agencyId,
        submission: formData,
      });
      
      // Auto-create Contact and Deal from submission
      // Extract common fields (email, name, phone) based on field types and labels
      let email: string | null = null;
      let firstName: string | null = null;
      let lastName: string | null = null;
      let phone: string | null = null;
      
      for (const field of fields) {
        const value = formData[field.id];
        if (!value || typeof value !== 'string' || value.trim() === '') continue;
        
        const trimmedValue = value.trim();
        const labelLower = field.label.toLowerCase();
        
        // Email field type takes precedence
        if (field.fieldType === "email" && !email) {
          email = trimmedValue;
        }
        // Phone field type takes precedence
        else if (field.fieldType === "phone" && !phone) {
          phone = trimmedValue;
        }
        // Parse name fields by label patterns
        else if ((labelLower.includes("first name") || labelLower === "name" || labelLower === "first") && !firstName) {
          firstName = trimmedValue;
        }
        else if ((labelLower.includes("last name") || labelLower === "last" || labelLower === "surname") && !lastName) {
          lastName = trimmedValue;
        }
        // If label is just "name" or "full name", try to split it
        else if ((labelLower === "full name" || labelLower === "your name") && !firstName) {
          const nameParts = trimmedValue.split(' ');
          if (nameParts.length >= 2) {
            firstName = nameParts[0];
            lastName = nameParts.slice(1).join(' ');
          } else {
            firstName = trimmedValue;
          }
        }
      }
      
      // Only create contact if we have BOTH valid email AND explicit name
      // Never fabricate or derive placeholder data
      const hasValidEmail = email && email.includes('@') && email.includes('.') && !email.includes('placeholder.com');
      const hasExplicitName = firstName && firstName.trim().length > 0 && firstName !== "Unknown";
      
      // Require BOTH email and name for contact creation
      if (hasValidEmail && hasExplicitName) {
        try {
          // TypeScript knows firstName and email are not null here because of hasExplicitName and hasValidEmail checks
          const contact = await storage.createContact({
            agencyId: form.agencyId,
            firstName: firstName!.trim(),
            lastName: (lastName && lastName.trim().length > 0) ? lastName.trim() : firstName!.trim(),
            email: email!.trim(),
            phone: phone ? phone.trim() : null,
            companyId: null,
            clientId: null,
          });
          
          // Create deal associated with the contact
          await storage.createDeal({
            agencyId: form.agencyId,
            contactId: contact.id,
            companyId: null,
            name: `Lead from ${form.name}`,
            value: 0, // Default to 0, agency can update later
            stage: "lead",
            closeDate: null,
          });
          
          console.log(`[Form Submission] Created contact (${contact.email}) and deal from form: ${form.name}`);
        } catch (error: any) {
          console.error("[Form Submission] Failed to auto-create contact/deal:", error);
          // Check if it's a duplicate email error
          if (error.message && (error.message.includes('unique') || error.message.includes('duplicate'))) {
            console.log('[Form Submission] Contact with this email already exists - skipping creation');
          }
          // Don't fail the submission if contact/deal creation fails
        }
      } else {
        // Log the specific reason for skipping
        if (!hasValidEmail && !hasExplicitName) {
          console.log('[Form Submission] Skipping contact/deal creation - no valid email or name provided');
        } else if (!hasValidEmail) {
          console.log('[Form Submission] Skipping contact/deal creation - no valid email provided');
        } else if (!hasExplicitName) {
          console.log('[Form Submission] Skipping contact/deal creation - no explicit name provided');
        }
      }
      
      res.status(201).json({ 
        message: "Form submitted successfully",
        submissionId: submission.id,
      });
    } catch (error: any) {
      console.error("Form submission error:", error);
      res.status(500).json({ message: "Form submission failed" });
    }
  });

  // Client Portal Routes (protected)
  
  // Get client profile/company info for the logged-in client
  app.get("/api/client/profile", requireAuth, requireRole("Client"), async (req: AuthRequest, res) => {
    try {
      const profile = await storage.getProfileByUserId(req.user!.id);
      const client = await storage.getClientByProfileId(profile!.id);
      
      if (!client) {
        return res.status(404).json({ message: "Client record not found" });
      }

      res.json({
        id: client.id,
        companyName: client.companyName,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/client/projects", requireAuth, requireRole("Client", "Admin"), async (req: AuthRequest, res) => {
    try {
      if (req.user!.role === "Admin") {
        // Admins see all projects in their agency
        if (!req.user!.agencyId) {
          return res.status(403).json({ message: "Agency association required" });
        }
        const allProjects = await storage.getAllProjects(req.user!.agencyId);
        const projectsWithClients = await Promise.all(
          allProjects.map(async (project) => {
            const client = await storage.getClientById(project.clientId);
            return { ...project, client };
          })
        );
        return res.json(projectsWithClients);
      }

      // Clients see only their own projects
      const profile = await storage.getProfileById(req.user!.id); // req.user.id IS the profile ID
      const client = await storage.getClientByProfileId(profile!.id);
      
      if (!client) {
        return res.json([]);
      }

      const projects = await storage.getProjectsByClientId(client.id);
      const projectsWithClient = projects.map(p => ({ ...p, client }));
      res.json(projectsWithClient);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get recent tasks for client dashboard "What's Happening Now" widget
  app.get("/api/client/tasks/recent", requireAuth, requireRole("Client"), async (req: AuthRequest, res) => {
    try {
      const profile = await storage.getProfileByUserId(req.user!.id);
      const client = await storage.getClientByProfileId(profile!.id);
      
      if (!client) {
        return res.json([]);
      }

      // Get all projects for this client
      const projects = await storage.getProjectsByClientId(client.id);
      
      if (projects.length === 0) {
        return res.json([]);
      }

      // Get all tasks for these projects
      const allTasks = await Promise.all(
        projects.map(async (project) => {
          const projectWithTasks = await storage.getProjectWithTasks(project.id);
          return (projectWithTasks?.tasks || []).map(task => ({
            ...task,
            project: {
              id: project.id,
              name: project.name
            }
          }));
        })
      );

      // Flatten and sort by createdAt
      const tasks = allTasks.flat().sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Return most recent 5 tasks
      res.json(tasks.slice(0, 5));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get client projects with tasks for progress tracking
  app.get("/api/client/projects-with-tasks", requireAuth, requireRole("Client"), async (req: AuthRequest, res) => {
    try {
      const profile = await storage.getProfileByUserId(req.user!.id);
      const client = await storage.getClientByProfileId(profile!.id);
      
      if (!client) {
        return res.json([]);
      }

      // Get all projects for this client
      const projects = await storage.getProjectsByClientId(client.id);
      
      // Get tasks for each project
      const projectsWithTasks = await Promise.all(
        projects.map(async (project) => {
          const projectData = await storage.getProjectWithTasks(project.id);
          return {
            ...project,
            tasks: projectData?.tasks || [],
            taskStats: {
              total: projectData?.tasks.length || 0,
              completed: projectData?.tasks.filter(t => t.status === "Completed").length || 0,
              inProgress: projectData?.tasks.filter(t => t.status === "In Progress").length || 0,
              pending: projectData?.tasks.filter(t => t.status === "Pending").length || 0,
            }
          };
        })
      );

      res.json(projectsWithTasks);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/client/invoices", requireAuth, requireRole("Client", "Admin"), async (req: AuthRequest, res) => {
    try {
      if (req.user!.role === "Admin") {
        // Admins see all invoices in their agency
        if (!req.user!.agencyId) {
          return res.status(403).json({ message: "Agency association required" });
        }
        const allInvoices = await storage.getAllInvoices(req.user!.agencyId);
        const invoicesWithClients = await Promise.all(
          allInvoices.map(async (invoice) => {
            const client = await storage.getClientById(invoice.clientId);
            return { ...invoice, client };
          })
        );
        return res.json(invoicesWithClients);
      }

      // Clients see only their own invoices
      const profile = await storage.getProfileById(req.user!.id); // req.user.id IS the profile ID
      const client = await storage.getClientByProfileId(profile!.id);
      
      if (!client) {
        return res.json([]);
      }

      const invoices = await storage.getInvoicesByClientId(client.id);
      const invoicesWithClient = invoices.map(i => ({ ...i, client }));
      res.json(invoicesWithClient);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/client/initiatives", requireAuth, requireRole("Client", "Admin"), async (req: AuthRequest, res) => {
    try {
      if (req.user!.role === "Admin") {
        // Admins see all initiatives in their agency
        if (!req.user!.agencyId) {
          return res.status(403).json({ message: "Agency association required" });
        }
        const allInitiatives = await storage.getAllInitiatives(req.user!.agencyId);
        const initsWithClients = await Promise.all(
          allInitiatives.map(async (init) => {
            const client = await storage.getClientById(init.clientId);
            return { ...init, client };
          })
        );
        return res.json(initsWithClients);
      }

      // Clients see only their own initiatives
      const profile = await storage.getProfileById(req.user!.id); // req.user.id IS the profile ID
      const client = await storage.getClientByProfileId(profile!.id);
      
      if (!client) {
        return res.json([]);
      }

      const initiatives = await storage.getInitiativesByClientId(client.id);
      const initsWithClient = initiatives.map(i => ({ ...i, client }));
      res.json(initsWithClient);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Agency Portal Routes (protected - Admin only)
  app.get("/api/agency/clients", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const { agencyId } = resolveAgencyContext(req, { allowQueryParam: true });
      const clients = await storage.getAllClientsWithDetails(agencyId);
      res.json(clients);
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ message: error.message });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/agency/clients/:clientId", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const client = await storage.getClientById(clientId);
      
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      res.json(client);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/agency/clients/:clientId", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const { leadValue, retainerAmount, billingDay, monthlyRetainerHours } = req.body;
      
      const client = await storage.getClientById(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      const updates: any = {};
      if (leadValue !== undefined) updates.leadValue = leadValue;
      if (retainerAmount !== undefined) updates.retainerAmount = retainerAmount;
      if (billingDay !== undefined) updates.billingDay = billingDay;
      if (monthlyRetainerHours !== undefined) updates.monthlyRetainerHours = monthlyRetainerHours;
      
      const updatedClient = await storage.updateClient(clientId, updates);
      res.json(updatedClient);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/agency/clients/:clientId/retainer-hours", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const hoursInfo = await storage.checkRetainerHours(clientId);
      res.json(hoursInfo);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/agency/clients/:clientId/reset-retainer-hours", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const updatedClient = await storage.resetRetainerHours(clientId);
      res.json(updatedClient);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/agency/clients/:clientId/sync-metrics", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const { daysToFetch = 30 } = req.body;

      // Get client data to access leadEvents
      const client = await storage.getClientById(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // Get GA4 integration
      let ga4Integration = await storage.getIntegrationByClientId(clientId, 'GA4');
      // Get GSC integration
      let gscIntegration = await storage.getIntegrationByClientId(clientId, 'GSC');

      if (!ga4Integration && !gscIntegration) {
        return res.status(400).json({ message: "No analytics integrations connected" });
      }

      const end = new Date().toISOString().split('T')[0];
      const start = new Date(Date.now() - daysToFetch * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      // Delete existing metrics for this client in the date range to ensure idempotency
      await storage.deleteMetricsByClientIdAndDateRange(clientId, start, end);
      
      let metricsCreated = 0;

      // Fetch and store GA4 data
      if (ga4Integration && ga4Integration.ga4PropertyId && ga4Integration.accessToken) {
        const { fetchGA4Data, fetchGA4KeyEvents } = await import("./lib/googleOAuth");
        const ga4Data = await fetchGA4Data(ga4Integration.accessToken, ga4Integration.ga4PropertyId, start, end, clientId);
        
        // Fetch conversions data if lead events are configured
        let conversionsData: { rows?: Array<{ dimensionValues?: Array<{ value?: string | null }>, metricValues?: Array<{ value?: string | null }> }> } = { rows: [] };
        if (client.leadEvents && client.leadEvents.length > 0) {
          try {
            // Join lead events array into comma-separated string (trim to avoid GA4 mismatches)
            const leadEventsString = client.leadEvents.map(e => e.trim()).join(', ');
            conversionsData = await fetchGA4KeyEvents(
              ga4Integration.accessToken,
              ga4Integration.ga4PropertyId,
              leadEventsString,
              start,
              end,
              clientId
            );
          } catch (error) {
            console.error("Error fetching GA4 Key Events during sync:", error);
          }
        }
        
        // Create a map of date -> conversions for quick lookup
        const conversionsMap = new Map<string, number>();
        for (const row of conversionsData.rows || []) {
          const dateValue = row.dimensionValues?.[0]?.value;
          const conversions = parseInt(row.metricValues?.[0]?.value || '0');
          if (dateValue) {
            conversionsMap.set(dateValue, conversions);
          }
        }
        
        // Store GA4 metrics with conversions
        for (const row of ga4Data.rows || []) {
          const dateValue = row.dimensionValues?.[0]?.value;
          const sessions = parseInt(row.metricValues?.[0]?.value || '0');
          
          if (dateValue) {
            await storage.createMetric({
              date: dateValue,
              clientId: clientId,
              source: 'GA4',
              sessions: sessions,
              conversions: conversionsMap.get(dateValue) || 0,
              clicks: 0,
              impressions: 0,
              spend: '0'
            });
            metricsCreated++;
          }
        }
      }

      // Fetch and store GSC data
      if (gscIntegration && gscIntegration.gscSiteUrl && gscIntegration.accessToken) {
        const { fetchGSCData } = await import("./lib/googleOAuth");
        const gscData = await fetchGSCData(gscIntegration.accessToken, gscIntegration.gscSiteUrl, start, end, clientId);
        
        // Store GSC metrics
        for (const row of gscData.rows || []) {
          const dateValue = row.keys?.[0];
          const clicks = row.clicks || 0;
          const impressions = row.impressions || 0;
          const position = row.position || 0;
          
          if (dateValue) {
            await storage.createMetric({
              date: dateValue,
              clientId: clientId,
              source: 'GSC',
              organicClicks: clicks,
              organicImpressions: impressions,
              avgPosition: position.toString()
            });
            metricsCreated++;
          }
        }
      }

      res.json({
        success: true,
        message: `Successfully synced ${metricsCreated} metrics for the last ${daysToFetch} days`,
        metricsCreated
      });
    } catch (error: any) {
      console.error("Sync metrics error:", error);
      res.status(500).json({ message: error.message || "Failed to sync metrics" });
    }
  });

  // Get connection status for a client's integrations
  app.get("/api/clients/:clientId/connection-status", requireAuth, requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      
      // Get GA4 integration (with error handling for decryption issues)
      let ga4Integration;
      try {
        ga4Integration = await storage.getIntegrationByClientId(clientId, 'GA4');
      } catch (error) {
        if (error instanceof Error && error.message.includes('Decryption failed')) {
          console.error('GA4 integration decryption failed - likely encryption key mismatch:', error.message);
          ga4Integration = undefined;
        } else {
          throw error;
        }
      }
      
      // Get GSC integration (with error handling for decryption issues)
      let gscIntegration;
      try {
        gscIntegration = await storage.getIntegrationByClientId(clientId, 'GSC');
      } catch (error) {
        if (error instanceof Error && error.message.includes('Decryption failed')) {
          console.error('GSC integration decryption failed - likely encryption key mismatch:', error.message);
          gscIntegration = undefined;
        } else {
          throw error;
        }
      }
      
      // Check DataForSEO - either client-level or agency-level with access
      let clientIntegrations: any[] = [];
      try {
        clientIntegrations = await storage.getAllIntegrationsByClientId(clientId);
      } catch (error) {
        if (error instanceof Error && error.message.includes('Decryption failed')) {
          console.error('Client integrations decryption failed - likely encryption key mismatch:', error.message);
          clientIntegrations = [];
        } else {
          throw error;
        }
      }
      const dataForSeoClientIntegration = clientIntegrations.find((i: any) => i.serviceName === 'DataForSEO');
      
      // Check agency-level DataForSEO integration
      let dataForSeoConnected = false;
      let dataForSeoSource: 'client' | 'agency' | undefined;
      
      if (dataForSeoClientIntegration) {
        // Integration row exists for this client
        dataForSeoConnected = true;
        dataForSeoSource = 'client';
      } else if (req.user?.agencyId) {
        // Check for agency-level integration
        const agencyIntegration = await storage.getAgencyIntegration(req.user?.agencyId, 'DataForSEO');
        if (agencyIntegration) {
          // Check if client has access to agency integration
          const hasAccess = await storage.hasClientAccess(agencyIntegration.id, clientId);
          if (hasAccess) {
            dataForSeoConnected = true;
            dataForSeoSource = 'agency';
          }
        }
      }
      
      res.json({
        ga4: {
          connected: !!ga4Integration?.accessToken,
          lastSync: ga4Integration?.updatedAt ? new Date(ga4Integration.updatedAt).toLocaleString() : undefined
        },
        gsc: {
          connected: !!gscIntegration?.accessToken,
          lastSync: gscIntegration?.updatedAt ? new Date(gscIntegration.updatedAt).toLocaleString() : undefined
        },
        dataForSEO: {
          connected: dataForSeoConnected,
          source: dataForSeoSource
        }
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/agency/clients/:clientId/generate-recommendations", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      
      // Validate request body
      const generateRecommendationsSchema = z.object({
        preset: z.enum(["quick-wins", "strategic-growth", "full-audit"]),
        includeCompetitors: z.boolean().default(false),
        competitorDomains: z.array(z.string()).max(5).optional()
      });
      
      const validatedData = generateRecommendationsSchema.parse(req.body);
      const { generateAIRecommendations } = await import("./ai-analyzer");
      
      // Call AI analyzer with preset and competitor configuration
      const result = await generateAIRecommendations(storage, clientId, {
        preset: validatedData.preset,
        includeCompetitors: validatedData.includeCompetitors,
        competitorDomains: validatedData.competitorDomains
      });
      
      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }
      
      res.json({ 
        success: true, 
        message: `Successfully generated ${result.recommendationsCreated} AI-powered recommendations`,
        count: result.recommendationsCreated 
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/agency/projects", requireAuth, requireRole("Admin", "Staff"), async (req: AuthRequest, res) => {
    try {
      // SuperAdmin users can view all projects across all agencies
      if (req.user!.isSuperAdmin) {
        const allProjects = await storage.getAllProjects();
        return res.json(allProjects);
      }

      // Regular Admin/Staff users need an agency association
      if (!req.user!.agencyId) {
        return res.status(403).json({ message: "Agency association required" });
      }
      const projects = await storage.getAllProjects(req.user!.agencyId);
      res.json(projects);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create new project
  app.post("/api/agency/projects", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      // Validate request body with Zod schema
      const projectData = insertProjectSchema.parse(req.body);
      
      const newProject = await storage.createProject(projectData);

      res.status(201).json(newProject);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Get task lists for a project
  app.get("/api/agency/projects/:projectId/lists", requireAuth, requireRole("Admin", "Staff", "SuperAdmin"), requireProjectAccess(storage), async (req: AuthRequest, res) => {
    try {
      console.log("[GET_TASK_LISTS] ProjectId:", req.params.projectId, "AgencyId:", req.user!.agencyId);
      const taskLists = await storage.getTaskListsByProjectId(req.params.projectId, req.user!.agencyId);
      console.log("[GET_TASK_LISTS] Success, returned", taskLists.length, "lists");
      res.json(taskLists);
    } catch (error: any) {
      console.error("[GET_TASK_LISTS_ERROR] ProjectId:", req.params.projectId, "Error:", error.message, "Stack:", error.stack);
      res.status(500).json({ message: error.message });
    }
  });

  // Create new task list
  app.post("/api/agency/task-lists", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      // Require projectId in request body
      if (!req.body.projectId) {
        return res.status(400).json({ message: "projectId is required" });
      }

      // Fetch project with agency to determine agencyId
      const projectWithAgency = await storage.getProjectWithAgency(req.body.projectId);
      if (!projectWithAgency) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Determine agencyId based on user role
      let agencyId: string;
      
      if (req.user!.isSuperAdmin) {
        // SuperAdmin: use the project's agencyId
        agencyId = projectWithAgency.agencyId;
      } else {
        // Regular Admin: verify project belongs to user's agency
        if (!req.user!.agencyId) {
          return res.status(403).json({ message: "Agency association required" });
        }
        
        if (projectWithAgency.agencyId !== req.user!.agencyId) {
          return res.status(403).json({ message: "Cannot create task list for another agency's project" });
        }
        
        agencyId = req.user!.agencyId;
      }

      // Reject any agencyId spoofing attempts in request body
      if (req.body.agencyId && req.body.agencyId !== agencyId) {
        return res.status(403).json({ message: "Cannot specify different agencyId" });
      }

      const { insertTaskListSchema } = await import("@shared/schema");
      const taskListData = insertTaskListSchema.parse({
        ...req.body,
        agencyId // Force agencyId from derived value
      });

      const newTaskList = await storage.createTaskList(taskListData);
      res.status(201).json(newTaskList);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Update task list
  app.patch("/api/agency/task-lists/:id", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      // SuperAdmin can update any task list; Regular Admin needs agencyId
      let agencyId: string | undefined;
      if (req.user!.isSuperAdmin) {
        agencyId = undefined; // SuperAdmin: no tenant restriction
      } else {
        if (!req.user!.agencyId) {
          return res.status(403).json({ message: "Agency association required" });
        }
        agencyId = req.user!.agencyId;
      }

      const { insertTaskListSchema } = await import("@shared/schema");
      const updateData = insertTaskListSchema.partial().parse(req.body);
      const updatedTaskList = await storage.updateTaskList(req.params.id, updateData, agencyId);

      res.json(updatedTaskList);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      // Map storage errors to proper HTTP codes (not found vs access denied)
      if (error.message?.includes('not found or access denied')) {
        return res.status(404).json({ message: "Task list not found" });
      }
      res.status(500).json({ message: "Failed to update task list" });
    }
  });

  // Delete task list
  app.delete("/api/agency/task-lists/:id", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      // SuperAdmin can delete any task list; Regular Admin needs agencyId
      let agencyId: string | undefined;
      if (req.user!.isSuperAdmin) {
        agencyId = undefined; // SuperAdmin: no tenant restriction
      } else {
        if (!req.user!.agencyId) {
          return res.status(403).json({ message: "Agency association required" });
        }
        agencyId = req.user!.agencyId;
      }

      await storage.deleteTaskList(req.params.id, agencyId);
      res.status(204).send();
    } catch (error: any) {
      // Map storage errors to proper HTTP codes
      if (error.message?.includes('not found or access denied')) {
        return res.status(404).json({ message: "Task list not found" });
      }
      res.status(500).json({ message: "Failed to delete task list" });
    }
  });

  // Get tasks for a task list
  app.get("/api/agency/task-lists/:listId/tasks", requireAuth, requireRole("Admin", "Staff", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      const tasks = await storage.getTasksByListId(req.params.listId);
      res.json(tasks);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get subtasks by parent task ID
  app.get("/api/agency/tasks/:taskId/subtasks", requireAuth, requireRole("Admin", "Staff", "SuperAdmin"), requireTaskAccess(storage), async (req: AuthRequest, res) => {
    try {
      const subtasks = await storage.getSubtasksByParentId(req.params.taskId);
      res.json(subtasks);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get task activities (timeline)
  app.get("/api/agency/tasks/:taskId/activities", requireAuth, requireRole("Admin", "Staff", "Client", "SuperAdmin"), requireTaskAccess(storage), async (req: AuthRequest, res) => {
    try {
      const activities = await storage.getTaskActivities(req.params.taskId);
      res.json(activities);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get all tasks for agency (used by hours report)
  app.get("/api/agency/tasks", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      let agencyId: string | undefined;
      if (req.user!.isSuperAdmin) {
        agencyId = undefined; // SuperAdmin: fetch all tasks across agencies
      } else {
        if (!req.user!.agencyId) {
          return res.status(403).json({ message: "Agency association required" });
        }
        agencyId = req.user!.agencyId;
      }

      const tasks = await storage.getAllTasks(agencyId);
      
      // Include project info with each task
      const tasksWithProject = await Promise.all(
        tasks.map(async (task) => {
          const project = task.projectId ? await storage.getProjectById(task.projectId) : null;
          return { ...task, project };
        })
      );
      
      res.json(tasksWithProject);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get all staff assignments for agency (used by hours report)
  app.get("/api/agency/staff-assignments", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      let agencyId: string | undefined;
      if (req.user!.isSuperAdmin) {
        agencyId = undefined;
      } else {
        if (!req.user!.agencyId) {
          return res.status(403).json({ message: "Agency association required" });
        }
        agencyId = req.user!.agencyId;
      }

      const assignments = await storage.getAllTaskAssignments(agencyId);
      res.json(assignments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create new task
  app.post("/api/agency/tasks", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      // Validate request body with Zod schema
      const taskData = insertTaskSchema.parse(req.body);
      
      const newTask = await storage.createTask(taskData);

      res.status(201).json(newTask);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Get project with tasks
  app.get("/api/agency/projects/:id", requireAuth, requireRole("Admin", "Staff"), requireProjectAccess(storage), async (req: AuthRequest, res) => {
    try {
      const projectData = await storage.getProjectWithTasks(req.params.id);
      
      if (!projectData) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Log first task to debug time tracking fields
      if (projectData.tasks && projectData.tasks.length > 0) {
        const firstTask = projectData.tasks[0];
        console.log('[GET /api/agency/projects/:id] First task data:', JSON.stringify({
          id: firstTask.id,
          timeEstimate: firstTask.timeEstimate,
          timeTracked: firstTask.timeTracked,
          hasTimeEstimate: 'timeEstimate' in firstTask,
          hasTimeTracked: 'timeTracked' in firstTask,
          allKeys: Object.keys(firstTask)
        }, null, 2));
      }

      res.json(projectData);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update project
  app.patch("/api/agency/projects/:id", requireAuth, requireRole("Admin"), requireProjectAccess(storage), async (req: AuthRequest, res) => {
    try {
      const updateData = insertProjectSchema.partial().parse(req.body);
      const updatedProject = await storage.updateProject(req.params.id, updateData);

      res.json(updatedProject);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Update task
  app.patch("/api/agency/tasks/:id", requireAuth, requireRole("Admin", "SuperAdmin"), requireTaskAccess(storage), async (req: AuthRequest, res) => {
    try {
      // Validate time tracking increments (must be 0.5 hour increments)
      if (req.body.timeTracked !== undefined && req.body.timeTracked !== null) {
        const tracked = Number(req.body.timeTracked);
        if (!Number.isFinite(tracked) || tracked < 0 || (tracked * 2) % 1 !== 0) {
          return res.status(400).json({ 
            message: "Time tracked must be a non-negative number in 0.5 hour increments (0, 0.5, 1, 1.5, etc.)" 
          });
        }
      }
      
      if (req.body.timeEstimate !== undefined && req.body.timeEstimate !== null) {
        const estimate = Number(req.body.timeEstimate);
        if (!Number.isFinite(estimate) || estimate < 0 || (estimate * 2) % 1 !== 0) {
          return res.status(400).json({ 
            message: "Time estimate must be a non-negative number in 0.5 hour increments (0, 0.5, 1, 1.5, etc.)" 
          });
        }
      }
      
      const updateData = updateTaskSchema.parse(req.body);
      
      // Convert numeric time values to strings for database storage
      const storageData: Partial<Task> = {
        ...updateData,
        timeEstimate: updateData.timeEstimate !== undefined && updateData.timeEstimate !== null 
          ? String(updateData.timeEstimate) 
          : updateData.timeEstimate as string | null | undefined,
        timeTracked: updateData.timeTracked !== undefined && updateData.timeTracked !== null 
          ? String(updateData.timeTracked) 
          : updateData.timeTracked as string | null | undefined,
      };
      
      const updatedTask = await storage.updateTask(req.params.id, storageData);

      res.json(updatedTask);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Delete task
  app.delete("/api/agency/tasks/:id", requireAuth, requireRole("Admin", "SuperAdmin"), requireTaskAccess(storage), async (req: AuthRequest, res) => {
    try {
      await storage.deleteTask(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Assign staff to task
  app.post("/api/agency/tasks/:taskId/assign", requireAuth, requireRole("Admin", "SuperAdmin"), requireTaskAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { staffProfileId } = req.body;
      
      if (!staffProfileId) {
        return res.status(400).json({ message: "Staff profile ID is required" });
      }

      // Get staff profile for activity log
      const staffProfile = await storage.getStaffProfileById(staffProfileId);
      if (!staffProfile) {
        return res.status(404).json({ message: "Staff profile not found" });
      }

      const assignment = await storage.createStaffAssignment({
        taskId: req.params.taskId,
        staffProfileId,
      });

      // Log assignee addition
      try {
        await storage.createTaskActivity({
          taskId: req.params.taskId,
          userId: req.user!.id,
          action: 'assignee_added',
          fieldName: 'assignees',
          newValue: staffProfile.fullName
        });
      } catch (error) {
        console.error('Failed to log assignee addition:', error);
      }

      res.status(201).json(assignment);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Remove staff assignment
  app.delete("/api/agency/tasks/:taskId/assign/:staffProfileId", requireAuth, requireRole("Admin", "SuperAdmin"), requireTaskAccess(storage), async (req: AuthRequest, res) => {
    try {
      // Get staff profile for activity log before deletion
      const staffProfile = await storage.getStaffProfileById(req.params.staffProfileId);
      
      await storage.deleteStaffAssignment(req.params.taskId, req.params.staffProfileId);

      // Log assignee removal
      if (staffProfile) {
        try {
          await storage.createTaskActivity({
            taskId: req.params.taskId,
            userId: req.user!.id,
            action: 'assignee_removed',
            fieldName: 'assignees',
            oldValue: staffProfile.fullName
          });
        } catch (error) {
          console.error('Failed to log assignee removal:', error);
        }
      }

      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/agency/metrics", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      if (!req.user!.agencyId) {
        return res.status(403).json({ message: "Agency association required" });
      }
      const metrics = await storage.getAllMetrics(90, req.user!.agencyId);
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/agency/clients/:clientId/metrics", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const metrics = await storage.getMetricsByClientId(clientId, 90);
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/agency/clients/:clientId/strategy-card", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;

      // 1. Fetch all raw data in parallel
      const [client, objectives, metrics, messages] = await Promise.all([
        storage.getClientById(clientId),
        storage.getActiveObjectivesByClientId(clientId),
        storage.getMetricsByClientId(clientId, 30),
        storage.getMessagesByClientId(clientId),
      ]);

      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // 2. Process Analytical Data
      const summaryKpis = {
        totalSessions: metrics.reduce((sum, m) => sum + (m.sessions || 0), 0),
        totalConversions: metrics.reduce((sum, m) => sum + (m.conversions || 0), 0),
        totalSpend: metrics.reduce((sum, m) => sum + parseFloat(m.spend || "0"), 0),
      };

      // 3. Process Chat History with AI
      // Take last 30 messages (or all if less than 30) to capture more conversation history
      const recentMessages = messages.slice(-30);
      const chatHistoryText = recentMessages.length > 0
        ? recentMessages.map(msg => `${msg.senderRole}: ${msg.message}`).join('\n')
        : "No recent conversations.";
      
      const aiProvider = await getAIProvider(client.agencyId);
      const chatAnalysis = await aiProvider.analyzeChatHistory(chatHistoryText);

      // 4. Assemble the final data card object
      const strategyCardData = {
        businessContext: client.businessContext,
        clientObjectives: objectives,
        summaryKpis,
        chatAnalysis,
      };

      res.json(strategyCardData);
    } catch (error: any) {
      console.error("Strategy Card endpoint error:", error);
      res.status(500).json({ message: error.message || "Failed to generate strategy card data" });
    }
  });

  app.get("/api/agency/initiatives", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      if (!req.user!.agencyId) {
        return res.status(403).json({ message: "Agency association required" });
      }
      const initiatives = await storage.getAllInitiatives(req.user!.agencyId);
      res.json(initiatives);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/agency/integrations", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      if (!req.user!.agencyId) {
        return res.status(403).json({ message: "Agency association required" });
      }
      const integrations = await storage.getAllIntegrations(req.user!.agencyId);
      // Only return safe metadata - no tokens (already filtered in storage)
      const safeIntegrations = integrations.map(({ accessToken, refreshToken, accessTokenIv, refreshTokenIv, accessTokenAuthTag, refreshTokenAuthTag, ...safe }) => safe);
      res.json(safeIntegrations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get agency settings (AI provider configuration)
  app.get("/api/agency/settings", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      // SuperAdmins: return global environment default (they manage platform-wide settings)
      if (req.user!.isSuperAdmin && !req.user!.agencyId) {
        return res.json({
          aiProvider: (process.env.AI_PROVIDER?.toLowerCase() || "gemini"),
          isDefault: true,
          isSuperAdminGlobal: true,
        });
      }

      // Regular Admins: require agency association
      if (!req.user!.agencyId) {
        return res.status(403).json({ message: "Agency association required" });
      }

      // Query agency settings
      const settings = await db
        .select()
        .from(agencySettings)
        .where(eq(agencySettings.agencyId, req.user!.agencyId))
        .limit(1);

      if (settings.length === 0) {
        // Return default settings if not found (normalize to lowercase)
        return res.json({
          aiProvider: (process.env.AI_PROVIDER?.toLowerCase() || "gemini"),
          isDefault: true,
        });
      }

      res.json({
        aiProvider: settings[0].aiProvider.toLowerCase(),
        isDefault: false,
      });
    } catch (error: any) {
      console.error("Error fetching agency settings:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update agency settings (AI provider configuration)
  app.put("/api/agency/settings", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      // Validate request body
      const validationResult = updateAgencySettingSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid settings data",
          errors: validationResult.error.errors,
        });
      }

      const { aiProvider } = validationResult.data;

      // SuperAdmins without agency: inform them they're viewing global defaults
      // (In practice, they would need to modify environment variables directly)
      if (req.user!.isSuperAdmin && !req.user!.agencyId) {
        return res.json({
          aiProvider: aiProvider,
          isDefault: true,
          isSuperAdminGlobal: true,
          message: "SuperAdmins can view AI provider preferences, but changing the global default requires updating the AI_PROVIDER environment variable. To change settings for a specific agency, please log in as an Admin of that agency."
        });
      }

      // Regular Admins: require agency association
      if (!req.user!.agencyId) {
        return res.status(403).json({ message: "Agency association required" });
      }

      // Check if settings already exist for this agency
      const existingSettings = await db
        .select()
        .from(agencySettings)
        .where(eq(agencySettings.agencyId, req.user!.agencyId))
        .limit(1);

      if (existingSettings.length === 0) {
        // Create new settings
        const [newSettings] = await db
          .insert(agencySettings)
          .values({
            agencyId: req.user!.agencyId,
            aiProvider,
          })
          .returning();

        // Invalidate AI provider cache for this agency
        invalidateAIProviderCache(req.user!.agencyId);

        res.json(newSettings);
      } else {
        // Update existing settings
        const [updatedSettings] = await db
          .update(agencySettings)
          .set({
            aiProvider,
            updatedAt: sql`now()`,
          })
          .where(eq(agencySettings.agencyId, req.user!.agencyId))
          .returning();

        // Invalidate AI provider cache for this agency
        invalidateAIProviderCache(req.user!.agencyId);

        res.json(updatedSettings);
      }
    } catch (error: any) {
      console.error("Error updating agency settings:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Upload agency branding logo
  app.post("/api/agency/settings/logo", requireAuth, requireRole("Admin"), logoUpload.single('logo'), async (req: AuthRequest, res) => {
    try {
      if (!req.user!.agencyId) {
        return res.status(403).json({ message: "Agency association required" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { type } = req.body;
      if (!type || !['agencyLogo', 'clientLogo', 'staffLogo'].includes(type)) {
        // Delete the uploaded file since type is invalid
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: "Invalid logo type. Must be agencyLogo, clientLogo, or staffLogo" });
      }

      // Create public URL for the logo
      const logoUrl = `/uploads/logos/${req.file.filename}`;

      // Check if settings already exist for this agency
      const existingSettings = await db
        .select()
        .from(agencySettings)
        .where(eq(agencySettings.agencyId, req.user!.agencyId))
        .limit(1);

      // Build update object with the specific logo field
      const updateData: Record<string, any> = {
        [type]: logoUrl,
        updatedAt: sql`now()`,
      };

      if (existingSettings.length === 0) {
        // Create new settings with the logo
        const [newSettings] = await db
          .insert(agencySettings)
          .values({
            agencyId: req.user!.agencyId,
            aiProvider: 'gemini',
            [type]: logoUrl,
          })
          .returning();

        res.json({
          message: "Logo uploaded successfully",
          logoUrl,
          settings: newSettings,
        });
      } else {
        // Delete old logo file if exists
        const oldLogoUrl = existingSettings[0][type as keyof typeof existingSettings[0]] as string | null;
        if (oldLogoUrl) {
          const oldLogoPath = path.join(process.cwd(), oldLogoUrl);
          if (fs.existsSync(oldLogoPath)) {
            fs.unlinkSync(oldLogoPath);
          }
        }

        // Update existing settings
        const [updatedSettings] = await db
          .update(agencySettings)
          .set(updateData)
          .where(eq(agencySettings.agencyId, req.user!.agencyId))
          .returning();

        res.json({
          message: "Logo uploaded successfully",
          logoUrl,
          settings: updatedSettings,
        });
      }
    } catch (error: any) {
      console.error("Error uploading logo:", error);
      // Clean up uploaded file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ message: error.message || "Failed to upload logo" });
    }
  });

  // Delete agency branding logo
  app.delete("/api/agency/settings/logo/:type", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      if (!req.user!.agencyId) {
        return res.status(403).json({ message: "Agency association required" });
      }

      const { type } = req.params;
      if (!['agencyLogo', 'clientLogo', 'staffLogo'].includes(type)) {
        return res.status(400).json({ message: "Invalid logo type. Must be agencyLogo, clientLogo, or staffLogo" });
      }

      // Get current settings
      const existingSettings = await db
        .select()
        .from(agencySettings)
        .where(eq(agencySettings.agencyId, req.user!.agencyId))
        .limit(1);

      if (existingSettings.length === 0) {
        return res.status(404).json({ message: "Agency settings not found" });
      }

      // Delete the logo file if exists
      const logoUrl = existingSettings[0][type as keyof typeof existingSettings[0]] as string | null;
      if (logoUrl) {
        const logoPath = path.join(process.cwd(), logoUrl);
        if (fs.existsSync(logoPath)) {
          fs.unlinkSync(logoPath);
        }
      }

      // Update settings to remove logo
      const [updatedSettings] = await db
        .update(agencySettings)
        .set({
          [type]: null,
          updatedAt: sql`now()`,
        })
        .where(eq(agencySettings.agencyId, req.user!.agencyId))
        .returning();

      res.json({
        message: "Logo removed successfully",
        settings: updatedSettings,
      });
    } catch (error: any) {
      console.error("Error deleting logo:", error);
      res.status(500).json({ message: error.message || "Failed to delete logo" });
    }
  });

  // Get branding settings (logos)
  app.get("/api/agency/settings/branding", requireAuth, async (req: AuthRequest, res) => {
    try {
      // Determine agency ID from user context
      let agencyId = req.user!.agencyId;
      
      // For Client users, get agency ID from client association
      if (!agencyId && req.user!.clientId) {
        const client = await storage.getClientById(req.user!.clientId);
        agencyId = client?.agencyId;
      }

      if (!agencyId) {
        return res.json({
          agencyLogo: null,
          clientLogo: null,
          staffLogo: null,
        });
      }

      const settings = await db
        .select({
          agencyLogo: agencySettings.agencyLogo,
          clientLogo: agencySettings.clientLogo,
          staffLogo: agencySettings.staffLogo,
        })
        .from(agencySettings)
        .where(eq(agencySettings.agencyId, agencyId))
        .limit(1);

      if (settings.length === 0) {
        return res.json({
          agencyLogo: null,
          clientLogo: null,
          staffLogo: null,
        });
      }

      res.json(settings[0]);
    } catch (error: any) {
      console.error("Error fetching branding settings:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get all staff members (for assignment dropdowns)
  app.get("/api/agency/staff", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      // SuperAdmin users can view all staff across all agencies
      if (req.user!.isSuperAdmin) {
        const staff = await storage.getAllStaff();
        const staffList = staff.map(s => ({ id: s.id, name: s.fullName }));
        return res.json(staffList);
      }

      // Regular Admin users need an agency association
      if (!req.user!.agencyId) {
        return res.status(403).json({ message: "Agency association required" });
      }
      const staff = await storage.getAllStaff(req.user!.agencyId);
      // Return staff with id and name for dropdown
      const staffList = staff.map(s => ({ id: s.id, name: s.fullName }));
      res.json(staffList);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Staff Portal Routes (protected - Staff only)
  app.get("/api/staff/tasks", requireAuth, requireRole("Staff", "Admin"), async (req: AuthRequest, res) => {
    try {
      if (!req.user!.agencyId) {
        return res.status(403).json({ message: "Agency association required" });
      }
      const allTasks = await storage.getAllTasks(req.user!.agencyId);
      const tasksWithProjects = await Promise.all(
        allTasks.map(async (task) => {
          const project = task.projectId ? await storage.getProjectById(task.projectId) : undefined;
          return { ...task, project };
        })
      );
      res.json(tasksWithProjects);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get tasks with full assignment details (for task detail dialog)
  // Staff users only get tasks they're assigned to
  app.get("/api/staff/tasks/full", requireAuth, requireRole("Staff", "Admin"), async (req: AuthRequest, res) => {
    try {
      if (!req.user!.agencyId) {
        return res.status(403).json({ message: "Agency association required" });
      }

      // Get user's profile
      const profile = await storage.getProfileByUserId(req.user!.id);
      if (!profile) {
        return res.status(403).json({ message: "Profile not found" });
      }

      // Get all tasks for the agency
      const allTasks = await storage.getAllTasks(req.user!.agencyId);
      
      // For Staff users, filter to only tasks they're assigned to
      // For Admin users, return all tasks
      const tasksToReturn = req.user!.role === "Staff" 
        ? await Promise.all(
            allTasks.map(async (task) => {
              const assignments = await storage.getAssignmentsByTaskId(task.id);
              // Only include this task if the staff member is assigned to it
              const isAssigned = assignments.some(a => a.staffProfileId === profile.id);
              return isAssigned ? task : null;
            })
          ).then(tasks => tasks.filter((t): t is typeof allTasks[number] => t !== null))
        : allTasks;

      // Add full assignment details to each task
      const tasksWithAssignments = await Promise.all(
        tasksToReturn.map(async (task) => {
          const assignments = await storage.getAssignmentsByTaskId(task.id);
          const assignmentsWithProfiles = await Promise.all(
            assignments.map(async (assignment) => {
              const assigneeProfile = await storage.getProfileById(assignment.staffProfileId);
              return { ...assignment, staffProfile: assigneeProfile };
            })
          );
          return { ...task, assignments: assignmentsWithProfiles };
        })
      );
      
      res.json(tasksWithAssignments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create subtask (Staff can create subtasks for tasks they're assigned to)
  app.post("/api/tasks/:taskId/subtasks", requireAuth, requireRole("Staff", "Admin", "SuperAdmin"), requireTaskAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { taskId } = req.params;
      
      // Get current user's profile
      const profile = await storage.getProfileById(req.user!.id);
      if (!profile) {
        return res.status(403).json({ message: "Profile not found" });
      }
      
      // For Staff users, verify they're assigned to the parent task
      if (req.user!.role === "Staff") {
        const assignments = await storage.getAssignmentsByTaskId(taskId);
        const isAssigned = assignments.some(a => a.staffProfileId === profile.id);
        
        if (!isAssigned) {
          return res.status(403).json({ message: "Not assigned to parent task" });
        }
      }

      // Get parent task to inherit projectId and listId
      const parentTask = await storage.getTaskById(taskId);
      if (!parentTask) {
        return res.status(404).json({ message: "Parent task not found" });
      }

      // Validate and create subtask
      const { insertTaskSchema } = await import("@shared/schema");
      const subtaskData = insertTaskSchema.parse({
        ...req.body,
        parentId: taskId,
        projectId: parentTask.projectId,
        listId: parentTask.listId,
      });
      
      const newSubtask = await storage.createTask(subtaskData);

      // Auto-assign the creating user to the subtask (so they can edit/toggle it)
      if (req.user!.role === "Staff" || req.user!.role === "Admin") {
        await storage.createStaffAssignment({
          taskId: newSubtask.id,
          staffProfileId: profile.id,
        });
      }

      // Log subtask creation activity on the parent task
      await storage.createTaskActivity({
        taskId: taskId,
        userId: req.user!.id,
        action: 'subtask_created',
        newValue: newSubtask.description
      });

      res.status(201).json(newSubtask);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Get task messages
  app.get("/api/tasks/:taskId/messages", requireAuth, requireRole("Staff", "Admin", "SuperAdmin"), requireTaskAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { taskId } = req.params;
      
      // Verify task exists
      const task = await storage.getTaskById(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      const messages = await storage.getTaskMessagesByTaskId(taskId);
      res.json(messages);
    } catch (error: any) {
      console.error("Get task messages error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch task messages" });
    }
  });

  // Create task message
  app.post("/api/tasks/:taskId/messages", requireAuth, requireRole("Staff", "Admin", "SuperAdmin"), requireTaskAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { taskId } = req.params;
      
      // Verify task exists
      const task = await storage.getTaskById(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Get current user's profile
      const profile = await storage.getProfileByUserId(req.user!.id);
      if (!profile) {
        return res.status(403).json({ message: "Profile not found" });
      }

      // Validate message data
      const { insertTaskMessageSchema } = await import("@shared/schema");
      const messageData = insertTaskMessageSchema.parse({
        ...req.body,
        taskId,
        senderId: profile.id,
      });

      const newMessage = await storage.createTaskMessage(messageData);
      
      // Return the message with sender profile
      const messageWithSender = {
        ...newMessage,
        sender: profile,
      };

      res.status(201).json(messageWithSender);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Create task message error:", error);
      res.status(500).json({ message: error.message || "Failed to create task message" });
    }
  });

  // Mark task message as read
  app.patch("/api/tasks/messages/:messageId/read", requireAuth, requireRole("Staff", "Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      const { messageId } = req.params;
      
      await storage.markTaskMessageAsRead(messageId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Mark task message as read error:", error);
      res.status(500).json({ message: error.message || "Failed to mark message as read" });
    }
  });

  // Get task relationships
  app.get("/api/tasks/:taskId/relationships", requireAuth, requireRole("Staff", "Admin", "SuperAdmin"), requireTaskAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { taskId } = req.params;
      const relationships = await storage.getTaskRelationships(taskId);
      res.json(relationships);
    } catch (error: any) {
      console.error("Get task relationships error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch task relationships" });
    }
  });

  // Create task relationship
  app.post("/api/tasks/:taskId/relationships", requireAuth, requireRole("Admin", "SuperAdmin"), requireTaskAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { taskId } = req.params;
      const { relatedTaskId, relationshipType } = req.body;

      if (!relatedTaskId || !relationshipType) {
        return res.status(400).json({ message: "relatedTaskId and relationshipType are required" });
      }

      // Validate relationshipType
      const validTypes = ["blocks", "blocked_by", "relates_to", "duplicates"];
      if (!validTypes.includes(relationshipType)) {
        return res.status(400).json({ message: `Invalid relationshipType. Must be one of: ${validTypes.join(", ")}` });
      }

      // Get both tasks to verify access and tenant isolation
      const sourceTask = await storage.getTaskById(taskId);
      const relatedTask = await storage.getTaskById(relatedTaskId);
      
      if (!sourceTask) {
        return res.status(404).json({ message: "Source task not found" });
      }
      
      if (!relatedTask) {
        return res.status(404).json({ message: "Related task not found" });
      }

      // Validate projectIds exist
      if (!sourceTask.projectId || !relatedTask.projectId) {
        return res.status(400).json({ message: "Tasks must be associated with projects" });
      }

      // Get projects with agency info for both tasks
      const sourceProjectData = await storage.getProjectWithAgency(sourceTask.projectId);
      const relatedProjectData = await storage.getProjectWithAgency(relatedTask.projectId);

      if (!sourceProjectData || !relatedProjectData) {
        return res.status(404).json({ message: "Project not found for one or both tasks" });
      }

      const sourceAgencyId = sourceProjectData.agencyId;
      const relatedAgencyId = relatedProjectData.agencyId;

      // Fail closed: Reject if either project lacks agencyId (for ALL roles including SuperAdmin)
      // This prevents cross-tenant bypass on legacy/orphaned projects
      if (!sourceAgencyId || !relatedAgencyId) {
        return res.status(403).json({ message: "Cannot create relationships for tasks without agency association" });
      }

      // Ensure both tasks belong to the same agency (tenant isolation)
      if (sourceAgencyId !== relatedAgencyId) {
        return res.status(403).json({ message: "Cannot create relationships between tasks from different agencies" });
      }

      // For non-SuperAdmin users, verify they have access to their specific agency
      // SuperAdmin can link tasks across agencies they manage, but only if both have valid agencyIds (checked above)
      if (req.user!.role !== "SuperAdmin" && sourceAgencyId !== req.user!.agencyId) {
        return res.status(403).json({ message: "Access denied: Tasks do not belong to your agency" });
      }

      // Validate import schema
      const { insertTaskRelationshipSchema } = await import("@shared/schema");
      const relationshipData = insertTaskRelationshipSchema.parse({
        taskId,
        relatedTaskId,
        relationshipType,
      });

      const relationship = await storage.createTaskRelationship(relationshipData);
      
      // Get the relationship with full task data
      const relationships = await storage.getTaskRelationships(taskId);
      const createdRelationship = relationships.find(r => r.id === relationship.id);

      res.status(201).json(createdRelationship);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Create task relationship error:", error);
      res.status(500).json({ message: error.message || "Failed to create task relationship" });
    }
  });

  // Delete task relationship
  app.delete("/api/tasks/relationships/:relationshipId", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      const { relationshipId } = req.params;
      
      // First, get the relationship to verify access
      const allRelationships = await db
        .select()
        .from(taskRelationships)
        .where(eq(taskRelationships.id, relationshipId))
        .limit(1);
      
      if (allRelationships.length === 0) {
        return res.status(404).json({ message: "Relationship not found" });
      }
      
      const relationship = allRelationships[0];
      
      // Get the source task and verify access
      const sourceTask = await storage.getTaskById(relationship.taskId);
      if (!sourceTask) {
        return res.status(404).json({ message: "Source task not found" });
      }
      
      // Validate projectId exists
      if (!sourceTask.projectId) {
        return res.status(400).json({ message: "Task must be associated with a project" });
      }
      
      // Get project with agency info to verify access
      const projectData = await storage.getProjectWithAgency(sourceTask.projectId);
      if (!projectData) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      const projectAgencyId = projectData.agencyId;
      
      // Fail closed: Reject if project lacks agencyId (for ALL roles including SuperAdmin)
      // This prevents cross-tenant bypass on legacy/orphaned projects
      if (!projectAgencyId) {
        return res.status(403).json({ message: "Cannot delete relationships for tasks without agency association" });
      }
      
      // For non-SuperAdmin users, verify they have access to their specific agency
      // SuperAdmin can delete relationships for tasks across agencies they manage, but only if project has valid agencyId (checked above)
      if (req.user!.role !== "SuperAdmin" && projectAgencyId !== req.user!.agencyId) {
        return res.status(403).json({ message: "Access denied: Task does not belong to your agency" });
      }
      
      await storage.deleteTaskRelationship(relationshipId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete task relationship error:", error);
      res.status(500).json({ message: error.message || "Failed to delete task relationship" });
    }
  });

  // Helper function to log task changes
  async function logTaskActivity(taskId: string, userId: string, oldTask: Task, newTask: Task) {
    try {
      const changes: Array<{action: string, fieldName?: string, oldValue?: string, newValue?: string}> = [];
      
      // Check each field for changes (comparing persisted states)
      if (oldTask.status !== newTask.status) {
        changes.push({
          action: 'status_changed',
          fieldName: 'status',
          oldValue: oldTask.status,
          newValue: newTask.status
        });
      }
      
      if (oldTask.priority !== newTask.priority) {
        changes.push({
          action: 'priority_changed',
          fieldName: 'priority',
          oldValue: oldTask.priority || '',
          newValue: newTask.priority || ''
        });
      }
      
      if (oldTask.startDate !== newTask.startDate) {
        changes.push({
          action: 'date_changed',
          fieldName: 'startDate',
          oldValue: oldTask.startDate || '',
          newValue: newTask.startDate || ''
        });
      }
      
      if (oldTask.dueDate !== newTask.dueDate) {
        changes.push({
          action: 'date_changed',
          fieldName: 'dueDate',
          oldValue: oldTask.dueDate || '',
          newValue: newTask.dueDate || ''
        });
      }
      
      if (oldTask.description !== newTask.description) {
        changes.push({
          action: 'description_changed',
          fieldName: 'description',
          oldValue: oldTask.description?.substring(0, 100) || '',
          newValue: newTask.description?.substring(0, 100) || ''
        });
      }
      
      // Create activity records for all changes
      for (const change of changes) {
        await storage.createTaskActivity({
          taskId,
          userId,
          ...change
        });
      }
    } catch (error) {
      // Log error but don't fail the request - activity logging is non-critical
      console.error('Failed to log task activity:', error);
    }
  }

  app.patch("/api/tasks/:id", requireAuth, requireRole("Staff", "Admin"), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      
      // For Staff users, verify they're assigned to this task
      if (req.user!.role === "Staff") {
        const profile = await storage.getProfileById(req.user!.id); // req.user.id IS the profile ID
        if (!profile) {
          return res.status(403).json({ message: "Profile not found" });
        }
        
        // Check if staff is assigned to this task
        const assignments = await storage.getAssignmentsByTaskId(id);
        const isAssigned = assignments.some(a => a.staffProfileId === profile.id);
        
        if (!isAssigned) {
          return res.status(403).json({ message: "Not authorized to update this task - not assigned" });
        }
      }
      
      // Get old task state before update
      const oldTask = await storage.getTaskById(id);
      if (!oldTask) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // Validate time tracking increments (must be 0.5 hour increments)
      if (req.body.timeTracked !== undefined && req.body.timeTracked !== null) {
        const tracked = Number(req.body.timeTracked);
        if (!Number.isFinite(tracked) || tracked < 0 || (tracked * 2) % 1 !== 0) {
          return res.status(400).json({ 
            message: "Time tracked must be a non-negative number in 0.5 hour increments (0, 0.5, 1, 1.5, etc.)" 
          });
        }
      }
      
      if (req.body.timeEstimate !== undefined && req.body.timeEstimate !== null) {
        const estimate = Number(req.body.timeEstimate);
        if (!Number.isFinite(estimate) || estimate < 0 || (estimate * 2) % 1 !== 0) {
          return res.status(400).json({ 
            message: "Time estimate must be a non-negative number in 0.5 hour increments (0, 0.5, 1, 1.5, etc.)" 
          });
        }
      }
      
      const updatedTask = await storage.updateTask(id, req.body);
      
      console.log('[PATCH /api/tasks/:id] Updated task data:', JSON.stringify({
        id: updatedTask.id,
        timeEstimate: updatedTask.timeEstimate,
        timeTracked: updatedTask.timeTracked,
        hasTimeEstimate: 'timeEstimate' in updatedTask,
        hasTimeTracked: 'timeTracked' in updatedTask,
        allKeys: Object.keys(updatedTask)
      }, null, 2));
      
      // Log activity for the changes
      await logTaskActivity(id, req.user!.id, oldTask, updatedTask);
      
      res.json(updatedTask);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // General CRUD Routes for creating test data (protected - Admin only)
  app.post("/api/projects", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const project = await storage.createProject(req.body);
      res.status(201).json(project);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/tasks", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const task = await storage.createTask(req.body);
      res.status(201).json(task);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/invoices", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
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

  app.patch("/api/invoices/:invoiceId/status", requireAuth, requireRole("Admin"), requireInvoiceAccess(storage), async (req: AuthRequest, res) => {
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

  // Get single invoice by ID
  app.get("/api/client/invoices/:invoiceId", requireAuth, requireRole("Client", "Admin"), requireInvoiceAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { invoiceId } = req.params;
      const invoice = await storage.getInvoiceById(invoiceId);
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Check authorization - clients can only view their own invoices
      if (req.user!.role === "Client") {
        const profile = await storage.getProfileById(req.user!.id); // req.user.id IS the profile ID
        if (!profile) {
          return res.status(403).json({ message: "Profile not found" });
        }
        const client = await storage.getClientByProfileId(profile.id);
        
        if (!client) {
          return res.status(403).json({ message: "Client not found" });
        }
        
        // Verify the invoice belongs to this client
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

  // Invoice Line Items
  app.get("/api/invoices/:invoiceId/line-items", requireAuth, requireInvoiceAccess(storage), async (req: AuthRequest, res) => {
    try {
      // Restrict to Client and Admin roles only - Staff should not access invoices
      if (req.user!.role !== "Client" && req.user!.role !== "Admin") {
        return res.status(403).json({ message: "Not authorized to access invoice line items" });
      }
      
      const { invoiceId } = req.params;
      
      // First, get the invoice to verify ownership
      const invoice = await storage.getInvoiceById(invoiceId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      // Check authorization - clients can only view their own invoice line items
      if (req.user!.role === "Client") {
        const profile = await storage.getProfileById(req.user!.id); // req.user.id IS the profile ID
        if (!profile) {
          return res.status(403).json({ message: "Profile not found" });
        }
        const client = await storage.getClientByProfileId(profile.id);
        
        if (!client) {
          return res.status(403).json({ message: "Client not found" });
        }
        
        // Verify the invoice belongs to this client
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

  app.post("/api/invoices/:invoiceId/line-items", requireAuth, requireRole("Admin"), requireInvoiceAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { invoiceId } = req.params;
      
      // Verify the invoice exists and belongs to a valid client
      const invoice = await storage.getInvoiceById(invoiceId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      // Verify the client exists (tenant validation)
      const client = await storage.getClientById(invoice.clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found for this invoice" });
      }
      
      const lineItems = Array.isArray(req.body) ? req.body : [req.body];
      
      // Validate each line item
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

  // Generate PDF for invoice
  app.post("/api/invoices/:invoiceId/generate-pdf", requireAuth, requireRole("Admin"), requireInvoiceAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { invoiceId } = req.params;
      
      const invoice = await storage.getInvoiceById(invoiceId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Generate PDF
      const pdfGenerator = new PDFGeneratorService(storage);
      const pdfBuffer = await pdfGenerator.generateInvoicePDF(invoiceId);

      // Save PDF and get URL
      const pdfUrl = await pdfStorageService.savePDF(invoice.invoiceNumber, pdfBuffer);

      // Update invoice with PDF URL
      await storage.updateInvoice(invoiceId, { pdfUrl });

      res.json({ pdfUrl, message: "PDF generated successfully" });
    } catch (error: any) {
      console.error("Generate PDF error:", error);
      res.status(500).json({ message: error.message || "Failed to generate PDF" });
    }
  });

  app.post("/api/initiatives", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const { billingType, cost, estimatedHours, ...rest } = req.body;
      
      const initiativeData: any = { ...rest };
      
      // Infer billing type from provided fields if not specified
      let effectiveBillingType = billingType;
      if (!billingType) {
        if (estimatedHours && !cost) {
          effectiveBillingType = "hours";
        } else {
          effectiveBillingType = "cost";
        }
      }
      
      // Handle billing type - either cost or hours
      if (effectiveBillingType === "hours") {
        const hours = estimatedHours ? parseFloat(estimatedHours) : NaN;
        if (isNaN(hours) || hours <= 0) {
          return res.status(400).json({ message: "Valid estimated hours (> 0) required for hours-based billing" });
        }
        initiativeData.billingType = "hours";
        initiativeData.estimatedHours = hours;
        initiativeData.cost = null;
      } else {
        // Cost billing - cost is required
        const costValue = cost ? parseFloat(cost) : NaN;
        if (isNaN(costValue) || costValue <= 0) {
          return res.status(400).json({ message: "Valid cost (> 0) required for cost-based billing" });
        }
        initiativeData.billingType = "cost";
        initiativeData.cost = costValue.toString();
        initiativeData.estimatedHours = null;
      }
      
      const initiative = await storage.createInitiative(initiativeData);
      res.status(201).json(initiative);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update initiative (edit before sending)
  app.patch("/api/initiatives/:id", requireAuth, requireRole("Admin"), requireInitiativeAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { title, observation, proposedAction, cost, impact, estimatedHours, billingType } = req.body;
      
      const updates: any = {
        title,
        observation,
        proposedAction,
        impact
      };
      
      // Handle billing type - either cost or hours
      if (billingType === "hours") {
        const hours = estimatedHours ? parseFloat(estimatedHours) : NaN;
        if (isNaN(hours) || hours <= 0) {
          return res.status(400).json({ message: "Valid estimated hours (> 0) required for hours-based billing" });
        }
        updates.billingType = "hours";
        updates.estimatedHours = hours;
        updates.cost = null; // Clear cost if switching to hours
      } else if (billingType === "cost") {
        // Cost is required for cost-based billing
        const costValue = cost ? parseFloat(cost) : NaN;
        if (isNaN(costValue) || costValue <= 0) {
          return res.status(400).json({ message: "Valid cost (> 0) required for cost-based billing" });
        }
        updates.billingType = "cost";
        updates.cost = costValue.toString();
        updates.estimatedHours = null; // Clear hours if switching to cost
      } else if (cost !== undefined || estimatedHours !== undefined) {
        // Legacy support: if no billingType specified, infer from provided values
        // If a field is provided (not undefined), validate it
        if (cost !== undefined) {
          const costValue = parseFloat(cost);
          if (isNaN(costValue) || costValue <= 0) {
            return res.status(400).json({ message: "Valid cost (> 0) required" });
          }
          updates.cost = costValue.toString();
          updates.billingType = "cost";
        }
        if (estimatedHours !== undefined) {
          const hours = parseFloat(estimatedHours);
          if (isNaN(hours) || hours <= 0) {
            return res.status(400).json({ message: "Valid estimated hours (> 0) required" });
          }
          updates.estimatedHours = hours;
          updates.billingType = "hours";
        }
      }
      
      const initiative = await storage.updateInitiative(id, updates);
      
      res.json(initiative);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Send initiative to client
  app.post("/api/initiatives/:id/send", requireAuth, requireRole("Admin"), requireInitiativeAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const initiative = await storage.sendInitiativeToClient(id);
      
      // Create notification for client about new initiative (don't let notification failures break sending)
      try {
        const client = await storage.getClientById(initiative.clientId);
        if (client) {
          const clientProfile = await storage.getProfileById(client.profileId);
          if (clientProfile) {
            // profile.id IS the user ID (Supabase Auth ID)
            await storage.createNotification({
              userId: clientProfile.id,
              type: "new_initiative",
              title: "New Strategic Initiative",
              message: `Your agency has sent you a new strategic initiative: "${initiative.title}"`,
              link: "/client/recommendations",
              isRead: "false",
              isArchived: "false",
            });
          }
        }
      } catch (notificationError) {
        console.error("Failed to create new initiative notification:", notificationError);
      }
      
      res.json(initiative);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Client responds to initiative (approve/reject/discuss)
  app.post("/api/initiatives/:id/respond", requireAuth, requireRole("Client", "Admin"), requireInitiativeAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { response, feedback } = req.body;
      
      console.log(`[INITIATIVE_RESPOND] Received request for initiative ${id}:`, { response, feedback, hasResponse: !!response });
      
      if (!["approved", "rejected", "discussing"].includes(response)) {
        console.log(`[INITIATIVE_RESPOND] Invalid response value: "${response}"`);
        return res.status(400).json({ message: "Invalid response. Must be 'approved', 'rejected', or 'discussing'" });
      }
      
      // Get initiative to check billing type
      const existingInitiative = await storage.getInitiativeById(id);
      if (!existingInitiative) {
        console.log(`[INITIATIVE_RESPOND] Initiative not found: ${id}`);
        return res.status(404).json({ message: "Initiative not found" });
      }
      
      console.log(`[INITIATIVE_RESPOND] Initiative details:`, {
        billingType: existingInitiative.billingType,
        estimatedHours: existingInitiative.estimatedHours,
        clientId: existingInitiative.clientId
      });
      
      // If approving an hours-based initiative, check and deduct retainer hours
      if (response === "approved" && existingInitiative.billingType === "hours" && existingInitiative.estimatedHours) {
        const hoursNeeded = parseFloat(existingInitiative.estimatedHours);
        const hoursInfo = await storage.checkRetainerHours(existingInitiative.clientId);
        
        console.log(`[INITIATIVE_RESPOND] Retainer hours check:`, {
          hoursNeeded,
          hoursAvailable: hoursInfo.available,
          hoursTotal: hoursInfo.total,
          hoursUsed: hoursInfo.used
        });
        
        if (hoursInfo.available < hoursNeeded) {
          console.log(`[INITIATIVE_RESPOND] Insufficient retainer hours!`);
          return res.status(400).json({ 
            message: `Insufficient retainer hours. You have ${hoursInfo.available} hours available but need ${hoursNeeded} hours. Please contact your account manager to purchase additional hours.` 
          });
        }
        
        // Deduct the hours
        await storage.deductRetainerHours(existingInitiative.clientId, hoursNeeded);
        console.log(`[INITIATIVE_RESPOND] Deducted ${hoursNeeded} retainer hours`);
      }
      
      const initiative = await storage.updateInitiativeClientResponse(id, response, feedback);
      
      // If approved, automatically create project and invoice (if not already created)
      let projectId: string | undefined = existingInitiative.projectId || undefined;
      let invoiceId: string | undefined = existingInitiative.invoiceId || undefined;
      
      if (response === "approved") {
        // Create project if not already created
        if (!projectId) {
          // Validate client exists BEFORE creating any resources
          const client = await storage.getClientById(existingInitiative.clientId);
          if (!client) {
            return res.status(400).json({ 
              message: "Cannot create project: client not found for this initiative" 
            });
          }
          
          // Use transaction for atomic project+task creation
          try {
            let createdProjectId: string | undefined;
            
            await db.transaction(async (tx) => {
              // Create project
              const [project] = await tx.insert(projects).values({
                name: existingInitiative.title,
                description: existingInitiative.observation,
                status: "Active",
                clientId: existingInitiative.clientId,
              }).returning();
              
              if (!project?.id) {
                throw new Error("Failed to create project: no ID returned");
              }
              
              createdProjectId = project.id;
              console.log(`Created project ${project.id} from approved initiative ${id}`);
              
              // Create task list
              const [taskList] = await tx.insert(taskLists).values({
                name: existingInitiative.title,
                projectId: project.id,
                agencyId: client.agencyId,
              }).returning();
              
              console.log(`Created task list ${taskList.id} for project ${project.id}`);
              
              // Create tasks from actionTasks array
              if (existingInitiative.actionTasks && Array.isArray(existingInitiative.actionTasks) && existingInitiative.actionTasks.length > 0) {
                const taskValues = existingInitiative.actionTasks.map(taskDescription => ({
                  description: taskDescription,
                  status: "To Do" as const,
                  priority: "Medium" as const,
                  projectId: project.id,
                  listId: taskList.id,
                  startDate: null,
                  dueDate: null,
                  parentId: null,
                  initiativeId: existingInitiative.id,
                }));
                
                await tx.insert(tasks).values(taskValues);
                console.log(`Created ${existingInitiative.actionTasks.length} tasks from initiative ${id}`);
              }
            });
            
            // Guard: Ensure transaction set the ID before proceeding
            if (!createdProjectId) {
              throw new Error("Transaction completed but project ID was not set");
            }
            
            // Only assign projectId to outer scope AFTER transaction commits successfully
            projectId = createdProjectId;
            
            // Persist project reference in initiative (outside transaction)
            await storage.updateInitiative(id, { projectId });
            
          } catch (autoCreateError: any) {
            console.error("Failed to auto-create project/tasks from initiative:", autoCreateError);
            return res.status(500).json({ 
              message: `Initiative approved, but failed to create project: ${autoCreateError.message}` 
            });
          }
        }
        
        // Generate invoice if needed (fixed cost initiatives or if cost is specified) and not already generated
        if (!invoiceId && (existingInitiative.billingType === "fixed" || (existingInitiative.cost && parseFloat(existingInitiative.cost) > 0))) {
          try {
            const invoiceGenerator = new InvoiceGeneratorService(storage);
            invoiceId = await invoiceGenerator.generateInvoiceFromInitiative(id);
            
            // Persist invoice reference in initiative
            await storage.updateInitiative(id, { invoiceId });
            
            console.log(`Generated invoice ${invoiceId} from approved initiative ${id}`);
          } catch (invoiceError) {
            console.error("Failed to generate invoice from initiative:", invoiceError);
            // Don't fail the approval, just log the error
          }
        }
      }
      
      // Create notification for admin users about client response (don't let notification failures break the response)
      try {
        const profile = await storage.getProfileByUserId(req.user!.id);
        if (profile?.role === "Client") {
          const client = await storage.getClientByProfileId(profile.id);
          // Only notify admins in the same agency as this client
          const adminUsers = client?.agencyId 
            ? await storage.getAllUsersWithProfiles(client.agencyId)
            : [];
          const admins = adminUsers.filter(u => u.profile?.role === "Admin");
          
          const responseText = response === "approved" ? "approved" : response === "rejected" ? "rejected" : "wants to discuss";
          
          for (const admin of admins) {
            await storage.createNotification({
              userId: admin.id,
              type: "initiative_response",
              title: "Initiative Response",
              message: `${profile.fullName} from ${client?.companyName} ${responseText} "${existingInitiative.title}"`,
              link: `/agency/recommendations`,
              isRead: "false",
              isArchived: "false",
            });
          }
        }
      } catch (notificationError) {
        console.error("Failed to create initiative response notification:", notificationError);
      }
      
      res.json({ 
        ...initiative, 
        projectId,
        invoiceId,
        message: response === "approved" 
          ? `Initiative approved successfully${projectId ? ', project and tasks created' : ''}${invoiceId ? ', invoice generated' : ''}` 
          : undefined
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Generate invoice from approved initiative
  app.post("/api/initiatives/:id/generate-invoice", requireAuth, requireRole("Admin"), requireInitiativeAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const invoiceGenerator = new InvoiceGeneratorService(storage);
      const invoiceId = await invoiceGenerator.generateInvoiceFromInitiative(id);
      res.status(201).json({ invoiceId, message: "Invoice generated successfully" });
    } catch (error: any) {
      console.error("Generate invoice error:", error);
      res.status(500).json({ message: error.message || "Failed to generate invoice" });
    }
  });

  // Soft delete initiative (move to trash)
  app.delete("/api/initiatives/:id", requireAuth, requireRole("Admin"), requireInitiativeAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const initiative = await storage.softDeleteInitiative(id);
      res.json({ message: "Initiative moved to trash", initiative });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Restore initiative from trash
  app.post("/api/initiatives/:id/restore", requireAuth, requireRole("Admin"), requireInitiativeAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const initiative = await storage.restoreInitiative(id);
      res.json({ message: "Initiative restored", initiative });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get deleted initiatives (trash)
  app.get("/api/initiatives/trash", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const deletedInitiatives = await storage.getDeletedInitiatives();
      res.json(deletedInitiatives);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Permanently delete initiative
  app.delete("/api/initiatives/:id/permanent", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      await storage.permanentlyDeleteInitiative(id);
      res.json({ message: "Initiative permanently deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/metrics", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const metric = await storage.createMetric(req.body);
      res.status(201).json(metric);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // OAuth Routes for Google integrations (GA4 and Search Console)
  // Initiate OAuth flow (Admin or Client can initiate)
  app.get("/api/oauth/google/initiate", requireAuth, async (req: AuthRequest, res) => {
    try {
      const profile = await storage.getProfileByUserId(req.user!.id);
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }

      // Get service type from query parameter
      const service = req.query.service as 'GA4' | 'GSC';
      if (!service || (service !== 'GA4' && service !== 'GSC')) {
        return res.status(400).json({ message: "service query parameter must be 'GA4' or 'GSC'" });
      }

      // Get returnTo parameter for context-aware redirect after OAuth
      // Security: Validate returnTo to prevent open redirect vulnerabilities
      let returnTo = req.query.returnTo as string;
      
      // Default fallback based on role
      const defaultReturnTo = (profile.role === "Admin" || profile.role === "SuperAdmin") 
        ? "/agency/integrations" 
        : "/client";
      
      // Validate returnTo is a safe internal path (must start with "/" and not be a protocol URL)
      if (returnTo) {
        // Strip any leading/trailing whitespace
        returnTo = returnTo.trim();
        
        // Check if it's a relative path (starts with /) and doesn't contain protocol or //
        if (!returnTo.startsWith('/') || returnTo.startsWith('//') || returnTo.includes('://')) {
          console.warn(`[OAuth Security] Rejected unsafe returnTo: ${returnTo}`);
          returnTo = defaultReturnTo;
        }
      } else {
        returnTo = defaultReturnTo;
      }

      // Get client ID - for Admin/SuperAdmin, use query param; for Client, use their own
      let clientId: string;
      
      if (profile.role === "Admin" || profile.role === "SuperAdmin") {
        // Admin/SuperAdmin is setting up integration for a specific client
        const targetClientId = req.query.clientId as string;
        if (!targetClientId) {
          return res.status(400).json({ message: "clientId query parameter required for Admin/SuperAdmin" });
        }
        clientId = targetClientId;
      } else if (profile.role === "Client") {
        // Client is authorizing their own integration
        const client = await storage.getClientByProfileId(profile.id);
        if (!client) {
          return res.status(404).json({ message: "Client record not found" });
        }
        clientId = client.id;
      } else {
        return res.status(403).json({ message: "Only Admin, SuperAdmin, and Client can initiate OAuth" });
      }

      // Check if OAuth is initiated in popup mode
      const popup = req.query.popup === 'true';
      const origin = popup ? req.get('origin') || req.get('referer')?.split('/').slice(0, 3).join('/') : undefined;

      // Create cryptographically signed state parameter for CSRF protection
      const state = generateOAuthState(clientId, profile.role, service, returnTo, popup, origin);

      const authUrl = getAuthUrl(state, service);
      res.json({ authUrl });
    } catch (error: any) {
      console.error("OAuth initiation error:", error);
      res.status(500).json({ message: error.message || "OAuth initiation failed" });
    }
  });

  // OAuth callback - handles Google's redirect after authorization
  app.get("/api/oauth/google/callback", async (req, res) => {
    try {
      const { code, state, error } = req.query;

      if (error) {
        return res.redirect(`/client?oauth_error=${encodeURIComponent(error as string)}`);
      }

      if (!code || !state) {
        return res.redirect('/client?oauth_error=missing_parameters');
      }

      // Verify and parse signed state parameter
      let stateData;
      try {
        stateData = verifyOAuthState(state as string);
      } catch (error: any) {
        console.error("State verification failed:", error.message);
        return res.redirect(`/client?oauth_error=invalid_state`);
      }
      
      const { clientId, service, returnTo: stateReturnTo } = stateData;

      // Security: Defensive validation of returnTo even though it was validated before signing
      let returnTo = stateReturnTo;
      const defaultReturnTo = (stateData.initiatedBy === "Admin" || stateData.initiatedBy === "SuperAdmin") 
        ? "/agency/integrations" 
        : "/client";
      
      if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//') || returnTo.includes('://')) {
        console.warn(`[OAuth Security] Invalid returnTo in callback, using fallback: ${returnTo}`);
        returnTo = defaultReturnTo;
      }

      // Exchange code for tokens
      const tokens = await exchangeCodeForTokens(code as string);

      // Store integration for the specified service
      const serviceName = service;
      const existing = await storage.getIntegrationByClientId(clientId, serviceName);
      
      if (existing) {
        // Update existing integration
        await storage.updateIntegration(existing.id, {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken || existing.refreshToken,
          expiresAt: tokens.expiresAt,
        });
      } else {
        // Create new integration
        await storage.createIntegration({
          clientId,
          serviceName,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
        });
      }

      // Check if this was a popup flow
      if (stateData.popup && stateData.origin) {
        // Return HTML page that posts message to opener window
        const htmlResponse = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="referrer" content="no-referrer">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; connect-src 'self';">
  <title>OAuth Success</title>
</head>
<body>
  <script>
    (function() {
      if (!window.opener) {
        document.body.innerHTML = '<h1>OAuth Complete</h1><p>You can close this window.</p>';
        return;
      }
      
      try {
        window.opener.postMessage({
          type: 'GOOGLE_OAUTH_SUCCESS',
          clientId: ${JSON.stringify(clientId)},
          service: ${JSON.stringify(service)}
        }, ${JSON.stringify(stateData.origin)});
        
        // Close window after posting message
        setTimeout(function() {
          window.close();
        }, 100);
      } catch (e) {
        console.error('Failed to post message:', e);
        document.body.innerHTML = '<h1>OAuth Complete</h1><p>You can close this window.</p>';
      }
    })();
  </script>
  <p>OAuth successful. Closing window...</p>
</body>
</html>`;
        return res.type('text/html').send(htmlResponse);
      }

      // Standard redirect flow (non-popup)
      const separator = returnTo.includes('?') ? '&' : '?';
      res.redirect(`${returnTo}${separator}success=google_connected&clientId=${clientId}&service=${service}`);
    } catch (error: any) {
      console.error("OAuth callback error:", error);
      
      // Check if this was a popup flow
      let stateData;
      try {
        stateData = verifyOAuthState(req.query.state as string);
      } catch (e) {
        // State verification failed, use standard redirect
        return res.redirect(`/client?oauth_error=${encodeURIComponent(error.message)}`);
      }
      
      if (stateData?.popup && stateData?.origin) {
        // Return HTML page that posts error message to opener
        const htmlResponse = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="referrer" content="no-referrer">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; connect-src 'self';">
  <title>OAuth Error</title>
</head>
<body>
  <script>
    (function() {
      if (!window.opener) {
        document.body.innerHTML = '<h1>OAuth Error</h1><p>${error.message || 'Authentication failed'}. You can close this window.</p>';
        return;
      }
      
      try {
        window.opener.postMessage({
          type: 'GOOGLE_OAUTH_ERROR',
          error: ${JSON.stringify(error.message || 'Authentication failed')}
        }, ${JSON.stringify(stateData.origin)});
        
        setTimeout(function() {
          window.close();
        }, 100);
      } catch (e) {
        console.error('Failed to post message:', e);
        document.body.innerHTML = '<h1>OAuth Error</h1><p>You can close this window.</p>';
      }
    })();
  </script>
  <p>OAuth failed. Closing window...</p>
</body>
</html>`;
        return res.type('text/html').send(htmlResponse);
      }
      
      // Standard redirect flow
      res.redirect(`/client?oauth_error=${encodeURIComponent(error.message)}`);
    }
  });

  // Get GA4 integration status for a client
  app.get("/api/integrations/ga4/:clientId", requireAuth, requireRole("Admin", "Client"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;

      const integration = await storage.getIntegrationByClientId(clientId, 'GA4');
      
      if (!integration) {
        return res.json({ connected: false });
      }

      // Return status without exposing tokens
      res.json({
        connected: true,
        ga4PropertyId: integration.ga4PropertyId,
        expiresAt: integration.expiresAt,
        createdAt: integration.createdAt,
        updatedAt: integration.updatedAt,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Fetch available GA4 properties (Admin only)
  app.get("/api/integrations/ga4/:clientId/properties", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      
      let integration = await storage.getIntegrationByClientId(clientId, 'GA4');
      
      if (!integration) {
        return res.status(404).json({ message: "GA4 integration not found" });
      }

      // Check if token is expired and refresh if needed
      if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
        if (!integration.refreshToken) {
          return res.status(401).json({ message: "Token expired and no refresh token available" });
        }

        const newTokens = await refreshAccessToken(integration.refreshToken);
        integration = await storage.updateIntegration(integration.id, {
          accessToken: newTokens.accessToken,
          expiresAt: newTokens.expiresAt,
        });
      }

      const properties = await fetchGA4Properties(integration.accessToken!, clientId);
      res.json(properties);
    } catch (error: any) {
      console.error("Fetch properties error:", error);
      // Use userMessage if available (from GoogleApiError), otherwise use generic message
      const message = error.userMessage || error.message || "Failed to fetch properties";
      res.status(500).json({ message });
    }
  });

  // Save selected GA4 property (Admin only)
  app.post("/api/integrations/ga4/:clientId/property", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const { ga4PropertyId, ga4LeadEventName } = req.body;

      if (!ga4PropertyId) {
        return res.status(400).json({ message: "ga4PropertyId is required" });
      }

      // Validate lead event name if provided (optional)
      if (ga4LeadEventName && (typeof ga4LeadEventName !== 'string' || ga4LeadEventName.length > 500)) {
        return res.status(400).json({ message: "ga4LeadEventName must be a string with max 500 characters" });
      }

      const integration = await storage.getIntegrationByClientId(clientId, 'GA4');
      
      if (!integration) {
        return res.status(404).json({ message: "GA4 integration not found" });
      }

      const updated = await storage.updateIntegration(integration.id, {
        ga4PropertyId,
        ga4LeadEventName: ga4LeadEventName || null,
      });

      // SYNC: Update client leadEvents array to match GA4 integration (reverse sync)
      if (ga4LeadEventName) {
        const leadEventsArray = ga4LeadEventName.split(',').map((e: string) => e.trim()).filter((e: string) => e.length > 0);
        await storage.updateClient(clientId, {
          leadEvents: leadEventsArray,
        });
        console.log(`[Lead Events Sync] Updated client ${clientId} leadEvents from GA4 property save: ${leadEventsArray.join(',')}`);
      } else {
        // If no lead event name provided, clear the client's leadEvents
        await storage.updateClient(clientId, {
          leadEvents: [],
        });
        console.log(`[Lead Events Sync] Cleared client ${clientId} leadEvents (GA4 lead event name was null)`);
      }

      res.json({
        message: "GA4 property and lead event saved successfully",
        ga4PropertyId: updated.ga4PropertyId,
        ga4LeadEventName: updated.ga4LeadEventName,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update GA4 lead event name only (Admin only)
  app.patch("/api/integrations/ga4/:clientId/lead-event", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const { ga4LeadEventName } = req.body;

      // Validate lead event name - allow null/empty to clear, or validate if provided
      if (ga4LeadEventName !== null && ga4LeadEventName !== undefined && ga4LeadEventName !== '') {
        if (typeof ga4LeadEventName !== 'string' || ga4LeadEventName.length > 500) {
          return res.status(400).json({ message: "ga4LeadEventName must be a string with max 500 characters" });
        }
      }

      const integration = await storage.getIntegrationByClientId(clientId, 'GA4');
      
      if (!integration) {
        return res.status(404).json({ message: "GA4 integration not found. Please connect GA4 first." });
      }

      const updated = await storage.updateIntegration(integration.id, {
        ga4LeadEventName: ga4LeadEventName || null,
      });

      // SYNC: Update client leadEvents array to match GA4 integration (reverse sync)
      if (ga4LeadEventName) {
        const leadEventsArray = ga4LeadEventName.split(',').map((e: string) => e.trim()).filter((e: string) => e.length > 0);
        await storage.updateClient(clientId, {
          leadEvents: leadEventsArray,
        });
        console.log(`[Lead Events Sync] Updated client ${clientId} leadEvents from lead event PATCH: ${leadEventsArray.join(',')}`);
      } else {
        // If no lead event name provided, clear the client's leadEvents
        await storage.updateClient(clientId, {
          leadEvents: [],
        });
        console.log(`[Lead Events Sync] Cleared client ${clientId} leadEvents (lead event name was cleared via PATCH)`);
      }

      res.json({
        message: "Lead event configuration updated successfully",
        ga4LeadEventName: updated.ga4LeadEventName,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Fetch available GA4 key events for selection (Admin only)
  app.get("/api/integrations/ga4/:clientId/key-events", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      
      let integration = await storage.getIntegrationByClientId(clientId, 'GA4');
      
      if (!integration || !integration.ga4PropertyId) {
        return res.status(404).json({ message: "GA4 integration or property not configured" });
      }

      // Check if token is expired and refresh if needed
      if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
        if (!integration.refreshToken) {
          return res.status(401).json({ message: "Token expired and no refresh token available" });
        }

        const newTokens = await refreshAccessToken(integration.refreshToken);
        integration = await storage.updateIntegration(integration.id, {
          accessToken: newTokens.accessToken,
          expiresAt: newTokens.expiresAt,
        });
      }

      const keyEventsData = await fetchGA4AvailableKeyEvents(
        integration.accessToken!,
        integration.ga4PropertyId!,
        clientId
      );
      
      res.json(keyEventsData);
    } catch (error: any) {
      console.error("Fetch key events error:", error);
      const message = error.userMessage || error.message || "Failed to fetch key events";
      res.status(500).json({ message });
    }
  });

  // Save selected lead events for a client (Admin only)
  app.post("/api/clients/:clientId/lead-events", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const { leadEvents } = req.body;

      // Validate leadEvents is an array of strings
      if (!Array.isArray(leadEvents)) {
        return res.status(400).json({ message: "leadEvents must be an array" });
      }

      if (!leadEvents.every(event => typeof event === 'string')) {
        return res.status(400).json({ message: "All lead events must be strings" });
      }

      const client = await storage.getClientById(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      const updated = await storage.updateClient(clientId, {
        leadEvents,
      });

      // SYNC: Update GA4 integration with lead events to ensure consistency
      const ga4Integration = await storage.getIntegrationByClientId(clientId, 'GA4');
      if (ga4Integration) {
        // Convert array to comma-separated string for GA4 API
        const leadEventsString = leadEvents.map((e: string) => e.trim()).join(',');
        await storage.updateIntegration(ga4Integration.id, {
          ga4LeadEventName: leadEventsString || null,
        });
        console.log(`[Lead Events Sync] Updated GA4 integration for client ${clientId} with events: ${leadEventsString}`);
      }

      res.json({
        message: "Lead events saved successfully",
        leadEvents: updated.leadEvents,
      });
    } catch (error: any) {
      console.error("Save lead events error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Google Search Console Routes
  
  // Get GSC integration status for a client
  app.get("/api/integrations/gsc/:clientId", requireAuth, requireRole("Admin", "Client"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;

      const integration = await storage.getIntegrationByClientId(clientId, 'GSC');
      
      if (!integration) {
        return res.json({ connected: false });
      }

      // Return status without exposing tokens
      res.json({
        connected: true,
        gscSiteUrl: integration.gscSiteUrl,
        expiresAt: integration.expiresAt,
        createdAt: integration.createdAt,
        updatedAt: integration.updatedAt,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Fetch available GSC sites (Admin only)
  app.get("/api/integrations/gsc/:clientId/sites", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      
      let integration = await storage.getIntegrationByClientId(clientId, 'GSC');
      
      if (!integration) {
        return res.status(404).json({ message: "Search Console integration not found" });
      }

      // Check if token is expired and refresh if needed
      if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
        if (!integration.refreshToken) {
          return res.status(401).json({ message: "Token expired and no refresh token available" });
        }

        const newTokens = await refreshAccessToken(integration.refreshToken);
        integration = await storage.updateIntegration(integration.id, {
          accessToken: newTokens.accessToken,
          expiresAt: newTokens.expiresAt,
        });
      }

      const sites = await fetchGSCSites(integration.accessToken!, clientId);
      res.json(sites);
    } catch (error: any) {
      console.error("Fetch sites error:", error);
      const message = error.userMessage || error.message || "Failed to fetch sites";
      res.status(500).json({ message });
    }
  });

  // Save selected GSC site (Admin only)
  app.post("/api/integrations/gsc/:clientId/site", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const { gscSiteUrl } = req.body;

      if (!gscSiteUrl) {
        return res.status(400).json({ message: "gscSiteUrl is required" });
      }

      const integration = await storage.getIntegrationByClientId(clientId, 'GSC');
      
      if (!integration) {
        return res.status(404).json({ message: "Search Console integration not found" });
      }

      const updated = await storage.updateIntegration(integration.id, {
        gscSiteUrl,
      });

      res.json({
        message: "Search Console site saved successfully",
        gscSiteUrl: updated.gscSiteUrl,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Disconnect GA4 integration (Admin only)
  app.delete("/api/integrations/ga4/:clientId", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;

      const integration = await storage.getIntegrationByClientId(clientId, 'GA4');
      
      if (!integration) {
        return res.status(404).json({ message: "GA4 integration not found" });
      }

      await storage.deleteIntegration(integration.id);

      res.json({ message: "GA4 integration disconnected successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Disconnect GSC integration (Admin only)
  app.delete("/api/integrations/gsc/:clientId", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;

      const integration = await storage.getIntegrationByClientId(clientId, 'GSC');
      
      if (!integration) {
        return res.status(404).json({ message: "Search Console integration not found" });
      }

      await storage.deleteIntegration(integration.id);

      res.json({ message: "Search Console integration disconnected successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // HubSpot Integration Routes (Agency-wide)

  // Get HubSpot connection status for the agency (Admin only)
  app.get("/api/integrations/hubspot/status", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user!.agencyId;
      if (!agencyId) {
        return res.status(400).json({ connected: false, error: "Agency ID not found" });
      }

      const { getHubSpotStatus } = await import("./lib/hubspot");
      const status = await getHubSpotStatus(agencyId);
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ 
        connected: false, 
        error: error.message || "Failed to check HubSpot status" 
      });
    }
  });

  // Connect HubSpot for the agency (Admin only)
  app.post("/api/integrations/hubspot/connect", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user!.agencyId;
      if (!agencyId) {
        return res.status(400).json({ error: "Agency ID not found" });
      }

      const { accessToken } = req.body;
      if (!accessToken) {
        return res.status(400).json({ error: "Access token is required" });
      }

      // Encrypt the access token
      const { encrypt } = await import("./lib/encryption");
      const { encrypted, iv, authTag } = encrypt(accessToken);

      // Save to agency settings
      const existing = await db
        .select()
        .from(agencySettings)
        .where(eq(agencySettings.agencyId, agencyId))
        .limit(1);

      if (existing.length > 0) {
        // Update existing settings
        await db
          .update(agencySettings)
          .set({
            hubspotAccessToken: encrypted,
            hubspotAccessTokenIv: iv,
            hubspotAccessTokenAuthTag: authTag,
            hubspotConnectedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(agencySettings.agencyId, agencyId));
      } else {
        // Create new settings
        await db
          .insert(agencySettings)
          .values({
            agencyId,
            hubspotAccessToken: encrypted,
            hubspotAccessTokenIv: iv,
            hubspotAccessTokenAuthTag: authTag,
            hubspotConnectedAt: new Date(),
          });
      }

      res.json({ success: true, message: "HubSpot connected successfully" });
    } catch (error: any) {
      res.status(500).json({ 
        error: error.message || "Failed to connect HubSpot" 
      });
    }
  });

  // Disconnect HubSpot for the agency (Admin only)
  app.post("/api/integrations/hubspot/disconnect", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user!.agencyId;
      if (!agencyId) {
        return res.status(400).json({ error: "Agency ID not found" });
      }

      // Remove HubSpot credentials from agency settings
      await db
        .update(agencySettings)
        .set({
          hubspotAccessToken: null,
          hubspotAccessTokenIv: null,
          hubspotAccessTokenAuthTag: null,
          hubspotConnectedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(agencySettings.agencyId, agencyId));

      res.json({ success: true, message: "HubSpot disconnected successfully" });
    } catch (error: any) {
      res.status(500).json({ 
        error: error.message || "Failed to disconnect HubSpot" 
      });
    }
  });

  // Fetch HubSpot CRM data for the agency (Admin only)
  app.get("/api/integrations/hubspot/data", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user!.agencyId;
      if (!agencyId) {
        return res.status(400).json({ error: "Agency ID not found" });
      }

      const { fetchHubSpotCRMData } = await import("./lib/hubspot");
      const data = await fetchHubSpotCRMData(agencyId);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ 
        message: error.message || "Failed to fetch HubSpot data" 
      });
    }
  });

  // LinkedIn Integration Routes (Agency-wide)

  // Get LinkedIn connection status for the agency (Admin only)
  app.get("/api/integrations/linkedin/status", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user!.agencyId;
      if (!agencyId) {
        return res.status(400).json({ connected: false, error: "Agency ID not found" });
      }

      const { getLinkedInStatus } = await import("./lib/linkedin");
      const status = await getLinkedInStatus(agencyId);
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ 
        connected: false, 
        error: error.message || "Failed to check LinkedIn status" 
      });
    }
  });

  // Connect LinkedIn for the agency (Admin only)
  app.post("/api/integrations/linkedin/connect", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user!.agencyId;
      if (!agencyId) {
        return res.status(400).json({ error: "Agency ID not found" });
      }

      const { accessToken, organizationId } = req.body;
      if (!accessToken || !organizationId) {
        return res.status(400).json({ error: "Access token and organization ID are required" });
      }

      // Encrypt the access token
      const { encrypt } = await import("./lib/encryption");
      const { encrypted, iv, authTag } = encrypt(accessToken);

      // Save to agency settings
      const existing = await db
        .select()
        .from(agencySettings)
        .where(eq(agencySettings.agencyId, agencyId))
        .limit(1);

      if (existing.length > 0) {
        // Update existing settings
        await db
          .update(agencySettings)
          .set({
            linkedinAccessToken: encrypted,
            linkedinAccessTokenIv: iv,
            linkedinAccessTokenAuthTag: authTag,
            linkedinOrganizationId: organizationId,
            linkedinConnectedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(agencySettings.agencyId, agencyId));
      } else {
        // Create new settings
        await db
          .insert(agencySettings)
          .values({
            agencyId,
            linkedinAccessToken: encrypted,
            linkedinAccessTokenIv: iv,
            linkedinAccessTokenAuthTag: authTag,
            linkedinOrganizationId: organizationId,
            linkedinConnectedAt: new Date(),
          });
      }

      res.json({ success: true, message: "LinkedIn connected successfully" });
    } catch (error: any) {
      res.status(500).json({ 
        error: error.message || "Failed to connect LinkedIn" 
      });
    }
  });

  // Disconnect LinkedIn for the agency (Admin only)
  app.post("/api/integrations/linkedin/disconnect", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user!.agencyId;
      if (!agencyId) {
        return res.status(400).json({ error: "Agency ID not found" });
      }

      // Remove LinkedIn credentials from agency settings
      await db
        .update(agencySettings)
        .set({
          linkedinAccessToken: null,
          linkedinAccessTokenIv: null,
          linkedinAccessTokenAuthTag: null,
          linkedinOrganizationId: null,
          linkedinConnectedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(agencySettings.agencyId, agencyId));

      res.json({ success: true, message: "LinkedIn disconnected successfully" });
    } catch (error: any) {
      res.status(500).json({ 
        error: error.message || "Failed to disconnect LinkedIn" 
      });
    }
  });

  // Fetch LinkedIn data for the agency (Admin only)
  app.get("/api/integrations/linkedin/data", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user!.agencyId;
      if (!agencyId) {
        return res.status(400).json({ error: "Agency ID not found" });
      }

      const { fetchLinkedInData } = await import("./lib/linkedin");
      const data = await fetchLinkedInData(agencyId);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ 
        message: error.message || "Failed to fetch LinkedIn data" 
      });
    }
  });

  // Analytics Data API

  // Aggregated dashboard summary endpoint (optimized for performance)
  app.get("/api/agency/clients/:clientId/dashboard-summary", requireAuth, requireRole("Client", "Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const { startDate, endDate } = req.query;

      // Default to last 30 days if not specified
      const end = endDate as string || new Date().toISOString().split('T')[0];
      const start = startDate as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Check cache first
      const cacheKey = `dashboard-summary:${clientId}:${start}:${end}`;
      const cachedData = cache.get(cacheKey);
      
      if (cachedData) {
        return res.json({ ...cachedData, cached: true });
      }

      // Fetch all data in parallel
      const [ga4Result, gscResult, gscQueriesResult, outcomeMetricsResult] = await Promise.allSettled([
        // GA4 data
        (async () => {
          let integration = await storage.getIntegrationByClientId(clientId, 'GA4');
          if (!integration || !integration.ga4PropertyId) {
            return { rows: [], rowCount: 0, totals: [] };
          }

          // Check if token is expired and refresh if needed
          if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
            if (!integration.refreshToken) {
              return { rows: [], rowCount: 0, totals: [] };
            }
            const newTokens = await refreshAccessToken(integration.refreshToken);
            integration = await storage.updateIntegration(integration.id, {
              accessToken: newTokens.accessToken,
              expiresAt: newTokens.expiresAt,
            });
          }

          if (!integration.accessToken) {
            return { rows: [], rowCount: 0, totals: [] };
          }

          return await fetchGA4Data(integration.accessToken, integration.ga4PropertyId!, start, end, clientId);
        })(),

        // GSC site data
        (async () => {
          let integration = await storage.getIntegrationByClientId(clientId, 'GSC');
          if (!integration || !integration.gscSiteUrl) {
            return { rows: [] };
          }

          if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
            if (!integration.refreshToken) {
              return { rows: [] };
            }
            const newTokens = await refreshAccessToken(integration.refreshToken);
            integration = await storage.updateIntegration(integration.id, {
              accessToken: newTokens.accessToken,
              expiresAt: newTokens.expiresAt,
            });
          }

          if (!integration.accessToken) {
            return { rows: [] };
          }

          return await fetchGSCData(integration.accessToken, integration.gscSiteUrl!, start, end, clientId);
        })(),

        // GSC queries
        (async () => {
          let integration = await storage.getIntegrationByClientId(clientId, 'GSC');
          if (!integration || !integration.gscSiteUrl) {
            return { rows: [] };
          }

          if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
            if (!integration.refreshToken) {
              return { rows: [] };
            }
            const newTokens = await refreshAccessToken(integration.refreshToken);
            integration = await storage.updateIntegration(integration.id, {
              accessToken: newTokens.accessToken,
              expiresAt: newTokens.expiresAt,
            });
          }

          if (!integration.accessToken) {
            return { rows: [] };
          }

          return await fetchGSCTopQueries(integration.accessToken, integration.gscSiteUrl!, start, end, clientId);
        })(),

        // Outcome metrics
        (async () => {
          const profile = await storage.getProfileByUserId(req.user!.id);
          
          if (profile!.role === "Client") {
            const client = await storage.getClientByProfileId(profile!.id);
            if (!client || client.id !== clientId) {
              throw new Error("Access denied");
            }
          }

          const client = await storage.getClientById(clientId);
          if (!client) {
            throw new Error("Client not found");
          }

          const currentPeriodStart = new Date(start);
          const currentPeriodEnd = new Date(end);
          const periodLength = currentPeriodEnd.getTime() - currentPeriodStart.getTime();
          const comparisonPeriodEnd = new Date(currentPeriodStart.getTime() - 24 * 60 * 60 * 1000);
          const comparisonPeriodStart = new Date(comparisonPeriodEnd.getTime() - periodLength);
          const comparisonStart = comparisonPeriodStart.toISOString().split('T')[0];
          const comparisonEnd = comparisonPeriodEnd.toISOString().split('T')[0];

          let totalConversions = 0;
          let totalSpend = 0;
          let totalOrganicClicks = 0;
          let usedGA4Conversions = false;

          const ga4Integration = await storage.getIntegrationByClientId(clientId, 'GA4');
          if (ga4Integration && ga4Integration.ga4PropertyId && ga4Integration.accessToken && ga4Integration.ga4LeadEventName) {
            try {
              let integration = ga4Integration;
              if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
                if (integration.refreshToken) {
                  const newTokens = await refreshAccessToken(integration.refreshToken);
                  integration = await storage.updateIntegration(integration.id, {
                    accessToken: newTokens.accessToken,
                    expiresAt: newTokens.expiresAt,
                  });
                }
              }

              if (integration.accessToken) {
                const keyEventsData = await fetchGA4KeyEvents(
                  integration.accessToken, 
                  integration.ga4PropertyId!, 
                  integration.ga4LeadEventName!, 
                  start, 
                  end,
                  clientId
                );
                totalConversions = keyEventsData.totalEventCount || 0;
                usedGA4Conversions = true;
              }
            } catch (error) {
              console.error("Error fetching GA4 Key Events data:", error);
            }
          }

          if (!usedGA4Conversions) {
            const dailyMetrics = await storage.getMetricsByClientId(clientId);
            if (dailyMetrics && dailyMetrics.length > 0) {
              const startTimestamp = new Date(start).getTime();
              const endTimestamp = new Date(end).getTime();
              const filteredMetrics = dailyMetrics.filter((metric: any) => {
                const metricTimestamp = new Date(metric.date).getTime();
                return metricTimestamp >= startTimestamp && metricTimestamp <= endTimestamp;
              });
              totalConversions = filteredMetrics.reduce((sum: number, metric: any) => sum + (metric.conversions || 0), 0);
            }
          }

          const dailyMetrics = await storage.getMetricsByClientId(clientId);
          if (dailyMetrics && dailyMetrics.length > 0) {
            const startTimestamp = new Date(start).getTime();
            const endTimestamp = new Date(end).getTime();
            const filteredMetrics = dailyMetrics.filter((metric: any) => {
              const metricTimestamp = new Date(metric.date).getTime();
              return metricTimestamp >= startTimestamp && metricTimestamp <= endTimestamp;
            });
            totalSpend = filteredMetrics.reduce((sum: number, metric: any) => sum + parseFloat(metric.spend || '0'), 0);
          }

          const gscIntegration = await storage.getIntegrationByClientId(clientId, 'GSC');
          if (gscIntegration && gscIntegration.gscSiteUrl && gscIntegration.accessToken) {
            try {
              let integration = gscIntegration;
              if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
                if (integration.refreshToken) {
                  const newTokens = await refreshAccessToken(integration.refreshToken);
                  integration = await storage.updateIntegration(integration.id, {
                    accessToken: newTokens.accessToken,
                    expiresAt: newTokens.expiresAt,
                  });
                }
              }

              if (integration.accessToken) {
                const gscData = await fetchGSCData(integration.accessToken, integration.gscSiteUrl!, start, end, clientId);
                totalOrganicClicks = gscData.rows?.reduce((sum: number, row: any) => sum + (row.clicks || 0), 0) || 0;
              }
            } catch (error) {
              console.error("Error fetching GSC data:", error);
            }
          }

          let estimatedPipelineValue = 0;
          const leadValue = parseFloat(client.leadValue || '0');
          
          if (leadValue > 0) {
            estimatedPipelineValue = totalConversions * leadValue;
          } else {
            const leadToOpportunityRate = parseFloat(client.leadToOpportunityRate || '0');
            const opportunityToCloseRate = parseFloat(client.opportunityToCloseRate || '0');
            const averageDealSize = parseFloat(client.averageDealSize || '0');
            estimatedPipelineValue = totalConversions * leadToOpportunityRate * opportunityToCloseRate * averageDealSize;
          }

          const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;

          let comparisonConversions = 0;
          let comparisonSpend = 0;
          let comparisonOrganicClicks = 0;
          let usedGA4ConversionsComparison = false;

          if (ga4Integration && ga4Integration.ga4PropertyId && ga4Integration.accessToken && ga4Integration.ga4LeadEventName) {
            try {
              let integration = ga4Integration;
              if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
                if (integration.refreshToken) {
                  const newTokens = await refreshAccessToken(integration.refreshToken);
                  integration = await storage.updateIntegration(integration.id, {
                    accessToken: newTokens.accessToken,
                    expiresAt: newTokens.expiresAt,
                  });
                }
              }

              if (integration.accessToken) {
                const keyEventsData = await fetchGA4KeyEvents(
                  integration.accessToken,
                  integration.ga4PropertyId!,
                  integration.ga4LeadEventName!,
                  comparisonStart,
                  comparisonEnd,
                  clientId
                );
                comparisonConversions = keyEventsData.totalEventCount || 0;
                usedGA4ConversionsComparison = true;
              }
            } catch (error) {
              console.error("Error fetching comparison GA4 data:", error);
            }
          }

          if (!usedGA4ConversionsComparison && dailyMetrics && dailyMetrics.length > 0) {
            const comparisonStartTimestamp = new Date(comparisonStart).getTime();
            const comparisonEndTimestamp = new Date(comparisonEnd).getTime();
            const filteredMetrics = dailyMetrics.filter((metric: any) => {
              const metricTimestamp = new Date(metric.date).getTime();
              return metricTimestamp >= comparisonStartTimestamp && metricTimestamp <= comparisonEndTimestamp;
            });
            comparisonConversions = filteredMetrics.reduce((sum: number, metric: any) => sum + (metric.conversions || 0), 0);
          }

          if (dailyMetrics && dailyMetrics.length > 0) {
            const comparisonStartTimestamp = new Date(comparisonStart).getTime();
            const comparisonEndTimestamp = new Date(comparisonEnd).getTime();
            const filteredMetrics = dailyMetrics.filter((metric: any) => {
              const metricTimestamp = new Date(metric.date).getTime();
              return metricTimestamp >= comparisonStartTimestamp && metricTimestamp <= comparisonEndTimestamp;
            });
            comparisonSpend = filteredMetrics.reduce((sum: number, metric: any) => sum + parseFloat(metric.spend || '0'), 0);
          }

          if (gscIntegration && gscIntegration.gscSiteUrl && gscIntegration.accessToken) {
            try {
              let integration = gscIntegration;
              if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
                if (integration.refreshToken) {
                  const newTokens = await refreshAccessToken(integration.refreshToken);
                  integration = await storage.updateIntegration(integration.id, {
                    accessToken: newTokens.accessToken,
                    expiresAt: newTokens.expiresAt,
                  });
                }
              }

              if (integration.accessToken) {
                const gscData = await fetchGSCData(integration.accessToken, integration.gscSiteUrl!, comparisonStart, comparisonEnd, clientId);
                comparisonOrganicClicks = gscData.rows?.reduce((sum: number, row: any) => sum + (row.clicks || 0), 0) || 0;
              }
            } catch (error) {
              console.error("Error fetching comparison GSC data:", error);
            }
          }

          const comparisonPipelineValue = leadValue > 0
            ? comparisonConversions * leadValue
            : comparisonConversions * parseFloat(client.leadToOpportunityRate || '0') * parseFloat(client.opportunityToCloseRate || '0') * parseFloat(client.averageDealSize || '0');
          const comparisonCPA = comparisonConversions > 0 ? comparisonSpend / comparisonConversions : 0;

          return {
            conversions: totalConversions,
            estimatedPipelineValue: Math.round(estimatedPipelineValue),
            cpa: Math.round(cpa * 100) / 100,
            organicClicks: totalOrganicClicks,
            spend: totalSpend,
            leadValue: leadValue > 0 ? leadValue : null,
            comparisonPeriodData: {
              conversions: comparisonConversions,
              estimatedPipelineValue: Math.round(comparisonPipelineValue),
              cpa: Math.round(comparisonCPA * 100) / 100,
              organicClicks: comparisonOrganicClicks,
            },
            pipelineCalculation: {
              leadToOpportunityRate: parseFloat(client.leadToOpportunityRate || '0'),
              opportunityToCloseRate: parseFloat(client.opportunityToCloseRate || '0'),
              averageDealSize: parseFloat(client.averageDealSize || '0'),
            }
          };
        })(),
      ]);

      // Aggregate results
      const aggregatedData = {
        ga4: ga4Result.status === 'fulfilled' ? ga4Result.value : { rows: [], rowCount: 0, totals: [] },
        gsc: gscResult.status === 'fulfilled' ? gscResult.value : { rows: [] },
        gscQueries: gscQueriesResult.status === 'fulfilled' ? gscQueriesResult.value : { rows: [] },
        outcomeMetrics: outcomeMetricsResult.status === 'fulfilled' ? outcomeMetricsResult.value : {
          conversions: 0,
          estimatedPipelineValue: 0,
          cpa: 0,
          organicClicks: 0,
          spend: 0,
        },
      };

      // Cache the response for 1 hour
      cache.set(cacheKey, aggregatedData, CACHE_TTL.ONE_HOUR);

      res.json({ ...aggregatedData, cached: false });
    } catch (error: any) {
      console.error("Dashboard summary error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch dashboard summary" });
    }
  });

  // Get GA4 conversions (Key Events) data for a client (MUST come before the general GA4 route)
  app.get("/api/analytics/ga4/:clientId/conversions", requireAuth, requireRole("Client", "Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const { startDate, endDate } = req.query;
      const profile = await storage.getProfileByUserId(req.user!.id);
      
      // Security: Clients can only view their own analytics
      if (profile!.role === "Client") {
        const client = await storage.getClientByProfileId(profile!.id);
        if (!client || client.id !== clientId) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      let integration = await storage.getIntegrationByClientId(clientId, 'GA4');
      
      if (!integration || !integration.ga4PropertyId) {
        return res.status(404).json({ message: "GA4 integration not configured" });
      }

      // Check if lead event name is configured
      if (!integration.ga4LeadEventName) {
        return res.status(400).json({ message: "Lead event name not configured. Please configure it in the integrations page." });
      }

      // Check if token is expired and refresh if needed
      if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
        if (!integration.refreshToken) {
          return res.status(401).json({ message: "Token expired and no refresh token available" });
        }

        const newTokens = await refreshAccessToken(integration.refreshToken);
        integration = await storage.updateIntegration(integration.id, {
          accessToken: newTokens.accessToken,
          expiresAt: newTokens.expiresAt,
        });
      }

      // Default to last 30 days if not specified
      const end = endDate as string || new Date().toISOString().split('T')[0];
      const start = startDate as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      if (!integration.accessToken) {
        return res.status(401).json({ message: "Access token not available" });
      }

      const data = await fetchGA4KeyEvents(integration.accessToken, integration.ga4PropertyId!, integration.ga4LeadEventName!, start, end, clientId);
      res.json(data);
    } catch (error: any) {
      console.error("Fetch GA4 conversions error:", error);
      const message = error.userMessage || error.message || "Failed to fetch GA4 conversions";
      res.status(500).json({ message });
    }
  });

  // Get GA4 acquisition channels data for a client (MUST come before the general GA4 route)
  app.get("/api/analytics/ga4/:clientId/channels", requireAuth, requireRole("Client", "Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const { startDate, endDate } = req.query;
      const profile = await storage.getProfileByUserId(req.user!.id);
      
      // Security: Clients can only view their own analytics
      if (profile!.role === "Client") {
        const client = await storage.getClientByProfileId(profile!.id);
        if (!client || client.id !== clientId) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      let integration = await storage.getIntegrationByClientId(clientId, 'GA4');
      
      if (!integration || !integration.ga4PropertyId) {
        return res.status(404).json({ message: "GA4 integration not configured" });
      }

      // Check if token is expired and refresh if needed
      if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
        if (!integration.refreshToken) {
          return res.status(401).json({ message: "Token expired and no refresh token available" });
        }

        const newTokens = await refreshAccessToken(integration.refreshToken);
        integration = await storage.updateIntegration(integration.id, {
          accessToken: newTokens.accessToken,
          expiresAt: newTokens.expiresAt,
        });
      }

      // Default to last 30 days if not specified
      const end = endDate as string || new Date().toISOString().split('T')[0];
      const start = startDate as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      if (!integration.accessToken) {
        return res.status(401).json({ message: "Access token not available" });
      }

      const data = await fetchGA4AcquisitionChannels(integration.accessToken, integration.ga4PropertyId!, start, end, clientId);
      res.json(data);
    } catch (error: any) {
      console.error("Fetch GA4 acquisition channels error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch GA4 acquisition channels" });
    }
  });

  // Get GA4 analytics data for a client
  app.get("/api/analytics/ga4/:clientId", requireAuth, requireRole("Client", "Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const { startDate, endDate } = req.query;

      let integration = await storage.getIntegrationByClientId(clientId, 'GA4');
      
      if (!integration || !integration.ga4PropertyId) {
        return res.status(404).json({ message: "GA4 integration not configured" });
      }

      // Check if token is expired and refresh if needed
      if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
        if (!integration.refreshToken) {
          return res.status(401).json({ message: "Token expired and no refresh token available" });
        }

        const newTokens = await refreshAccessToken(integration.refreshToken);
        integration = await storage.updateIntegration(integration.id, {
          accessToken: newTokens.accessToken,
          expiresAt: newTokens.expiresAt,
        });
      }

      // Default to last 30 days if not specified
      const end = endDate as string || new Date().toISOString().split('T')[0];
      const start = startDate as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      if (!integration.accessToken) {
        return res.status(401).json({ message: "Access token not available" });
      }

      const data = await fetchGA4Data(integration.accessToken, integration.ga4PropertyId!, start, end, clientId);
      
      // Log GA4 response details
      const logData = {
        propertyId: integration.ga4PropertyId,
        dateRange: `${start} to ${end}`,
        rowCount: data.rowCount,
        totalRows: data.rows?.length || 0,
        hasTotals: !!data.totals,
        totalsLength: data.totals?.length || 0,
        totalMetrics: data.totals?.[0]?.metricValues?.map((m: any) => m.value) || [],
        sampleRow: data.rows?.[0]?.metricValues?.map((m: any) => m.value) || []
      };
      
      console.error('=== GA4 DATA RESPONSE ===', JSON.stringify(logData, null, 2));
      
      res.json(data);
    } catch (error: any) {
      console.error("Fetch GA4 analytics error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch GA4 analytics" });
    }
  });

  // Get GSC top queries for a client (MUST come before general GSC route)
  app.get("/api/analytics/gsc/:clientId/queries", requireAuth, requireRole("Client", "Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const { startDate, endDate } = req.query;
      const profile = await storage.getProfileByUserId(req.user!.id);
      
      // Security: Clients can only view their own analytics
      if (profile!.role === "Client") {
        const client = await storage.getClientByProfileId(profile!.id);
        if (!client || client.id !== clientId) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      let integration = await storage.getIntegrationByClientId(clientId, 'GSC');
      
      if (!integration || !integration.gscSiteUrl) {
        return res.status(404).json({ message: "Search Console integration not configured" });
      }

      // Check if token is expired and refresh if needed
      if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
        if (!integration.refreshToken) {
          return res.status(401).json({ message: "Token expired and no refresh token available" });
        }

        const newTokens = await refreshAccessToken(integration.refreshToken);
        integration = await storage.updateIntegration(integration.id, {
          accessToken: newTokens.accessToken,
          expiresAt: newTokens.expiresAt,
        });
      }

      // Default to last 30 days if not specified
      const end = endDate as string || new Date().toISOString().split('T')[0];
      const start = startDate as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      if (!integration.accessToken) {
        return res.status(401).json({ message: "Access token not available" });
      }

      const data = await fetchGSCTopQueries(integration.accessToken, integration.gscSiteUrl!, start, end, clientId);
      console.log('=== GSC TOP QUERIES RESPONSE ===', JSON.stringify({
        siteUrl: integration.gscSiteUrl,
        dateRange: `${start} to ${end}`,
        rowCount: data.rows?.length || 0,
        sampleRow: data.rows?.[0] || null
      }, null, 2));
      res.json(data);
    } catch (error: any) {
      console.error("Fetch GSC top queries error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch top queries" });
    }
  });

  // Get GSC analytics data for a client
  app.get("/api/analytics/gsc/:clientId", requireAuth, requireRole("Client", "Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const { startDate, endDate } = req.query;

      let integration = await storage.getIntegrationByClientId(clientId, 'GSC');
      
      if (!integration || !integration.gscSiteUrl) {
        return res.status(404).json({ message: "Search Console integration not configured" });
      }

      // Check if token is expired and refresh if needed
      if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
        if (!integration.refreshToken) {
          return res.status(401).json({ message: "Token expired and no refresh token available" });
        }

        const newTokens = await refreshAccessToken(integration.refreshToken);
        integration = await storage.updateIntegration(integration.id, {
          accessToken: newTokens.accessToken,
          expiresAt: newTokens.expiresAt,
        });
      }

      // Default to last 30 days if not specified
      const end = endDate as string || new Date().toISOString().split('T')[0];
      const start = startDate as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      if (!integration.accessToken) {
        return res.status(401).json({ message: "Access token not available" });
      }

      const data = await fetchGSCData(integration.accessToken, integration.gscSiteUrl!, start, end, clientId);
      res.json(data);
    } catch (error: any) {
      console.error("Fetch GSC analytics error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch Search Console analytics" });
    }
  });

  // Get outcome metrics (Pipeline Value, CPA, conversions, organic clicks) for Reports page
  app.get("/api/analytics/outcome-metrics/:clientId", requireAuth, requireRole("Client", "Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const { startDate, endDate } = req.query;
      const profile = await storage.getProfileByUserId(req.user!.id);
      
      // Security: Clients can only view their own analytics
      if (profile!.role === "Client") {
        const client = await storage.getClientByProfileId(profile!.id);
        if (!client || client.id !== clientId) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      // Get client data for pipeline calculation
      const client = await storage.getClientById(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // Default to last 30 days if not specified
      const end = endDate as string || new Date().toISOString().split('T')[0];
      const start = startDate as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Calculate comparison period (previous period of same length)
      const currentPeriodStart = new Date(start);
      const currentPeriodEnd = new Date(end);
      const periodLength = currentPeriodEnd.getTime() - currentPeriodStart.getTime();
      const comparisonPeriodEnd = new Date(currentPeriodStart.getTime() - 24 * 60 * 60 * 1000); // Day before current period
      const comparisonPeriodStart = new Date(comparisonPeriodEnd.getTime() - periodLength);
      const comparisonStart = comparisonPeriodStart.toISOString().split('T')[0];
      const comparisonEnd = comparisonPeriodEnd.toISOString().split('T')[0];

      // Initialize metrics
      let totalConversions = 0;
      let totalSpend = 0;
      let totalOrganicClicks = 0;
      let usedGA4Conversions = false;

      // Try to get conversions from GA4 Key Events
      const ga4Integration = await storage.getIntegrationByClientId(clientId, 'GA4');
      if (ga4Integration && ga4Integration.ga4PropertyId && ga4Integration.accessToken && ga4Integration.ga4LeadEventName) {
        try {
          // Check if token is expired and refresh if needed
          let integration = ga4Integration;
          if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
            if (integration.refreshToken) {
              const newTokens = await refreshAccessToken(integration.refreshToken);
              integration = await storage.updateIntegration(integration.id, {
                accessToken: newTokens.accessToken,
                expiresAt: newTokens.expiresAt,
              });
            }
          }

          // Fetch actual GA4 Key Events data based on configured lead event name
          if (!integration.accessToken) {
            throw new Error("Access token not available after refresh");
          }
          
          const keyEventsData = await fetchGA4KeyEvents(
            integration.accessToken, 
            integration.ga4PropertyId!, 
            integration.ga4LeadEventName!, 
            start, 
            end,
            clientId
          );
          
          // Get total conversions from the response
          totalConversions = keyEventsData.totalEventCount || 0;
          usedGA4Conversions = true;
          
          console.log(`GA4 Key Events data fetched successfully: ${totalConversions} conversions for event "${integration.ga4LeadEventName}"`);
        } catch (error) {
          console.error("Error fetching GA4 Key Events data:", error);
        }
      }

      // Fall back to dailyMetrics ONLY if GA4 conversions were not successfully fetched
      if (!usedGA4Conversions) {
        const dailyMetrics = await storage.getMetricsByClientId(clientId);
        if (dailyMetrics && dailyMetrics.length > 0) {
          const startTimestamp = new Date(start).getTime();
          const endTimestamp = new Date(end).getTime();
          const filteredMetrics = dailyMetrics.filter((metric: any) => {
            const metricTimestamp = new Date(metric.date).getTime();
            return metricTimestamp >= startTimestamp && metricTimestamp <= endTimestamp;
          });
          totalConversions = filteredMetrics.reduce((sum: number, metric: any) => sum + (metric.conversions || 0), 0);
          console.log(`Using dailyMetrics fallback: ${totalConversions} conversions`);
        }
      }

      // Get spend from dailyMetrics table (spend is still tracked there)
      const dailyMetrics = await storage.getMetricsByClientId(clientId);
      if (dailyMetrics && dailyMetrics.length > 0) {
        const startTimestamp = new Date(start).getTime();
        const endTimestamp = new Date(end).getTime();
        const filteredMetrics = dailyMetrics.filter((metric: any) => {
          const metricTimestamp = new Date(metric.date).getTime();
          return metricTimestamp >= startTimestamp && metricTimestamp <= endTimestamp;
        });
        totalSpend = filteredMetrics.reduce((sum: number, metric: any) => sum + parseFloat(metric.spend || '0'), 0);
      }

      // Get organic clicks from GSC
      const gscIntegration = await storage.getIntegrationByClientId(clientId, 'GSC');
      if (gscIntegration && gscIntegration.gscSiteUrl && gscIntegration.accessToken) {
        try {
          // Check if token is expired and refresh if needed
          let integration = gscIntegration;
          if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
            if (integration.refreshToken) {
              const newTokens = await refreshAccessToken(integration.refreshToken);
              integration = await storage.updateIntegration(integration.id, {
                accessToken: newTokens.accessToken,
                expiresAt: newTokens.expiresAt,
              });
            }
          }

          if (integration.accessToken) {
            const gscData = await fetchGSCData(integration.accessToken, integration.gscSiteUrl!, start, end, clientId);
            totalOrganicClicks = gscData.rows?.reduce((sum: number, row: any) => sum + (row.clicks || 0), 0) || 0;
          }
        } catch (error) {
          console.error("Error fetching GSC data:", error);
        }
      }

      // Calculate Pipeline Value
      let estimatedPipelineValue = 0;
      const leadValue = parseFloat(client.leadValue || '0');
      
      if (leadValue > 0) {
        // New simple calculation: Pipeline = Conversions × Lead Value
        estimatedPipelineValue = totalConversions * leadValue;
      } else {
        // Fallback to old complex calculation for backward compatibility
        const leadToOpportunityRate = parseFloat(client.leadToOpportunityRate || '0');
        const opportunityToCloseRate = parseFloat(client.opportunityToCloseRate || '0');
        const averageDealSize = parseFloat(client.averageDealSize || '0');
        estimatedPipelineValue = totalConversions * leadToOpportunityRate * opportunityToCloseRate * averageDealSize;
      }

      // Calculate CPA (Cost Per Acquisition)
      const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;

      // Now fetch comparison period data
      let comparisonConversions = 0;
      let comparisonSpend = 0;
      let comparisonOrganicClicks = 0;
      let usedGA4ConversionsComparison = false;

      // Try to get comparison conversions from GA4
      if (ga4Integration && ga4Integration.ga4PropertyId && ga4Integration.accessToken && ga4Integration.ga4LeadEventName) {
        try {
          let integration = ga4Integration;
          if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
            if (integration.refreshToken) {
              const newTokens = await refreshAccessToken(integration.refreshToken);
              integration = await storage.updateIntegration(integration.id, {
                accessToken: newTokens.accessToken,
                expiresAt: newTokens.expiresAt,
              });
            }
          }

          if (integration.accessToken) {
            const keyEventsData = await fetchGA4KeyEvents(
              integration.accessToken,
              integration.ga4PropertyId!,
              integration.ga4LeadEventName!,
              comparisonStart,
              comparisonEnd,
              clientId
            );
            comparisonConversions = keyEventsData.totalEventCount || 0;
            usedGA4ConversionsComparison = true;
          }
        } catch (error) {
          console.error("Error fetching comparison GA4 data:", error);
        }
      }

      // Fallback to dailyMetrics for comparison period
      if (!usedGA4ConversionsComparison && dailyMetrics && dailyMetrics.length > 0) {
        const comparisonStartTimestamp = new Date(comparisonStart).getTime();
        const comparisonEndTimestamp = new Date(comparisonEnd).getTime();
        const filteredMetrics = dailyMetrics.filter((metric: any) => {
          const metricTimestamp = new Date(metric.date).getTime();
          return metricTimestamp >= comparisonStartTimestamp && metricTimestamp <= comparisonEndTimestamp;
        });
        comparisonConversions = filteredMetrics.reduce((sum: number, metric: any) => sum + (metric.conversions || 0), 0);
      }

      // Get comparison spend from dailyMetrics
      if (dailyMetrics && dailyMetrics.length > 0) {
        const comparisonStartTimestamp = new Date(comparisonStart).getTime();
        const comparisonEndTimestamp = new Date(comparisonEnd).getTime();
        const filteredMetrics = dailyMetrics.filter((metric: any) => {
          const metricTimestamp = new Date(metric.date).getTime();
          return metricTimestamp >= comparisonStartTimestamp && metricTimestamp <= comparisonEndTimestamp;
        });
        comparisonSpend = filteredMetrics.reduce((sum: number, metric: any) => sum + parseFloat(metric.spend || '0'), 0);
      }

      // Get comparison organic clicks from GSC
      if (gscIntegration && gscIntegration.gscSiteUrl && gscIntegration.accessToken) {
        try {
          let integration = gscIntegration;
          if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
            if (integration.refreshToken) {
              const newTokens = await refreshAccessToken(integration.refreshToken);
              integration = await storage.updateIntegration(integration.id, {
                accessToken: newTokens.accessToken,
                expiresAt: newTokens.expiresAt,
              });
            }
          }

          if (integration.accessToken) {
            const gscData = await fetchGSCData(integration.accessToken, integration.gscSiteUrl!, comparisonStart, comparisonEnd, clientId);
            comparisonOrganicClicks = gscData.rows?.reduce((sum: number, row: any) => sum + (row.clicks || 0), 0) || 0;
          }
        } catch (error) {
          console.error("Error fetching comparison GSC data:", error);
        }
      }

      // Calculate comparison period metrics
      const comparisonPipelineValue = leadValue > 0
        ? comparisonConversions * leadValue
        : comparisonConversions * parseFloat(client.leadToOpportunityRate || '0') * parseFloat(client.opportunityToCloseRate || '0') * parseFloat(client.averageDealSize || '0');
      const comparisonCPA = comparisonConversions > 0 ? comparisonSpend / comparisonConversions : 0;

      res.json({
        conversions: totalConversions,
        estimatedPipelineValue: Math.round(estimatedPipelineValue),
        cpa: Math.round(cpa * 100) / 100,
        organicClicks: totalOrganicClicks,
        spend: totalSpend,
        leadValue: leadValue > 0 ? leadValue : null,
        comparisonPeriodData: {
          conversions: comparisonConversions,
          estimatedPipelineValue: Math.round(comparisonPipelineValue),
          cpa: Math.round(comparisonCPA * 100) / 100,
          organicClicks: comparisonOrganicClicks,
        },
        pipelineCalculation: {
          leadToOpportunityRate: parseFloat(client.leadToOpportunityRate || '0'),
          opportunityToCloseRate: parseFloat(client.opportunityToCloseRate || '0'),
          averageDealSize: parseFloat(client.averageDealSize || '0'),
        }
      });
    } catch (error: any) {
      console.error("Fetch outcome metrics error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch outcome metrics" });
    }
  });

  // Client Objectives API

  // Get objectives for a client (Admin only)
  app.get("/api/agency/clients/:clientId/objectives", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const objectives = await storage.getObjectivesByClientId(clientId);
      res.json(objectives);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get active objectives for logged-in client
  app.get("/api/client/objectives", requireAuth, requireRole("Client"), async (req: AuthRequest, res) => {
    try {
      const profile = await storage.getProfileByUserId(req.user!.id);
      const client = await storage.getClientByProfileId(profile!.id);
      
      if (!client) {
        return res.json([]);
      }

      const objectives = await storage.getActiveObjectivesByClientId(client.id);
      res.json(objectives);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create objective for a client (Admin only)
  app.post("/api/agency/clients/:clientId/objectives", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const { description, targetMetric } = req.body;

      if (!description || !targetMetric) {
        return res.status(400).json({ message: "description and targetMetric are required" });
      }

      const objective = await storage.createObjective({
        clientId,
        description,
        targetMetric,
      });

      res.status(201).json(objective);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update objective (Admin only)
  app.patch("/api/agency/objectives/:id", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const updated = await storage.updateObjective(id, updates);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete objective (Admin only)
  app.delete("/api/agency/objectives/:id", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      await storage.deleteObjective(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // AI Chat & Data Analysis API (accessible by Client, Admin, and Staff)
  
  // Analyze data on demand
  app.post("/api/ai/analyze-data", requireAuth, async (req: AuthRequest, res) => {
    try {
      const analyzeDataSchema = z.object({
        contextData: z.any(),
        question: z.string().min(1, "Question is required"),
      });

      const validationResult = analyzeDataSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: "Invalid request data", errors: validationResult.error.errors });
      }

      const { contextData, question } = validationResult.data;
      const profile = await storage.getProfileByUserId(req.user!.id);
      let client;

      // If Admin/Staff, get client from contextData.clientId
      if (profile?.role === "Admin" || profile?.role === "Staff") {
        if (!contextData?.clientId) {
          return res.status(400).json({ message: "Client ID required for Admin/Staff users" });
        }
        client = await storage.getClientById(contextData.clientId);
      } else {
        // If Client, get their own client data
        client = await storage.getClientByProfileId(profile!.id);
      }

      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      console.log("[AI Analysis Request] Client:", client.companyName);
      console.log("[AI Analysis Request] Question:", question);
      console.log("[AI Analysis Request] Context Data:", JSON.stringify(contextData, null, 2));

      const aiProvider = await getAIProvider(client.agencyId);
      const analysis = await aiProvider.analyzeDataOnDemand(
        client.companyName,
        contextData,
        question
      );

      console.log("[AI Analysis Response]:", JSON.stringify(analysis, null, 2));
      res.json(analysis);
    } catch (error: any) {
      console.error("On-demand AI analysis error:", error);
      res.status(500).json({ message: error.message || "Failed to get analysis" });
    }
  });

  // Request action on AI recommendation (accessible by Client, Admin, and Staff)
  app.post("/api/ai/request-action", requireAuth, async (req: AuthRequest, res) => {
    try {
      const recommendationSchema = z.object({
        title: z.string().min(1),
        observation: z.string().min(1),
        proposedAction: z.string().min(1),
        impact: z.enum(["High", "Medium", "Low"]),
        estimatedCost: z.number().min(0),
        triggerMetric: z.string().min(1),
        baselineValue: z.number(),
        clientId: z.string().optional(), // Optional for Admin/Staff users
      });

      const validationResult = recommendationSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: "Invalid recommendation data", errors: validationResult.error.errors });
      }

      const recommendation = validationResult.data;
      const profile = await storage.getProfileByUserId(req.user!.id);
      let client;

      // If Admin/Staff, get client from request body
      if (profile?.role === "Admin" || profile?.role === "Staff") {
        if (!recommendation.clientId) {
          return res.status(400).json({ message: "Client ID required for Admin/Staff users" });
        }
        client = await storage.getClientById(recommendation.clientId);
      } else {
        // If Client, get their own client data
        client = await storage.getClientByProfileId(profile!.id);
      }

      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // Admin/Staff creates as Draft for review and editing, Client creates as Needs Review
      const status = (profile?.role === "Admin" || profile?.role === "Staff") ? "Draft" : "Needs Review";
      const sentToClient = (profile?.role === "Admin" || profile?.role === "Staff") ? "false" : "true";
      
      const initiative = await storage.createInitiative({
        clientId: client.id,
        title: recommendation.title,
        observation: recommendation.observation,
        proposedAction: recommendation.proposedAction,
        cost: recommendation.estimatedCost?.toString() || "0",
        impact: recommendation.impact,
        status: status,
        triggerMetric: recommendation.triggerMetric || "",
        baselineValue: recommendation.baselineValue?.toString() || "0",
        sentToClient: sentToClient,
      });

      const message = (profile?.role === "Admin" || profile?.role === "Staff") 
        ? "Recommendation saved as draft. You can edit and send it from the AI Recommendations page."
        : "Recommendation submitted for review.";
      
      res.status(201).json({ initiativeId: initiative.id, message });
    } catch (error: any) {
      console.error("AI request action error:", error);
      res.status(500).json({ message: error.message || "Failed to submit recommendation" });
    }
  });

  // Client Messages API

  // Send message from client to account manager
  app.post("/api/client/messages", requireAuth, requireRole("Client"), async (req: AuthRequest, res) => {
    try {
      const profile = await storage.getProfileByUserId(req.user!.id);
      const client = await storage.getClientByProfileId(profile!.id);
      
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      const { message } = req.body;
      
      if (!message || !message.trim()) {
        return res.status(400).json({ message: "Message is required" });
      }

      const newMessage = await storage.createMessage({
        clientId: client.id,
        message: message.trim(),
        senderRole: "Client",
      });

      // Create notification for admin users (don't let notification failures break message creation)
      try {
        // Only notify admins in the same agency as this client
        const adminUsers = client.agencyId 
          ? await storage.getAllUsersWithProfiles(client.agencyId)
          : [];
        const admins = adminUsers.filter(u => u.profile?.role === "Admin");
        
        for (const admin of admins) {
          await storage.createNotification({
            userId: admin.id,
            type: "client_message",
            title: "New Client Message",
            message: `${profile!.fullName} from ${client.companyName} sent a new message`,
            link: "/agency/messages",
            isRead: "false",
            isArchived: "false",
          });
        }
      } catch (notificationError) {
        console.error("Failed to create client message notification:", notificationError);
      }

      res.status(201).json(newMessage);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get messages for logged-in client
  app.get("/api/client/messages", requireAuth, requireRole("Client"), async (req: AuthRequest, res) => {
    try {
      const profile = await storage.getProfileByUserId(req.user!.id);
      const client = await storage.getClientByProfileId(profile!.id);
      
      if (!client) {
        return res.json([]);
      }

      const messages = await storage.getMessagesByClientId(client.id);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get all messages (Admin only)
  app.get("/api/agency/messages", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      if (!req.user!.agencyId) {
        return res.status(403).json({ message: "Agency association required" });
      }
      const messages = await storage.getAllMessages(req.user!.agencyId);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // SSE endpoint for real-time message updates (Admin only)
  app.get("/api/agency/messages/stream", async (req, res) => {
    try {
      // EventSource doesn't support custom headers, so get token from query param
      const token = req.query.token as string;
      
      if (!token) {
        res.status(401).json({ message: "Authentication token required" });
        return;
      }

      // Verify token using Supabase
      const { supabaseAdmin } = await import("./lib/supabase");
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      
      if (error || !user) {
        res.status(401).json({ message: "Invalid or expired token" });
        return;
      }

      // Get user profile and check role
      const profile = await storage.getProfileByUserId(user.id);
      
      if (!profile || profile.role !== "Admin") {
        res.status(403).json({ message: "Admin access required" });
        return;
      }

      const agencyId = profile.agencyId;
      
      if (!agencyId) {
        res.status(403).json({ message: "Agency association required" });
        return;
      }

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      // Send initial connection message
      res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

      // Handler for new messages
      const messageHandler = (message: any) => {
        // Only send messages for this agency
        if (message.agencyId === agencyId) {
          res.write(`data: ${JSON.stringify({ type: 'message', data: message })}\n\n`);
        }
      };

      // Listen for message events
      messageEmitter.on('new-message', messageHandler);

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeat = setInterval(() => {
        res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
      }, 30000);

      // Cleanup on connection close
      req.on('close', () => {
        clearInterval(heartbeat);
        messageEmitter.off('new-message', messageHandler);
      });
    } catch (error: any) {
      console.error('[SSE] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Mark message as read (Admin only)
  app.patch("/api/agency/messages/:id/read", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      await storage.markMessageAsRead(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Send message (supports clientId in body)
  app.post("/api/agency/messages", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const { clientId, message, senderRole } = req.body;
      
      if (!message || !message.trim()) {
        return res.status(400).json({ message: "Message is required" });
      }

      if (!clientId) {
        return res.status(400).json({ message: "Client ID is required" });
      }

      const newMessage = await storage.createMessage({
        clientId,
        message: message.trim(),
        senderRole: senderRole || "Admin",
      });

      // Get client to emit agencyId with the message
      const client = await storage.getClientById(clientId);
      if (client) {
        messageEmitter.emit('new-message', { ...newMessage, agencyId: client.agencyId });
      }

      res.status(201).json(newMessage);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Send message from admin to client (legacy route with clientId in URL)
  app.post("/api/agency/messages/:clientId", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const { message } = req.body;
      
      if (!message || !message.trim()) {
        return res.status(400).json({ message: "Message is required" });
      }

      const newMessage = await storage.createMessage({
        clientId,
        message: message.trim(),
        senderRole: "Admin",
      });

      // Get client to emit agencyId with the message
      const client = await storage.getClientById(clientId);
      if (client) {
        messageEmitter.emit('new-message', { ...newMessage, agencyId: client.agencyId });
      }

      res.status(201).json(newMessage);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Mark message as read (Admin only)
  app.post("/api/agency/messages/:messageId/mark-read", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const { messageId } = req.params;
      await storage.markMessageAsRead(messageId);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Mark all messages for a client as read (Admin only)
  app.post("/api/agency/messages/client/:clientId/mark-all-read", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const messages = await storage.getMessagesByClientId(clientId);
      await Promise.all(
        messages
          .filter(m => m.isRead === "false" && m.senderRole === "Client")
          .map(m => storage.markMessageAsRead(m.id))
      );
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Analyze conversation with AI (Admin only)
  app.post("/api/agency/messages/analyze/:clientId", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      
      // Get client and messages
      const client = await storage.getClientById(clientId);
      const messages = await storage.getMessagesByClientId(clientId);
      
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      if (messages.length === 0) {
        return res.status(400).json({ message: "No messages to analyze" });
      }

      // Format conversation for AI
      const conversationText = messages
        .map(m => `${m.senderRole === "Client" ? "Client" : "Agency"}: ${m.message}`)
        .join("\n");

      // Generate AI analysis using GoogleGenAI
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
      
      const prompt = `Analyze this conversation between an agency and their client (${client.companyName}).

Conversation:
${conversationText}

Provide a brief analysis covering:
1. Main topics and concerns discussed
2. Client sentiment and engagement level
3. Action items or follow-ups needed
4. Potential opportunities for strategic initiatives or recommendations

Keep the analysis concise and actionable (2-3 paragraphs).`;

      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: prompt,
      });
      const analysis = result.text;

      res.json({ analysis, suggestions: [] });
    } catch (error: any) {
      console.error("Error analyzing conversation:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get notification counts (Admin only)
  app.get("/api/agency/notifications/counts", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      if (!req.user!.agencyId) {
        return res.status(403).json({ message: "Agency association required" });
      }
      const counts = await storage.getNotificationCounts(req.user!.agencyId);
      res.json(counts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Mark initiative responses as viewed (Admin only)
  app.post("/api/agency/initiatives/mark-viewed", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      await storage.markInitiativeResponsesViewed();
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Notification Center Endpoints
  // Get all notifications for current user
  app.get("/api/notifications", requireAuth, async (req: AuthRequest, res) => {
    try {
      const isArchived = req.query.archived === 'true';
      const notifications = await storage.getNotificationsByUserId(req.user!.id, isArchived);
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get unread notification count
  app.get("/api/notifications/unread-count", requireAuth, async (req: AuthRequest, res) => {
    try {
      const count = await storage.getUnreadNotificationCount(req.user!.id);
      res.json({ count });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Mark notification as read
  app.post("/api/notifications/:id/mark-read", requireAuth, async (req: AuthRequest, res) => {
    try {
      await storage.markNotificationAsRead(req.params.id, req.user!.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Archive notification
  app.post("/api/notifications/:id/archive", requireAuth, async (req: AuthRequest, res) => {
    try {
      await storage.archiveNotification(req.params.id, req.user!.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Mark all notifications as read
  app.post("/api/notifications/mark-all-read", requireAuth, async (req: AuthRequest, res) => {
    try {
      await storage.markAllNotificationsAsRead(req.user!.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create client user (Admin only)
  app.post("/api/agency/clients/create-user", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      // Validate request body with schema
      const validatedData = createClientUserSchema.parse(req.body);
      const { email, password, fullName, companyName } = validatedData;

      // Use robust provisioning service with compensation logic
      const { provisionUser } = await import("./lib/user-provisioning");
      
      // Resolve agency context (SuperAdmin must provide agencyId in body)
      const { agencyId } = resolveAgencyContext(req, { requireBodyField: 'agencyId' });
      
      const result = await provisionUser({
        email,
        password,
        fullName,
        role: "Client",
        agencyId: agencyId!,
        clientData: {
          companyName
        }
      });

      res.status(201).json({ 
        message: "Client created successfully",
        client: { 
          id: result.clientId!, 
          companyName: companyName,
          user: { 
            email: email,
            fullName: fullName
          }
        }
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        });
      }
      console.error("Client creation error:", error);
      res.status(500).json({ message: error.message || "Client creation failed" });
    }
  });

  // Get all users (Admin only)
  app.get("/api/agency/users", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const { agencyId } = resolveAgencyContext(req, { allowQueryParam: true });
      const users = await storage.getAllUsersWithProfiles(agencyId);
      res.json(users);
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ message: error.message });
      }
      console.error("Get users error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch users" });
    }
  });

  // Update user role (Admin only)
  app.patch("/api/agency/users/:userId/role", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      if (!["Client", "Staff", "Admin"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      await storage.updateUserRole(userId, role);
      res.json({ message: "User role updated successfully" });
    } catch (error: any) {
      console.error("Update user role error:", error);
      res.status(500).json({ message: error.message || "Failed to update user role" });
    }
  });

  // Delete user (Admin only)
  app.delete("/api/agency/users/:userId", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const { userId } = req.params;
      
      // Prevent admin from deleting themselves
      if (req.user?.id === userId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      // Use Supabase Auth delete function (not legacy storage.deleteUser)
      const { deleteUser } = await import("./lib/supabase-auth");
      await deleteUser(userId);
      
      res.json({ message: "User deleted successfully" });
    } catch (error: any) {
      console.error("Delete user error:", error);
      res.status(500).json({ message: error.message || "Failed to delete user" });
    }
  });

  // Create staff or admin user (Admin only)
  app.post("/api/agency/users/create", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      // Validate request body with schema
      const validatedData = createStaffAdminUserSchema.parse(req.body);
      const { email, password, fullName, role } = validatedData;

      // Use robust provisioning service with compensation logic
      const { provisionUser } = await import("./lib/user-provisioning");
      
      // Resolve agency context (SuperAdmin must provide agencyId in body)
      const { agencyId } = resolveAgencyContext(req, { requireBodyField: 'agencyId' });
      
      const result = await provisionUser({
        email,
        password,
        fullName,
        role,
        agencyId: agencyId!
      });

      res.status(201).json({ 
        message: `${role} user created successfully`,
        user: { 
          id: result.profileId,
          email: email,
          fullName: fullName,
          role: role
        }
      });
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ message: error.message });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        });
      }
      console.error("User creation error:", error);
      res.status(500).json({ message: error.message || "User creation failed" });
    }
  });

  // TEST ENDPOINT: Create user with specific role (development only)
  // This endpoint bypasses normal security restrictions for testing purposes
  if (process.env.NODE_ENV === "development") {
    app.post("/api/test/create-user", async (req, res) => {
      try {
        const { email, password, fullName, role, companyName, agencyId: requestedAgencyId } = req.body;
        
        console.log(`[TEST CREATE USER] Request: email=${email}, role=${role}, requestedAgencyId=${requestedAgencyId}`);
        
        // Use robust provisioning service with compensation logic
        const { provisionUser } = await import("./lib/user-provisioning");
        
        // Determine agencyId: use requested if provided, otherwise default for Client users
        let agencyId: string | undefined = requestedAgencyId;
        if (!agencyId && (role === "Client" || !role)) {
          const defaultAgency = await storage.getDefaultAgency();
          if (!defaultAgency) {
            return res.status(500).json({ message: "System configuration error: No default agency found" });
          }
          agencyId = defaultAgency.id;
          console.log(`[TEST CREATE USER] Using default agency: ${agencyId}`);
        } else {
          console.log(`[TEST CREATE USER] Using requested agency: ${agencyId}`);
        }
        
        const result = await provisionUser({
          email,
          password,
          fullName,
          role: role || "Client",
          agencyId: agencyId || null,
          clientData: companyName ? { companyName } : undefined
        });
        
        console.log(`[TEST CREATE USER] Profile created with ID: ${result.profileId}`);

        res.status(201).json({ 
          message: "Test user created successfully",
          user: { id: result.profileId, email: email },
          profile: { id: result.profileId, fullName: fullName, role: role || "Client", agencyId }
        });
      } catch (error: any) {
        console.error("Test user creation error:", error);
        res.status(500).json({ message: error.message || "User creation failed" });
      }
    });
  }

  // Get client notification counts (Client only)
  app.get("/api/client/notifications/counts", requireAuth, requireRole("Client"), async (req: AuthRequest, res) => {
    try {
      const profile = await storage.getProfileByUserId(req.user!.id);
      const client = await storage.getClientByProfileId(profile!.id);
      
      if (!client) {
        return res.json({ unreadMessages: 0, newRecommendations: 0 });
      }

      const counts = await storage.getClientNotificationCounts(client.id);
      res.json(counts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get staff notification counts (Staff only)
  app.get("/api/staff/notifications/counts", requireAuth, requireRole("Staff"), async (req: AuthRequest, res) => {
    try {
      const profile = await storage.getProfileByUserId(req.user!.id);
      
      if (!profile) {
        return res.json({ newTasks: 0, highPriorityTasks: 0 });
      }

      const counts = await storage.getStaffNotificationCounts(profile.id);
      res.json(counts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Generate short-lived print token (requires authentication)
  app.post("/api/proposals/:id/print-token", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      
      // Verify user has access to this proposal
      const proposal = await storage.getProposalById(id);
      
      if (!proposal) {
        return res.status(404).json({ message: "Proposal not found" });
      }
      
      if (proposal.agencyId !== req.user!.agencyId) {
        return res.status(403).json({ message: "You do not have permission to access this proposal" });
      }
      
      if (req.user!.role !== 'Admin') {
        return res.status(403).json({ message: "Only admins can export proposals" });
      }
      
      // Generate short-lived print token
      const { generatePrintToken } = await import('./lib/print-tokens');
      const printToken = generatePrintToken(
        id,
        req.user!.id,
        req.user!.agencyId,
        req.user!.role
      );
      
      res.json({ token: printToken });
    } catch (error: any) {
      console.error("Generate print token error:", error);
      res.status(500).json({ message: error.message || "Failed to generate print token" });
    }
  });

  // Proposal print endpoint (no auth middleware - validates short-lived token)
  // Note: Using /api/proposals instead of /api/crm to avoid the requireAuth middleware
  app.get("/api/proposals/:id/print", async (req, res) => {
    try {
      const { id } = req.params;
      const token = req.query.token as string;
      
      if (!token) {
        return res.status(401).send('<html><body><h1>Unauthorized</h1><p>Print token required.</p></body></html>');
      }

      // Validate short-lived print token
      const { validatePrintToken } = await import('./lib/print-tokens');
      const tokenData = validatePrintToken(token, id);
      
      if (!tokenData) {
        return res.status(401).send('<html><body><h1>Unauthorized</h1><p>Invalid or expired print token.</p></body></html>');
      }
      
      // Fetch proposal and verify tenant isolation
      const proposal = await storage.getProposalById(id);
      
      if (!proposal) {
        return res.status(404).send('<html><body><h1>Not Found</h1><p>Proposal not found.</p></body></html>');
      }
      
      // Critical: Verify token's agency matches proposal's agency (tenant isolation)
      if (proposal.agencyId !== tokenData.agencyId) {
        return res.status(403).send('<html><body><h1>Forbidden</h1><p>Invalid print token for this proposal.</p></body></html>');
      }

      // Fetch sections
      const sections = await storage.getProposalSectionsByProposalId(id);
      
      // Fetch deal and contact info
      const deal = await storage.getDealById(proposal.dealId);
      let contact = null;
      if (deal?.contactId) {
        contact = await storage.getContactById(deal.contactId);
      }

      // Process Markdown in section content
      const { marked } = await import('marked');
      const processedSections = sections.map(section => ({
        ...section,
        content: marked.parse(section.content) as string
      }));

      // Generate print-optimized HTML
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>${proposal.name}</title>
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                line-height: 1.6;
                color: #1a1a1a;
                padding: 60px 80px;
                background: white;
                max-width: 1000px;
                margin: 0 auto;
              }
              
              .print-button {
                position: fixed;
                top: 20px;
                right: 20px;
                background: #0a84ff;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                box-shadow: 0 2px 8px rgba(10, 132, 255, 0.3);
                transition: background 0.2s;
              }
              
              .print-button:hover {
                background: #0077ed;
              }
              
              .header {
                margin-bottom: 60px;
                padding-bottom: 30px;
                border-bottom: 3px solid #0a84ff;
              }
              
              .proposal-title {
                font-size: 36px;
                font-weight: 700;
                margin-bottom: 12px;
                color: #0a84ff;
              }
              
              .meta-info {
                font-size: 14px;
                color: #666;
              }
              
              .client-info {
                margin-bottom: 40px;
                padding: 20px;
                background: #f5f5f7;
                border-radius: 8px;
              }
              
              .client-info h3 {
                font-size: 16px;
                margin-bottom: 8px;
                color: #0a84ff;
              }
              
              .section {
                margin-bottom: 40px;
                page-break-inside: avoid;
              }
              
              .section-title {
                font-size: 24px;
                font-weight: 600;
                margin-bottom: 16px;
                color: #1a1a1a;
              }
              
              .section-content {
                font-size: 14px;
                line-height: 1.8;
              }
              
              .section-content h1,
              .section-content h2,
              .section-content h3 {
                margin-top: 24px;
                margin-bottom: 12px;
              }
              
              .section-content p {
                margin-bottom: 12px;
              }
              
              .section-content ul,
              .section-content ol {
                margin-left: 24px;
                margin-bottom: 12px;
              }
              
              .section-content table {
                width: 100%;
                border-collapse: collapse;
                margin: 16px 0;
              }
              
              .section-content th,
              .section-content td {
                border: 1px solid #e0e0e0;
                padding: 8px 12px;
                text-align: left;
              }
              
              .section-content th {
                background: #f5f5f7;
                font-weight: 600;
              }
              
              .footer {
                margin-top: 80px;
                padding-top: 30px;
                border-top: 1px solid #e0e0e0;
                text-align: center;
                color: #999;
                font-size: 12px;
              }
              
              @media print {
                body {
                  padding: 40px;
                }
                
                .print-button {
                  display: none;
                }
              }
            </style>
          </head>
          <body>
            <button class="print-button" onclick="window.print()">Print to PDF</button>
            
            <div class="header">
              <h1 class="proposal-title">${proposal.name}</h1>
              <div class="meta-info">
                Status: <strong>${proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}</strong> | 
                Created: ${new Date(proposal.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
            
            ${contact ? `
            <div class="client-info">
              <h3>Prepared For:</h3>
              <div>${contact.firstName} ${contact.lastName}</div>
              ${contact.email ? `<div>${contact.email}</div>` : ''}
              ${contact.phone ? `<div>${contact.phone}</div>` : ''}
            </div>
            ` : ''}
            
            ${processedSections.map(section => `
              <div class="section">
                <h2 class="section-title">${section.title}</h2>
                <div class="section-content">${section.content}</div>
              </div>
            `).join('')}
            
            <div class="footer">
              Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </body>
        </html>
      `;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);

    } catch (error: any) {
      console.error('[PDF Print] Error:', error);
      res.status(500).send('<html><body><h1>Error</h1><p>Failed to generate print view.</p></body></html>');
    }
  });

  // ============================================================================
  // SUPER ADMIN ROUTES - Platform-level administration
  // ============================================================================

  // Helper function to log audit events
  const logAuditEvent = async (
    userId: string,
    action: string,
    resourceType: string,
    resourceId: string | null,
    details: any,
    ipAddress: string | undefined,
    userAgent: string | undefined
  ) => {
    try {
      await storage.createAuditLog({
        userId,
        action,
        resourceType,
        resourceId,
        details,
        ipAddress,
        userAgent,
      });
    } catch (error) {
      console.error('[AUDIT LOG ERROR]', error);
    }
  };

  // Get all users across all agencies (Super Admin only)
  app.get("/api/superadmin/users", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const users = await storage.getAllUsersForSuperAdmin();
      res.json(users);
    } catch (error: any) {
      console.error('[SUPER ADMIN] Error fetching users:', error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Update user email (Super Admin only)
  app.patch("/api/superadmin/users/:userId/email", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const { updateUserEmail } = await import("./lib/supabase-auth");
      const { updateUserEmailSchema } = await import("@shared/schema");
      const { userId } = req.params;

      // Validate request body with Zod
      const validation = updateUserEmailSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid email address", 
          errors: validation.error.errors 
        });
      }

      const { email } = validation.data;

      // Get old user data for audit log
      const oldUser = await storage.getUserById(userId);
      if (!oldUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get old email from user's auth record
      const { supabaseAdmin } = await import("./lib/supabase");
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
      const oldEmail = authUser?.user?.email || 'unknown';

      await updateUserEmail(userId, email);

      // Log audit event with old and new email
      await logAuditEvent(
        req.user!.id,
        'user.update_email',
        'user',
        userId,
        { oldEmail, newEmail: email },
        req.ip,
        req.get('user-agent')
      );

      res.json({ message: "User email updated successfully" });
    } catch (error: any) {
      console.error('[SUPER ADMIN] Error updating user email:', error);
      res.status(500).json({ message: error.message || "Failed to update user email" });
    }
  });

  // Update user password (Super Admin only)
  app.patch("/api/superadmin/users/:userId/password", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const { updateUserPassword } = await import("./lib/supabase-auth");
      const { updateUserPasswordSchema } = await import("@shared/schema");
      const { userId } = req.params;

      // Validate request body with Zod
      const validation = updateUserPasswordSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid password", 
          errors: validation.error.errors 
        });
      }

      const { password } = validation.data;

      // Get user data for audit log
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      await updateUserPassword(userId, password);

      // Log audit event (never log actual password)
      await logAuditEvent(
        req.user!.id,
        'user.update_password',
        'user',
        userId,
        { passwordChanged: true },
        req.ip,
        req.get('user-agent')
      );

      res.json({ message: "User password updated successfully" });
    } catch (error: any) {
      console.error('[SUPER ADMIN] Error updating user password:', error);
      res.status(500).json({ message: error.message || "Failed to update user password" });
    }
  });

  // Promote user to SuperAdmin (Super Admin only)
  app.patch("/api/superadmin/users/:userId/promote-superadmin", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const { promoteUserToSuperAdmin } = await import("./lib/supabase-auth");
      const { userId } = req.params;

      // Get user data before promotion for audit log
      const profile = await storage.getProfileById(userId);
      if (!profile) {
        return res.status(404).json({ message: "User not found" });
      }

      const oldState = {
        role: profile.role,
        isSuperAdmin: profile.isSuperAdmin,
        agencyId: profile.agencyId
      };

      // Perform promotion and get updated profile
      const updatedProfile = await promoteUserToSuperAdmin(userId);

      // Log audit event
      await logAuditEvent(
        req.user!.id,
        'user.promote_superadmin',
        'user',
        userId,
        { 
          oldRole: oldState.role,
          newRole: 'SuperAdmin',
          oldAgencyId: oldState.agencyId,
          newAgencyId: null,
          oldIsSuperAdmin: oldState.isSuperAdmin,
          newIsSuperAdmin: true
        },
        req.ip,
        req.get('user-agent')
      );

      res.json({ 
        message: "User promoted to SuperAdmin successfully",
        profile: updatedProfile
      });
    } catch (error: any) {
      console.error('[SUPER ADMIN] Error promoting user to SuperAdmin:', error);
      res.status(500).json({ message: error.message || "Failed to promote user" });
    }
  });

  // Update user role (Super Admin only)
  app.patch("/api/superadmin/users/:userId/role", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const { updateUserRole } = await import("./lib/supabase-auth");
      const { userId } = req.params;
      const { role, agencyId } = req.body;

      // Validate role
      if (!role || !['Client', 'Staff', 'Admin', 'SuperAdmin'].includes(role)) {
        return res.status(400).json({ message: "Invalid role specified" });
      }

      // Get user data before update for audit log
      const profile = await storage.getProfileById(userId);
      if (!profile) {
        return res.status(404).json({ message: "User not found" });
      }

      const oldState = {
        role: profile.role,
        isSuperAdmin: profile.isSuperAdmin,
        agencyId: profile.agencyId
      };

      // Perform role update
      const updatedProfile = await updateUserRole(userId, role, agencyId);

      // Log audit event
      await logAuditEvent(
        req.user!.id,
        'user.role_update',
        'user',
        userId,
        { 
          oldRole: oldState.role,
          newRole: role,
          oldAgencyId: oldState.agencyId,
          newAgencyId: updatedProfile.agencyId,
          oldIsSuperAdmin: oldState.isSuperAdmin,
          newIsSuperAdmin: updatedProfile.isSuperAdmin
        },
        req.ip,
        req.get('user-agent')
      );

      res.json({ 
        message: "User role updated successfully",
        profile: updatedProfile
      });
    } catch (error: any) {
      console.error('[SUPER ADMIN] Error updating user role:', error);
      res.status(500).json({ message: error.message || "Failed to update user role" });
    }
  });

  // Delete user (Super Admin only)
  app.delete("/api/superadmin/users/:userId", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const { userId } = req.params;

      // Get user data for audit log
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Use Supabase Auth delete function
      const { deleteUser } = await import("./lib/supabase-auth");
      await deleteUser(userId);

      // Log audit event
      await logAuditEvent(
        req.user!.id,
        'user.delete',
        'user',
        userId,
        { deletedUser: user },
        req.ip,
        req.get('user-agent')
      );

      res.json({ message: "User deleted successfully" });
    } catch (error: any) {
      console.error('[SUPER ADMIN] Error deleting user:', error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Get all agencies (Super Admin only)
  app.get("/api/superadmin/agencies", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const agencies = await storage.getAllAgenciesForSuperAdmin();
      res.json(agencies);
    } catch (error: any) {
      console.error('[SUPER ADMIN] Error fetching agencies:', error);
      res.status(500).json({ message: "Failed to fetch agencies" });
    }
  });

  // Delete agency (Super Admin only)
  app.delete("/api/superadmin/agencies/:agencyId", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const { agencyId } = req.params;

      // Get agency data for audit log
      const agency = await storage.getAgencyById(agencyId);
      if (!agency) {
        return res.status(404).json({ message: "Agency not found" });
      }

      await storage.deleteAgency(agencyId);

      // Log audit event
      await logAuditEvent(
        req.user!.id,
        'agency.delete',
        'agency',
        agencyId,
        { deletedAgency: agency },
        req.ip,
        req.get('user-agent')
      );

      res.json({ message: "Agency deleted successfully" });
    } catch (error: any) {
      console.error('[SUPER ADMIN] Error deleting agency:', error);
      res.status(500).json({ message: "Failed to delete agency" });
    }
  });

  // Get all clients (Super Admin only)
  app.get("/api/superadmin/clients", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const clients = await storage.getAllClientsForSuperAdmin();
      res.json(clients);
    } catch (error: any) {
      console.error('[SUPER ADMIN] Error fetching clients:', error);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  // Delete client (Super Admin only)
  app.delete("/api/superadmin/clients/:clientId", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;

      // Get client data for audit log
      const allClients = await storage.getAllClientsForSuperAdmin();
      const client = allClients.find(c => c.id === clientId);
      
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      await storage.deleteClient(clientId);

      // Log audit event
      await logAuditEvent(
        req.user!.id,
        'client.delete',
        'client',
        clientId,
        { deletedClient: client },
        req.ip,
        req.get('user-agent')
      );

      res.json({ message: "Client deleted successfully" });
    } catch (error: any) {
      console.error('[SUPER ADMIN] Error deleting client:', error);
      res.status(500).json({ message: "Failed to delete client" });
    }
  });

  // Get AI settings for a specific agency (Super Admin only)
  app.get("/api/superadmin/agencies/:agencyId/settings", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const { agencyId } = req.params;

      // Verify agency exists
      const agencies = await storage.getAllAgenciesForSuperAdmin();
      const agency = agencies.find(a => a.id === agencyId);
      if (!agency) {
        return res.status(404).json({ message: "Agency not found" });
      }

      // Query agency settings
      const settings = await db
        .select()
        .from(agencySettings)
        .where(eq(agencySettings.agencyId, agencyId))
        .limit(1);

      if (settings.length === 0) {
        return res.json({
          agencyId,
          agencyName: agency.name,
          aiProvider: (process.env.AI_PROVIDER?.toLowerCase() || "gemini"),
          isDefault: true,
        });
      }

      res.json({
        agencyId,
        agencyName: agency.name,
        aiProvider: settings[0].aiProvider.toLowerCase(),
        isDefault: false,
      });
    } catch (error: any) {
      console.error('[SUPER ADMIN] Error fetching agency settings:', error);
      res.status(500).json({ message: "Failed to fetch agency settings" });
    }
  });

  // Update AI settings for a specific agency (Super Admin only)
  app.put("/api/superadmin/agencies/:agencyId/settings", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const { agencyId } = req.params;

      // Validate request body
      const validationResult = updateAgencySettingSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid settings data",
          errors: validationResult.error.errors,
        });
      }

      const { aiProvider } = validationResult.data;

      // Verify agency exists
      const agencies = await storage.getAllAgenciesForSuperAdmin();
      const agency = agencies.find(a => a.id === agencyId);
      if (!agency) {
        return res.status(404).json({ message: "Agency not found" });
      }

      // Check if settings already exist for this agency
      const existingSettings = await db
        .select()
        .from(agencySettings)
        .where(eq(agencySettings.agencyId, agencyId))
        .limit(1);

      let result;
      if (existingSettings.length === 0) {
        // Create new settings
        [result] = await db
          .insert(agencySettings)
          .values({
            agencyId,
            aiProvider,
          })
          .returning();
      } else {
        // Update existing settings
        [result] = await db
          .update(agencySettings)
          .set({
            aiProvider,
            updatedAt: sql`now()`,
          })
          .where(eq(agencySettings.agencyId, agencyId))
          .returning();
      }

      // Invalidate AI provider cache for this agency
      invalidateAIProviderCache(agencyId);

      // Log audit event
      await logAuditEvent(
        req.user!.id,
        'agency.settings.update',
        'agency',
        agencyId,
        { aiProvider, agencyName: agency.name },
        req.ip,
        req.get('user-agent')
      );

      res.json({
        ...result,
        agencyName: agency.name,
      });
    } catch (error: any) {
      console.error('[SUPER ADMIN] Error updating agency settings:', error);
      res.status(500).json({ message: "Failed to update agency settings" });
    }
  });

  // Get all recommendations/initiatives across all agencies (Super Admin only)
  app.get("/api/superadmin/recommendations", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      // Get all initiatives without agency filter
      const allInitiatives = await storage.getAllInitiatives();
      
      // Enrich with client data
      const initiativesWithClients = await Promise.all(
        allInitiatives.map(async (init) => {
          const client = await storage.getClientById(init.clientId);
          let agencyName = undefined;
          if (client?.agencyId) {
            const agencies = await storage.getAllAgenciesForSuperAdmin();
            const agency = agencies.find(a => a.id === client.agencyId);
            agencyName = agency?.name;
          }
          return { 
            ...init, 
            client,
            agencyName
          };
        })
      );
      
      res.json(initiativesWithClients);
    } catch (error: any) {
      console.error('[SUPER ADMIN] Error fetching recommendations:', error);
      res.status(500).json({ message: "Failed to fetch recommendations" });
    }
  });

  // Generate recommendations for any client (Super Admin only)
  app.post("/api/superadmin/clients/:clientId/generate-recommendations", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      
      // Verify client exists
      const client = await storage.getClientById(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      // Validate request body
      const generateRecommendationsSchema = z.object({
        preset: z.enum(["quick-wins", "strategic-growth", "full-audit"]),
        includeCompetitors: z.boolean().default(false),
        competitorDomains: z.array(z.string()).max(5).optional()
      });
      
      const validatedData = generateRecommendationsSchema.parse(req.body);
      const { generateAIRecommendations } = await import("./ai-analyzer");
      
      // Call AI analyzer with preset and competitor configuration
      const result = await generateAIRecommendations(storage, clientId, {
        preset: validatedData.preset,
        includeCompetitors: validatedData.includeCompetitors,
        competitorDomains: validatedData.competitorDomains
      });
      
      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }

      // Log audit event
      await logAuditEvent(
        req.user!.id,
        'recommendations.generate',
        'client',
        clientId,
        { 
          preset: validatedData.preset, 
          clientName: client.companyName,
          recommendationsCreated: result.recommendationsCreated 
        },
        req.ip,
        req.get('user-agent')
      );
      
      res.json({ 
        success: true, 
        message: `Successfully generated ${result.recommendationsCreated} AI-powered recommendations`,
        count: result.recommendationsCreated 
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error('[SUPER ADMIN] Error generating recommendations:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get audit logs (Super Admin only)
  app.get("/api/superadmin/audit-logs", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const { limit = '100', offset = '0' } = req.query;
      const auditLogs = await storage.getAuditLogs(parseInt(limit as string), parseInt(offset as string));
      res.json(auditLogs);
    } catch (error: any) {
      console.error('[SUPER ADMIN] Error fetching audit logs:', error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // Register Settings routes
  app.use("/api/settings", settingsRouter);

  // Register SLA routes
  const { slaRouter } = await import("./sla/sla-routes");
  app.use("/api/sla", requireAuth, (req, res, next) => {
    const authReq = req as AuthRequest;
    (req as any).agencyId = authReq.user?.agencyId;
    (req as any).userId = authReq.user?.id;
    next();
  }, slaRouter);

  // Register Agent routes (Multi-Agent Architecture)
  const { agentRouter } = await import("./agents/agent-routes");
  app.use("/api/agents", requireAuth, (req, res, next) => {
    const authReq = req as AuthRequest;
    (req as any).agencyId = authReq.user?.agencyId;
    (req as any).userId = authReq.user?.id;
    next();
  }, agentRouter);

  // Register CRM routes (HubSpot webhooks and integration)
  const { crmRouter } = await import("./crm/crm-routes");
  // Public webhook endpoint (no auth required for HubSpot webhooks)
  app.use("/api/crm/webhooks", crmRouter);
  // Protected CRM endpoints
  app.use("/api/crm", requireAuth, (req, res, next) => {
    const authReq = req as AuthRequest;
    (req as any).agencyId = authReq.user?.agencyId;
    (req as any).userId = authReq.user?.id;
    (req as any).user = authReq.user;
    next();
  }, crmRouter);

  // Register Analytics routes (anomaly detection and trend analysis)
  const { analyticsRouter } = await import("./analytics/analytics-routes");
  app.use("/api/analytics", requireAuth, (req, res, next) => {
    const authReq = req as AuthRequest;
    (req as any).agencyId = authReq.user?.agencyId;
    (req as any).userId = authReq.user?.id;
    next();
  }, analyticsRouter);

  // Register Idempotent Task routes (workflow-safe task creation)
  const { taskRouter } = await import("./tasks/task-routes");
  app.use("/api/tasks/workflow", requireAuth, requireRole("Admin", "SuperAdmin"), (req, res, next) => {
    const authReq = req as AuthRequest;
    (req as any).agencyId = authReq.user?.agencyId;
    (req as any).userId = authReq.user?.id;
    next();
  }, taskRouter);

  // Register Template routes (reusable templates for projects, workflows, prompts)
  const { templateRouter } = await import("./templates/template-routes");
  app.use("/api/templates", requireAuth, requireRole("Admin", "SuperAdmin"), (req, res, next) => {
    const authReq = req as AuthRequest;
    (req as any).agencyId = authReq.user?.agencyId;
    (req as any).userId = authReq.user?.id;
    next();
  }, templateRouter);

  // Register Governance routes (SuperAdmin quota management, integration health, audit)
  const governanceRouter = (await import("./governance/governance-routes")).default;
  app.use("/api/governance", requireAuth, (req, res, next) => {
    const authReq = req as AuthRequest;
    (req as any).agencyId = authReq.user?.agencyId;
    (req as any).userId = authReq.user?.id;
    (req as any).user = {
      id: authReq.user?.id,
      agencyId: authReq.user?.agencyId,
      email: authReq.user?.email,
      role: authReq.user?.role,
      isSuperAdmin: authReq.user?.isSuperAdmin,
    };
    next();
  }, governanceRouter);

  // ===========================================
  // WORKFLOW ENGINE ROUTES
  // ===========================================
  
  // Get all workflows for agency
  app.get("/api/workflows", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { agencyId } = resolveAgencyContext(req, { allowQueryParam: true });
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const workflows = await storage.getWorkflowsByAgencyId(agencyId);
      res.json(workflows);
    } catch (error: any) {
      console.error('Error fetching workflows:', error);
      res.status(500).json({ message: "Failed to fetch workflows" });
    }
  });
  
  // Get single workflow
  app.get("/api/workflows/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const workflow = await storage.getWorkflowById(id);
      
      if (!workflow) {
        return res.status(404).json({ message: "Workflow not found" });
      }
      
      // Check agency access
      const userAgencyId = req.user?.agencyId;
      if (workflow.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(workflow);
    } catch (error: any) {
      console.error('Error fetching workflow:', error);
      res.status(500).json({ message: "Failed to fetch workflow" });
    }
  });
  
  // Create workflow
  app.post("/api/workflows", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { agencyId } = resolveAgencyContext(req, { requireBodyField: 'agencyId' });
      const resolvedAgencyId = agencyId || req.user?.agencyId;
      
      if (!resolvedAgencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const { name, description, triggerType, triggerConfig, steps, timeout, retryPolicy } = req.body;
      
      if (!name || !triggerType || !steps) {
        return res.status(400).json({ message: "name, triggerType, and steps are required" });
      }
      
      const workflow = await storage.createWorkflow({
        agencyId: resolvedAgencyId,
        name,
        description,
        triggerType,
        triggerConfig,
        steps,
        timeout,
        retryPolicy,
        createdBy: req.user?.id,
        status: "draft",
      });
      
      res.status(201).json(workflow);
    } catch (error: any) {
      console.error('Error creating workflow:', error);
      res.status(500).json({ message: "Failed to create workflow" });
    }
  });
  
  // Update workflow
  app.patch("/api/workflows/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const workflow = await storage.getWorkflowById(id);
      
      if (!workflow) {
        return res.status(404).json({ message: "Workflow not found" });
      }
      
      const userAgencyId = req.user?.agencyId;
      if (workflow.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { name, description, status, triggerType, triggerConfig, steps, timeout, retryPolicy } = req.body;
      
      const updated = await storage.updateWorkflow(id, {
        name,
        description,
        status,
        triggerType,
        triggerConfig,
        steps,
        timeout,
        retryPolicy,
      });
      
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating workflow:', error);
      res.status(500).json({ message: "Failed to update workflow" });
    }
  });
  
  // Delete workflow
  app.delete("/api/workflows/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const workflow = await storage.getWorkflowById(id);
      
      if (!workflow) {
        return res.status(404).json({ message: "Workflow not found" });
      }
      
      const userAgencyId = req.user?.agencyId;
      if (workflow.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteWorkflow(id);
      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting workflow:', error);
      res.status(500).json({ message: "Failed to delete workflow" });
    }
  });
  
  // Execute workflow manually
  app.post("/api/workflows/:id/execute", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const workflow = await storage.getWorkflowById(id);
      
      if (!workflow) {
        return res.status(404).json({ message: "Workflow not found" });
      }
      
      const userAgencyId = req.user?.agencyId;
      if (workflow.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      if (workflow.status !== "active") {
        return res.status(400).json({ message: "Workflow must be active to execute" });
      }
      
      const { createWorkflowEngine } = await import("./workflow/engine");
      const engine = createWorkflowEngine(storage);
      
      const triggerPayload = req.body.payload || {};
      
      const execution = await engine.execute(workflow, triggerPayload, {
        triggerId: `manual-${Date.now()}`,
        triggerType: "manual",
        skipIdempotencyCheck: req.body.skipIdempotencyCheck,
      });
      
      res.json(execution);
    } catch (error: any) {
      console.error('Error executing workflow:', error);
      res.status(500).json({ message: "Failed to execute workflow", error: error.message });
    }
  });
  
  // Get workflow executions
  app.get("/api/workflows/:id/executions", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const workflow = await storage.getWorkflowById(id);
      
      if (!workflow) {
        return res.status(404).json({ message: "Workflow not found" });
      }
      
      const userAgencyId = req.user?.agencyId;
      if (workflow.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const executions = await storage.getWorkflowExecutionsByWorkflowId(id);
      res.json(executions);
    } catch (error: any) {
      console.error('Error fetching workflow executions:', error);
      res.status(500).json({ message: "Failed to fetch workflow executions" });
    }
  });
  
  // Get execution events (step logs)
  app.get("/api/workflow-executions/:id/events", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const execution = await storage.getWorkflowExecutionById(id);
      
      if (!execution) {
        return res.status(404).json({ message: "Execution not found" });
      }
      
      // Verify agency access through workflow
      const workflow = await storage.getWorkflowById(execution.workflowId);
      const userAgencyId = req.user?.agencyId;
      if (!workflow || (workflow.agencyId !== userAgencyId && !req.user?.isSuperAdmin)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const events = await storage.getWorkflowEventsByExecutionId(id);
      res.json(events);
    } catch (error: any) {
      console.error('Error fetching execution events:', error);
      res.status(500).json({ message: "Failed to fetch execution events" });
    }
  });

  // Validate workflow configuration with Zod schema
  const workflowValidationSchema = z.object({
    steps: z.array(z.object({
      id: z.string().min(1),
      type: z.enum(["signal", "rule", "ai", "action", "transform", "notification", "branch"]),
      name: z.string().optional(),
      config: z.record(z.unknown()).optional(),
      position: z.object({
        x: z.number(),
        y: z.number(),
      }).optional(),
    })),
    connections: z.array(z.object({
      source: z.string().min(1),
      target: z.string().min(1),
      sourceHandle: z.string().optional(),
      targetHandle: z.string().optional(),
    })).optional().default([]),
  });

  app.post("/api/workflows/validate", requireAuth, async (req: AuthRequest, res) => {
    try {
      const validationResult = workflowValidationSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({
          valid: false,
          errors: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
          warnings: [],
        });
      }
      
      const { steps, connections } = validationResult.data;
      const errors: string[] = [];
      const warnings: string[] = [];
      
      if (steps.length === 0) {
        errors.push("Workflow must have at least one step");
      }
      
      // Check for signal step (entry point)
      const signalSteps = steps.filter((s) => s.type === "signal");
      if (signalSteps.length === 0) {
        errors.push("Workflow must have at least one signal step as entry point");
      }
      
      // Check for orphaned steps (no incoming connections)
      const connectedTargets = new Set(connections.map((c) => c.target));
      const orphanedSteps = steps.filter((s) => 
        s.type !== "signal" && !connectedTargets.has(s.id)
      );
      if (orphanedSteps.length > 0) {
        warnings.push(`${orphanedSteps.length} step(s) have no incoming connections`);
      }
      
      // Check for required configurations
      steps.forEach((step) => {
        if (step.type === "ai" && !step.config?.promptTemplate) {
          warnings.push(`AI step "${step.name || step.id}" is missing a prompt template`);
        }
        if (step.type === "notification" && !step.config?.channel) {
          warnings.push(`Notification step "${step.name || step.id}" is missing a channel`);
        }
      });
      
      res.json({
        valid: errors.length === 0,
        errors,
        warnings,
      });
    } catch (error: any) {
      console.error('Error validating workflow:', error);
      res.status(500).json({ message: "Failed to validate workflow" });
    }
  });

  // Duplicate workflow
  app.post("/api/workflows/:id/duplicate", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const workflow = await storage.getWorkflowById(id);
      
      if (!workflow) {
        return res.status(404).json({ message: "Workflow not found" });
      }
      
      const userAgencyId = req.user?.agencyId;
      if (workflow.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Create duplicate with new name
      const duplicatedWorkflow = await storage.createWorkflow({
        agencyId: workflow.agencyId,
        name: `${workflow.name} (Copy)`,
        description: workflow.description,
        status: "draft",
        triggerType: workflow.triggerType,
        triggerConfig: workflow.triggerConfig,
        steps: workflow.steps,
        timeout: workflow.timeout,
        retryPolicy: workflow.retryPolicy,
        createdBy: req.user?.id || null,
      });
      
      res.json(duplicatedWorkflow);
    } catch (error: any) {
      console.error('Error duplicating workflow:', error);
      res.status(500).json({ message: "Failed to duplicate workflow" });
    }
  });

  // ==================== LINEAGE QUERY API ====================

  // Get lineage for a task (trace back to originating workflow/signal)
  app.get("/api/lineage/task/:taskId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { taskId } = req.params;
      const task = await storage.getTaskById(taskId);
      
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // Verify agency access
      const userAgencyId = req.user?.agencyId;
      const taskWithProject = await db.select({
        task: tasks,
        project: projects,
        client: clients,
      })
        .from(tasks)
        .leftJoin(projects, eq(tasks.projectId, projects.id))
        .leftJoin(clients, eq(projects.clientId, clients.id))
        .where(eq(tasks.id, taskId))
        .limit(1);
      
      if (taskWithProject.length === 0) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      const clientAgencyId = taskWithProject[0].client?.agencyId;
      if (clientAgencyId !== userAgencyId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Build lineage chain
      const lineage: any = {
        task: taskWithProject[0].task,
        project: taskWithProject[0].project,
        client: taskWithProject[0].client,
        workflowExecution: null,
        workflow: null,
        signal: null,
        events: [],
      };
      
      // If task has workflow execution lineage
      const taskData = taskWithProject[0].task as any;
      if (taskData.workflowExecutionId) {
        const execution = await storage.getWorkflowExecutionById(taskData.workflowExecutionId);
        if (execution) {
          lineage.workflowExecution = execution;
          
          // Get workflow definition
          const workflow = await storage.getWorkflowById(execution.workflowId);
          lineage.workflow = workflow;
          
          // Get triggering signal if exists
          if (execution.triggerId) {
            const signal = await storage.getSignalById(execution.triggerId);
            lineage.signal = signal;
          }
          
          // Get execution events
          const events = await storage.getWorkflowEventsByExecutionId(execution.id);
          lineage.events = events;
        }
      }
      
      res.json(lineage);
    } catch (error: any) {
      console.error('Error fetching task lineage:', error);
      res.status(500).json({ message: "Failed to fetch task lineage" });
    }
  });

  // Get lineage for a project
  app.get("/api/lineage/project/:projectId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { projectId } = req.params;
      
      const projectWithClient = await db.select({
        project: projects,
        client: clients,
      })
        .from(projects)
        .leftJoin(clients, eq(projects.clientId, clients.id))
        .where(eq(projects.id, projectId))
        .limit(1);
      
      if (projectWithClient.length === 0) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Verify agency access
      const userAgencyId = req.user?.agencyId;
      const clientAgencyId = projectWithClient[0].client?.agencyId;
      if (clientAgencyId !== userAgencyId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const lineage: any = {
        project: projectWithClient[0].project,
        client: projectWithClient[0].client,
        workflowExecution: null,
        workflow: null,
        signal: null,
        events: [],
        createdTasks: [],
        createdLists: [],
      };
      
      // If project has workflow execution lineage
      const projectData = projectWithClient[0].project as any;
      if (projectData.workflowExecutionId) {
        const execution = await storage.getWorkflowExecutionById(projectData.workflowExecutionId);
        if (execution) {
          lineage.workflowExecution = execution;
          
          const workflow = await storage.getWorkflowById(execution.workflowId);
          lineage.workflow = workflow;
          
          if (execution.triggerId) {
            const signal = await storage.getSignalById(execution.triggerId);
            lineage.signal = signal;
          }
          
          const events = await storage.getWorkflowEventsByExecutionId(execution.id);
          lineage.events = events;
        }
      }
      
      // Get all tasks/lists created by same workflow execution
      if (projectData.workflowExecutionId) {
        const createdTasks = await db.select()
          .from(tasks)
          .where(eq((tasks as any).workflowExecutionId, projectData.workflowExecutionId));
        lineage.createdTasks = createdTasks;
        
        const createdLists = await db.select()
          .from(taskLists)
          .where(eq((taskLists as any).workflowExecutionId, projectData.workflowExecutionId));
        lineage.createdLists = createdLists;
      }
      
      res.json(lineage);
    } catch (error: any) {
      console.error('Error fetching project lineage:', error);
      res.status(500).json({ message: "Failed to fetch project lineage" });
    }
  });

  // Get all entities created by a workflow execution
  app.get("/api/workflow-executions/:id/lineage", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const userAgencyId = req.user?.agencyId;
      const execution = await storage.getWorkflowExecutionById(id);
      
      if (!execution) {
        return res.status(404).json({ message: "Execution not found" });
      }
      
      // Verify agency access on execution first
      if (execution.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ message: "Access denied - execution belongs to different agency" });
      }
      
      // Verify workflow access
      const workflow = await storage.getWorkflowById(execution.workflowId);
      if (!workflow) {
        return res.status(404).json({ message: "Workflow not found" });
      }
      if (workflow.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ message: "Access denied - workflow belongs to different agency" });
      }
      
      // Get all entities created by this execution - filter by agency
      const createdProjects = await db.select()
        .from(projects)
        .leftJoin(clients, eq(projects.clientId, clients.id))
        .where(and(
          eq((projects as any).workflowExecutionId, id),
          eq(clients.agencyId, userAgencyId!)
        ));
      
      const createdLists = await db.select()
        .from(taskLists)
        .where(and(
          eq((taskLists as any).workflowExecutionId, id),
          eq(taskLists.agencyId, userAgencyId!)
        ));
      
      const createdTasks = await db.select()
        .from(tasks)
        .leftJoin(projects, eq(tasks.projectId, projects.id))
        .leftJoin(clients, eq(projects.clientId, clients.id))
        .where(and(
          eq((tasks as any).workflowExecutionId, id),
          eq(clients.agencyId, userAgencyId!)
        ));
      
      // Get AI executions - filter by agency
      const aiExecs = await db.select()
        .from(aiExecutionsTable)
        .where(and(
          eq(aiExecutionsTable.workflowExecutionId, id),
          eq(aiExecutionsTable.agencyId, userAgencyId!)
        ));
      
      // Get triggering signal - verify agency ownership
      let signal = null;
      if (execution.triggerId) {
        const fetchedSignal = await storage.getSignalById(execution.triggerId);
        if (fetchedSignal && (fetchedSignal.agencyId === userAgencyId || req.user?.isSuperAdmin)) {
          signal = fetchedSignal;
        }
      }
      
      // Get execution events - verify agency ownership
      const allEvents = await storage.getWorkflowEventsByExecutionId(id);
      const events = allEvents.filter(e => e.agencyId === userAgencyId || req.user?.isSuperAdmin);
      
      res.json({
        execution,
        workflow,
        signal,
        events,
        created: {
          projects: createdProjects.map(p => p.projects),
          taskLists: createdLists,
          tasks: createdTasks.map(t => t.tasks),
        },
        aiExecutions: aiExecs,
      });
    } catch (error: any) {
      console.error('Error fetching execution lineage:', error);
      res.status(500).json({ message: "Failed to fetch execution lineage" });
    }
  });

  // Replay a workflow execution (re-execute with same inputs)
  app.post("/api/workflow-executions/:id/replay", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const originalExecution = await storage.getWorkflowExecutionById(id);
      
      if (!originalExecution) {
        return res.status(404).json({ message: "Execution not found" });
      }
      
      // Verify agency access through BOTH execution AND workflow
      const userAgencyId = req.user?.agencyId;
      
      // Check execution's agencyId first
      if (originalExecution.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ message: "Access denied - execution belongs to different agency" });
      }
      
      // Also verify workflow access
      const workflow = await storage.getWorkflowById(originalExecution.workflowId);
      if (!workflow) {
        return res.status(404).json({ message: "Workflow not found" });
      }
      
      if (workflow.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ message: "Access denied - workflow belongs to different agency" });
      }
      
      // Re-execute with same inputs but skip idempotency check
      const newExecution = await workflowEngine.executeWorkflow(
        originalExecution.workflowId,
        {
          input: originalExecution.triggerPayload || {},
          triggerId: `replay:${id}`,
          triggerType: 'replay',
          skipIdempotencyCheck: true,
        }
      );
      
      res.json({
        originalExecution,
        replayedExecution: newExecution,
      });
    } catch (error: any) {
      console.error('Error replaying workflow execution:', error);
      res.status(500).json({ message: "Failed to replay workflow execution", error: error.message });
    }
  });

  // ==================== RULE ENGINE API ====================

  // Get all rules for agency
  app.get("/api/workflow-rules", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { agencyId } = resolveAgencyContext(req, { allowQueryParam: true });
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const rules = await storage.getWorkflowRulesByAgencyId(agencyId);
      res.json(rules);
    } catch (error: any) {
      console.error('Error fetching workflow rules:', error);
      res.status(500).json({ message: "Failed to fetch workflow rules" });
    }
  });

  // Get single rule
  app.get("/api/workflow-rules/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const rule = await storage.getWorkflowRuleById(id);
      
      if (!rule) {
        return res.status(404).json({ message: "Rule not found" });
      }
      
      const userAgencyId = req.user?.agencyId;
      if (rule.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(rule);
    } catch (error: any) {
      console.error('Error fetching workflow rule:', error);
      res.status(500).json({ message: "Failed to fetch workflow rule" });
    }
  });

  // Create rule
  app.post("/api/workflow-rules", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { agencyId } = resolveAgencyContext(req, { allowQueryParam: true });
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const ruleInput = {
        ...req.body,
        agencyId,
        createdBy: req.user?.profileId || null,
      };
      
      const parsed = insertWorkflowRuleSchema.safeParse(ruleInput);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
      }
      
      const rule = await storage.createWorkflowRule(parsed.data);
      
      await storage.createRuleAudit({
        ruleId: rule.id,
        actorId: req.user?.profileId || null,
        changeType: "created",
        changeSummary: `Rule "${rule.name}" created`,
        newState: rule as any,
      });
      
      res.status(201).json(rule);
    } catch (error: any) {
      console.error('Error creating workflow rule:', error);
      res.status(500).json({ message: "Failed to create workflow rule" });
    }
  });

  // Update rule
  app.patch("/api/workflow-rules/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const rule = await storage.getWorkflowRuleById(id);
      
      if (!rule) {
        return res.status(404).json({ message: "Rule not found" });
      }
      
      const userAgencyId = req.user?.agencyId;
      if (rule.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const parsed = updateWorkflowRuleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
      }
      
      const previousState = { ...rule };
      
      const updated = await storage.updateWorkflowRule(id, parsed.data);
      
      await storage.createRuleAudit({
        ruleId: id,
        actorId: req.user?.profileId || null,
        changeType: "updated",
        changeSummary: `Rule updated`,
        previousState: previousState as any,
        newState: updated as any,
      });
      
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating workflow rule:', error);
      res.status(500).json({ message: "Failed to update workflow rule" });
    }
  });

  // Delete rule
  app.delete("/api/workflow-rules/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const rule = await storage.getWorkflowRuleById(id);
      
      if (!rule) {
        return res.status(404).json({ message: "Rule not found" });
      }
      
      const userAgencyId = req.user?.agencyId;
      if (rule.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.createRuleAudit({
        ruleId: id,
        actorId: req.user?.profileId || null,
        changeType: "deleted",
        changeSummary: `Rule "${rule.name}" deleted`,
        previousState: rule as any,
      });
      
      await storage.deleteWorkflowRule(id);
      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting workflow rule:', error);
      res.status(500).json({ message: "Failed to delete workflow rule" });
    }
  });

  // Get rule versions
  app.get("/api/workflow-rules/:id/versions", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const rule = await storage.getWorkflowRuleById(id);
      
      if (!rule) {
        return res.status(404).json({ message: "Rule not found" });
      }
      
      const userAgencyId = req.user?.agencyId;
      if (rule.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const versions = await storage.getRuleVersionsByRuleId(id);
      res.json(versions);
    } catch (error: any) {
      console.error('Error fetching rule versions:', error);
      res.status(500).json({ message: "Failed to fetch rule versions" });
    }
  });

  // Create rule version
  app.post("/api/workflow-rules/:id/versions", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const rule = await storage.getWorkflowRuleById(id);
      
      if (!rule) {
        return res.status(404).json({ message: "Rule not found" });
      }
      
      const userAgencyId = req.user?.agencyId;
      if (rule.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const existingVersions = await storage.getRuleVersionsByRuleId(id);
      const nextVersion = existingVersions.length > 0 
        ? Math.max(...existingVersions.map(v => v.version)) + 1 
        : 1;
      
      const { conditions, actions, ...versionData } = req.body;
      
      const versionRequestSchema = z.object({
        conditionLogic: z.enum(["all", "any"]).optional(),
        thresholdConfig: z.record(z.unknown()).optional(),
        lifecycleConfig: z.record(z.unknown()).optional(),
        anomalyConfig: z.record(z.unknown()).optional(),
      });
      
      const parsedRequest = versionRequestSchema.safeParse(versionData);
      if (!parsedRequest.success) {
        return res.status(400).json({ message: "Validation error", errors: parsedRequest.error.errors });
      }
      
      const version = await storage.createRuleVersion({
        ruleId: id,
        version: nextVersion,
        status: "draft",
        conditionLogic: parsedRequest.data.conditionLogic || "all",
        thresholdConfig: parsedRequest.data.thresholdConfig,
        lifecycleConfig: parsedRequest.data.lifecycleConfig,
        anomalyConfig: parsedRequest.data.anomalyConfig,
        createdBy: req.user?.profileId || null,
      });
      
      if (conditions && Array.isArray(conditions) && conditions.length > 0) {
        const conditionSchema = z.object({
          fieldPath: z.string().min(1),
          operator: z.string().min(1),
          comparisonValue: z.unknown().optional(),
          windowConfig: z.record(z.unknown()).optional(),
          scope: z.enum(["signal", "context", "history", "aggregated"]).optional(),
          order: z.number().optional(),
        });
        
        const conditionInputs = [];
        for (let i = 0; i < conditions.length; i++) {
          const parsed = conditionSchema.safeParse(conditions[i]);
          if (!parsed.success) {
            return res.status(400).json({ 
              message: "Condition validation error", 
              errors: parsed.error.errors 
            });
          }
          conditionInputs.push({
            ruleVersionId: version.id,
            order: parsed.data.order ?? i,
            fieldPath: parsed.data.fieldPath,
            operator: parsed.data.operator,
            comparisonValue: parsed.data.comparisonValue,
            windowConfig: parsed.data.windowConfig,
            scope: parsed.data.scope || "signal",
          });
        }
        
        await storage.createRuleConditions(conditionInputs);
      }
      
      if (actions && Array.isArray(actions) && actions.length > 0) {
        const actionSchema = z.object({
          actionType: z.string().min(1),
          actionConfig: z.record(z.unknown()).optional(),
          order: z.number().optional(),
        });
        
        const actionInputs = [];
        for (let i = 0; i < actions.length; i++) {
          const parsed = actionSchema.safeParse(actions[i]);
          if (!parsed.success) {
            return res.status(400).json({ 
              message: "Action validation error", 
              errors: parsed.error.errors 
            });
          }
          actionInputs.push({
            ruleVersionId: version.id,
            order: parsed.data.order ?? i,
            actionType: parsed.data.actionType,
            actionConfig: parsed.data.actionConfig || {},
          });
        }
        
        await storage.createRuleActions(actionInputs);
      }
      
      res.status(201).json(version);
    } catch (error: any) {
      console.error('Error creating rule version:', error);
      res.status(500).json({ message: "Failed to create rule version" });
    }
  });

  // Publish rule version
  app.post("/api/workflow-rule-versions/:id/publish", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const version = await storage.getRuleVersionById(id);
      
      if (!version) {
        return res.status(404).json({ message: "Version not found" });
      }
      
      const rule = await storage.getWorkflowRuleById(version.ruleId);
      if (!rule) {
        return res.status(404).json({ message: "Rule not found" });
      }
      
      const userAgencyId = req.user?.agencyId;
      if (rule.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const published = await storage.publishRuleVersion(id);
      
      await storage.updateWorkflowRule(rule.id, { defaultVersionId: id });
      
      await storage.createRuleAudit({
        ruleId: rule.id,
        ruleVersionId: id,
        actorId: req.user?.profileId || null,
        changeType: "published",
        changeSummary: `Version ${version.version} published`,
        newState: published as any,
      });
      
      res.json(published);
    } catch (error: any) {
      console.error('Error publishing rule version:', error);
      res.status(500).json({ message: "Failed to publish rule version" });
    }
  });

  // Get rule conditions for a version
  app.get("/api/workflow-rule-versions/:id/conditions", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const conditions = await storage.getRuleConditionsByVersionId(id);
      res.json(conditions);
    } catch (error: any) {
      console.error('Error fetching rule conditions:', error);
      res.status(500).json({ message: "Failed to fetch rule conditions" });
    }
  });

  // Get rule actions for a version
  app.get("/api/workflow-rule-versions/:id/actions", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const actions = await storage.getRuleActionsByVersionId(id);
      res.json(actions);
    } catch (error: any) {
      console.error('Error fetching rule actions:', error);
      res.status(500).json({ message: "Failed to fetch rule actions" });
    }
  });

  // Get rule audits
  app.get("/api/workflow-rules/:id/audits", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const rule = await storage.getWorkflowRuleById(id);
      
      if (!rule) {
        return res.status(404).json({ message: "Rule not found" });
      }
      
      const userAgencyId = req.user?.agencyId;
      if (rule.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const audits = await storage.getRuleAuditsByRuleId(id);
      res.json(audits);
    } catch (error: any) {
      console.error('Error fetching rule audits:', error);
      res.status(500).json({ message: "Failed to fetch rule audits" });
    }
  });

  // Get rule evaluations
  app.get("/api/workflow-rules/:id/evaluations", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const rule = await storage.getWorkflowRuleById(id);
      
      if (!rule) {
        return res.status(404).json({ message: "Rule not found" });
      }
      
      const userAgencyId = req.user?.agencyId;
      if (rule.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const limit = parseInt(req.query.limit as string) || 100;
      const evaluations = await storage.getRuleEvaluationsByRuleId(id, limit);
      res.json(evaluations);
    } catch (error: any) {
      console.error('Error fetching rule evaluations:', error);
      res.status(500).json({ message: "Failed to fetch rule evaluations" });
    }
  });

  // SIGNAL INGESTION ROUTES
  
  // Ingest signal from specific source
  app.post("/api/signals/:source/ingest", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { source } = req.params;
      const agencyId = req.user?.agencyId;
      
      if (!agencyId) {
        return res.status(403).json({ message: "Agency ID required" });
      }

      if (!SignalAdapterFactory.hasAdapter(source)) {
        return res.status(400).json({ 
          message: `Invalid source: ${source}. Valid sources: ${SignalAdapterFactory.getSupportedSources().join(", ")}` 
        });
      }

      const { data, clientId } = req.body;
      if (!data || typeof data !== "object") {
        return res.status(400).json({ message: "Signal data is required" });
      }

      const result = await signalRouter.ingestSignal(agencyId, source, data, clientId);
      
      res.status(result.isDuplicate ? 200 : 201).json({
        signal: result.signal,
        isDuplicate: result.isDuplicate,
        matchingRoutes: result.matchingRoutes.length,
        workflowsTriggered: result.workflowsTriggered,
      });
    } catch (error: any) {
      console.error("Error ingesting signal:", error);
      res.status(500).json({ message: error.message || "Failed to ingest signal" });
    }
  });

  // Get unprocessed signals
  app.get("/api/signals/pending", requireAuth, async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(403).json({ message: "Agency ID required" });
      }

      const limit = parseInt(req.query.limit as string) || 100;
      const signals = await signalRouter.getPendingSignals(agencyId, limit);
      res.json(signals);
    } catch (error: any) {
      console.error("Error fetching pending signals:", error);
      res.status(500).json({ message: "Failed to fetch pending signals" });
    }
  });

  // Get failed signals
  app.get("/api/signals/failed", requireAuth, async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(403).json({ message: "Agency ID required" });
      }

      const limit = parseInt(req.query.limit as string) || 100;
      const signals = await signalRouter.getFailedSignals(agencyId, limit);
      res.json(signals);
    } catch (error: any) {
      console.error("Error fetching failed signals:", error);
      res.status(500).json({ message: "Failed to fetch failed signals" });
    }
  });

  // Retry failed signal
  app.post("/api/signals/:id/retry", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const signal = await storage.getWorkflowSignalById(id);
      
      if (!signal) {
        return res.status(404).json({ message: "Signal not found" });
      }

      const agencyId = req.user?.agencyId;
      if (signal.agencyId !== agencyId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updatedSignal = await signalRouter.retrySignal(id);
      res.json(updatedSignal);
    } catch (error: any) {
      console.error("Error retrying signal:", error);
      res.status(500).json({ message: error.message || "Failed to retry signal" });
    }
  });

  // Get signal by ID
  app.get("/api/signals/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const signal = await storage.getWorkflowSignalById(id);
      
      if (!signal) {
        return res.status(404).json({ message: "Signal not found" });
      }

      const agencyId = req.user?.agencyId;
      if (signal.agencyId !== agencyId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(signal);
    } catch (error: any) {
      console.error("Error fetching signal:", error);
      res.status(500).json({ message: "Failed to fetch signal" });
    }
  });

  // SIGNAL ROUTES MANAGEMENT

  // Get all signal routes for agency
  app.get("/api/signal-routes", requireAuth, async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(403).json({ message: "Agency ID required" });
      }

      const routes = await storage.getSignalRoutesByAgencyId(agencyId);
      res.json(routes);
    } catch (error: any) {
      console.error("Error fetching signal routes:", error);
      res.status(500).json({ message: "Failed to fetch signal routes" });
    }
  });

  // Get signal route by ID
  app.get("/api/signal-routes/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const route = await storage.getSignalRouteById(id);
      
      if (!route) {
        return res.status(404).json({ message: "Signal route not found" });
      }

      const agencyId = req.user?.agencyId;
      if (route.agencyId !== agencyId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(route);
    } catch (error: any) {
      console.error("Error fetching signal route:", error);
      res.status(500).json({ message: "Failed to fetch signal route" });
    }
  });

  // Create signal route
  app.post("/api/signal-routes", requireAuth, async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(403).json({ message: "Agency ID required" });
      }

      const routeData = { ...req.body, agencyId };
      const validatedData = insertWorkflowSignalRouteSchema.parse(routeData);
      const route = await storage.createSignalRoute(validatedData);
      res.status(201).json(route);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error creating signal route:", error);
      res.status(500).json({ message: "Failed to create signal route" });
    }
  });

  // Update signal route
  app.patch("/api/signal-routes/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const route = await storage.getSignalRouteById(id);
      
      if (!route) {
        return res.status(404).json({ message: "Signal route not found" });
      }

      const agencyId = req.user?.agencyId;
      if (route.agencyId !== agencyId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validatedData = updateWorkflowSignalRouteSchema.parse(req.body);
      const updatedRoute = await storage.updateSignalRoute(id, validatedData);
      res.json(updatedRoute);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error updating signal route:", error);
      res.status(500).json({ message: "Failed to update signal route" });
    }
  });

  // Delete signal route
  app.delete("/api/signal-routes/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const route = await storage.getSignalRouteById(id);
      
      if (!route) {
        return res.status(404).json({ message: "Signal route not found" });
      }

      const agencyId = req.user?.agencyId;
      if (route.agencyId !== agencyId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteSignalRoute(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting signal route:", error);
      res.status(500).json({ message: "Failed to delete signal route" });
    }
  });

  // Get supported signal sources
  app.get("/api/signals/sources", requireAuth, async (_req: AuthRequest, res) => {
    res.json({
      sources: SignalAdapterFactory.getSupportedSources(),
    });
  });

  // ============================================
  // AI EXECUTION AND USAGE TRACKING ENDPOINTS
  // ============================================

  // Get AI execution by ID
  app.get("/api/ai-executions/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const execution = await hardenedAIExecutor.getExecutionById(id);
      
      if (!execution) {
        return res.status(404).json({ message: "AI execution not found" });
      }

      const agencyId = req.user?.agencyId;
      if (execution.agencyId !== agencyId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(execution);
    } catch (error: any) {
      console.error("Error fetching AI execution:", error);
      res.status(500).json({ message: "Failed to fetch AI execution" });
    }
  });

  // Get AI executions by workflow execution ID
  app.get("/api/workflow-executions/:id/ai-executions", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const agencyId = req.user?.agencyId;

      const executions = await hardenedAIExecutor.getExecutionsByWorkflow(id);
      
      const filteredExecutions = executions.filter(
        exec => exec.agencyId === agencyId || req.user?.isSuperAdmin
      );

      if (executions.length > 0 && filteredExecutions.length === 0 && !req.user?.isSuperAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(filteredExecutions);
    } catch (error: any) {
      console.error("Error fetching AI executions:", error);
      res.status(500).json({ message: "Failed to fetch AI executions" });
    }
  });

  // Get AI usage tracking for agency
  app.get("/api/ai-usage", requireAuth, async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(403).json({ message: "Agency ID required" });
      }

      const { periodStart, periodEnd } = req.query;
      const usage = await hardenedAIExecutor.getUsageByAgency(
        agencyId,
        periodStart ? new Date(periodStart as string) : undefined,
        periodEnd ? new Date(periodEnd as string) : undefined
      );

      res.json(usage);
    } catch (error: any) {
      console.error("Error fetching AI usage:", error);
      res.status(500).json({ message: "Failed to fetch AI usage" });
    }
  });

  // Get AI cache stats (admin only)
  app.get("/api/ai-cache/stats", requireAuth, requireRole("Admin"), async (_req: AuthRequest, res) => {
    try {
      const stats = hardenedAIExecutor.getCacheStats();
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching AI cache stats:", error);
      res.status(500).json({ message: "Failed to fetch AI cache stats" });
    }
  });

  // Clear AI cache (admin only)
  app.delete("/api/ai-cache", requireAuth, requireRole("Admin"), async (_req: AuthRequest, res) => {
    try {
      hardenedAIExecutor.clearCache();
      res.json({ message: "AI cache cleared" });
    } catch (error: any) {
      console.error("Error clearing AI cache:", error);
      res.status(500).json({ message: "Failed to clear AI cache" });
    }
  });

  // ==================== RETENTION POLICY API ====================

  // Get retention policies for agency
  app.get("/api/retention-policies", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { agencyId } = resolveAgencyContext(req, { allowQueryParam: true });
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const policies = await db.select()
        .from(workflowRetentionPolicies)
        .where(eq(workflowRetentionPolicies.agencyId, agencyId));
      
      res.json(policies);
    } catch (error: any) {
      console.error("Error fetching retention policies:", error);
      res.status(500).json({ message: "Failed to fetch retention policies" });
    }
  });

  // Create or update retention policy
  app.post("/api/retention-policies", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const { agencyId } = resolveAgencyContext(req, { allowQueryParam: true });
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const { resourceType, retentionDays, archiveBeforeDelete, enabled } = req.body;
      
      if (!resourceType || !retentionDays) {
        return res.status(400).json({ message: "resourceType and retentionDays are required" });
      }
      
      // Upsert policy
      const existing = await db.select()
        .from(workflowRetentionPolicies)
        .where(and(
          eq(workflowRetentionPolicies.agencyId, agencyId),
          eq(workflowRetentionPolicies.resourceType, resourceType)
        ))
        .limit(1);
      
      let policy;
      if (existing.length > 0) {
        [policy] = await db.update(workflowRetentionPolicies)
          .set({
            retentionDays,
            archiveBeforeDelete: archiveBeforeDelete ?? false,
            enabled: enabled ?? true,
            updatedAt: new Date(),
          })
          .where(eq(workflowRetentionPolicies.id, existing[0].id))
          .returning();
      } else {
        [policy] = await db.insert(workflowRetentionPolicies)
          .values({
            agencyId,
            resourceType,
            retentionDays,
            archiveBeforeDelete: archiveBeforeDelete ?? false,
            enabled: enabled ?? true,
          })
          .returning();
      }
      
      res.json(policy);
    } catch (error: any) {
      console.error("Error creating/updating retention policy:", error);
      res.status(500).json({ message: "Failed to save retention policy" });
    }
  });

  // Delete retention policy
  app.delete("/api/retention-policies/:id", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { agencyId } = resolveAgencyContext(req, { allowQueryParam: true });
      
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const [policy] = await db.select()
        .from(workflowRetentionPolicies)
        .where(eq(workflowRetentionPolicies.id, id))
        .limit(1);
      
      if (!policy) {
        return res.status(404).json({ message: "Retention policy not found" });
      }
      
      if (policy.agencyId !== agencyId && !req.user?.isSuperAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await db.delete(workflowRetentionPolicies)
        .where(eq(workflowRetentionPolicies.id, id));
      
      res.json({ message: "Retention policy deleted" });
    } catch (error: any) {
      console.error("Error deleting retention policy:", error);
      res.status(500).json({ message: "Failed to delete retention policy" });
    }
  });

  // Run retention cleanup (admin only, typically called by cron)
  app.post("/api/retention-policies/cleanup", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const { agencyId } = resolveAgencyContext(req, { allowQueryParam: true });
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const policies = await db.select()
        .from(workflowRetentionPolicies)
        .where(and(
          eq(workflowRetentionPolicies.agencyId, agencyId),
          eq(workflowRetentionPolicies.enabled, true)
        ));
      
      const results: any[] = [];
      
      for (const policy of policies) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);
        
        let deletedCount = 0;
        
        switch (policy.resourceType) {
          case 'workflow_executions':
            const execResult = await db.delete(workflowExecutions)
              .where(and(
                eq(workflowExecutions.agencyId, agencyId),
                lt(workflowExecutions.createdAt, cutoffDate)
              ));
            deletedCount = (execResult as any).rowCount || 0;
            break;
            
          case 'workflow_events':
            const eventsResult = await db.delete(workflowEvents)
              .where(and(
                eq(workflowEvents.agencyId, agencyId),
                lt(workflowEvents.timestamp, cutoffDate)
              ));
            deletedCount = (eventsResult as any).rowCount || 0;
            break;
            
          case 'signals':
            const signalsResult = await db.delete(workflowSignals)
              .where(and(
                eq(workflowSignals.agencyId, agencyId),
                lt(workflowSignals.ingestedAt, cutoffDate)
              ));
            deletedCount = (signalsResult as any).rowCount || 0;
            break;
            
          case 'ai_executions':
            const aiResult = await db.delete(aiExecutionsTable)
              .where(and(
                eq(aiExecutionsTable.agencyId, agencyId),
                lt(aiExecutionsTable.createdAt, cutoffDate)
              ));
            deletedCount = (aiResult as any).rowCount || 0;
            break;
            
          case 'rule_evaluations':
            // Rule evaluations don't have agencyId directly, so we need to join through workflowRules
            // First get rule IDs for this agency, then delete evaluations for those rules
            const agencyRules = await db.select({ id: workflowRules.id })
              .from(workflowRules)
              .where(eq(workflowRules.agencyId, agencyId));
            const agencyRuleIds = agencyRules.map(r => r.id);
            
            if (agencyRuleIds.length > 0) {
              let evalDeletedCount = 0;
              for (const ruleId of agencyRuleIds) {
                const evalResult = await db.delete(workflowRuleEvaluations)
                  .where(and(
                    eq(workflowRuleEvaluations.ruleId, ruleId),
                    lt(workflowRuleEvaluations.createdAt, cutoffDate)
                  ));
                evalDeletedCount += (evalResult as any).rowCount || 0;
              }
              deletedCount = evalDeletedCount;
            }
            break;
        }
        
        // Update policy with cleanup stats
        await db.update(workflowRetentionPolicies)
          .set({
            lastCleanupAt: new Date(),
            recordsDeleted: sql`${workflowRetentionPolicies.recordsDeleted} + ${deletedCount}`,
            updatedAt: new Date(),
          })
          .where(eq(workflowRetentionPolicies.id, policy.id));
        
        results.push({
          resourceType: policy.resourceType,
          retentionDays: policy.retentionDays,
          deletedCount,
          cutoffDate,
        });
      }
      
      res.json({ 
        message: "Retention cleanup completed",
        results 
      });
    } catch (error: any) {
      console.error("Error running retention cleanup:", error);
      res.status(500).json({ message: "Failed to run retention cleanup" });
    }
  });

  // ==================== VECTOR STORAGE API (Priority 6) ====================

  // Get all documents for agency
  app.get("/api/knowledge-documents", requireAuth, async (req: AuthRequest, res) => {
    try {
      // Use user's agency - no query param override allowed for non-superadmins
      const userAgencyId = req.user?.agencyId;
      if (!userAgencyId && !req.user?.isSuperAdmin) {
        return res.status(400).json({ message: "Agency context required" });
      }
      const agencyId = userAgencyId;
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const { documentType, clientId, status } = req.query;
      
      let conditions = [eq(knowledgeDocuments.agencyId, agencyId)];
      if (documentType) {
        conditions.push(eq(knowledgeDocuments.documentType, documentType as string));
      }
      if (clientId) {
        conditions.push(eq(knowledgeDocuments.clientId, clientId as string));
      }
      if (status) {
        conditions.push(eq(knowledgeDocuments.status, status as string));
      }
      
      const docs = await db.select()
        .from(knowledgeDocuments)
        .where(and(...conditions))
        .orderBy(desc(knowledgeDocuments.createdAt));
      
      res.json(docs);
    } catch (error: any) {
      console.error("Error fetching knowledge documents:", error);
      res.status(500).json({ message: "Failed to fetch knowledge documents" });
    }
  });

  // Get single document
  app.get("/api/knowledge-documents/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const agencyId = req.user?.agencyId;
      if (!agencyId && !req.user?.isSuperAdmin) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const doc = await db.select()
        .from(knowledgeDocuments)
        .where(and(
          eq(knowledgeDocuments.id, id),
          eq(knowledgeDocuments.agencyId, agencyId)
        ))
        .limit(1);
      
      if (doc.length === 0) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      res.json(doc[0]);
    } catch (error: any) {
      console.error("Error fetching knowledge document:", error);
      res.status(500).json({ message: "Failed to fetch knowledge document" });
    }
  });

  // Create document and index it
  app.post("/api/knowledge-documents", requireAuth, async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const validated = insertKnowledgeDocumentSchema.parse({
        ...req.body,
        agencyId,
        createdBy: req.user?.id,
        status: "pending",
      });
      
      const [newDoc] = await db.insert(knowledgeDocuments).values(validated).returning();
      
      // If content is provided, start indexing
      if (newDoc.content) {
        await db.update(knowledgeDocuments)
          .set({ status: "processing" })
          .where(eq(knowledgeDocuments.id, newDoc.id));
        
        try {
          const result = await embeddingService.indexDocument(
            newDoc.id,
            agencyId,
            newDoc.content
          );
          
          res.json({
            document: { ...newDoc, status: "indexed", chunkCount: result.chunkCount },
            indexingResult: result,
          });
        } catch (indexError: any) {
          await db.update(knowledgeDocuments)
            .set({ status: "failed", errorMessage: indexError.message })
            .where(eq(knowledgeDocuments.id, newDoc.id));
          
          res.status(500).json({
            document: newDoc,
            message: "Document created but indexing failed",
            error: indexError.message,
          });
        }
      } else {
        res.json({ document: newDoc });
      }
    } catch (error: any) {
      console.error("Error creating knowledge document:", error);
      res.status(500).json({ message: "Failed to create knowledge document" });
    }
  });

  // Update document
  app.patch("/api/knowledge-documents/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const existingDoc = await db.select()
        .from(knowledgeDocuments)
        .where(and(
          eq(knowledgeDocuments.id, id),
          eq(knowledgeDocuments.agencyId, agencyId)
        ))
        .limit(1);
      
      if (existingDoc.length === 0) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      const validated = updateKnowledgeDocumentSchema.parse(req.body);
      
      const [updatedDoc] = await db.update(knowledgeDocuments)
        .set({ ...validated, updatedAt: new Date() })
        .where(eq(knowledgeDocuments.id, id))
        .returning();
      
      // Re-index if content changed
      if (validated.content && validated.content !== existingDoc[0].content) {
        await db.update(knowledgeDocuments)
          .set({ status: "processing" })
          .where(eq(knowledgeDocuments.id, id));
        
        try {
          const result = await embeddingService.indexDocument(id, agencyId, validated.content);
          
          res.json({
            document: { ...updatedDoc, status: "indexed", chunkCount: result.chunkCount },
            reindexed: true,
            indexingResult: result,
          });
        } catch (indexError: any) {
          await db.update(knowledgeDocuments)
            .set({ status: "failed", errorMessage: indexError.message })
            .where(eq(knowledgeDocuments.id, id));
          
          res.json({
            document: updatedDoc,
            reindexed: false,
            error: indexError.message,
          });
        }
      } else {
        res.json({ document: updatedDoc });
      }
    } catch (error: any) {
      console.error("Error updating knowledge document:", error);
      res.status(500).json({ message: "Failed to update knowledge document" });
    }
  });

  // Delete document
  app.delete("/api/knowledge-documents/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const existingDoc = await db.select()
        .from(knowledgeDocuments)
        .where(and(
          eq(knowledgeDocuments.id, id),
          eq(knowledgeDocuments.agencyId, agencyId)
        ))
        .limit(1);
      
      if (existingDoc.length === 0) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Delete embeddings first (cascade would handle this but explicit is clearer)
      await db.delete(documentEmbeddings).where(eq(documentEmbeddings.documentId, id));
      await db.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, id));
      
      // Update index stats
      await embeddingService.updateIndexStats(agencyId);
      
      res.json({ message: "Document deleted" });
    } catch (error: any) {
      console.error("Error deleting knowledge document:", error);
      res.status(500).json({ message: "Failed to delete knowledge document" });
    }
  });

  // Re-index a document
  app.post("/api/knowledge-documents/:id/reindex", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const doc = await db.select()
        .from(knowledgeDocuments)
        .where(and(
          eq(knowledgeDocuments.id, id),
          eq(knowledgeDocuments.agencyId, agencyId)
        ))
        .limit(1);
      
      if (doc.length === 0) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      if (!doc[0].content) {
        return res.status(400).json({ message: "Document has no content to index" });
      }
      
      await db.update(knowledgeDocuments)
        .set({ status: "processing" })
        .where(eq(knowledgeDocuments.id, id));
      
      const result = await embeddingService.indexDocument(id, agencyId, doc[0].content);
      
      res.json({
        message: "Document reindexed",
        result,
      });
    } catch (error: any) {
      console.error("Error reindexing document:", error);
      res.status(500).json({ message: "Failed to reindex document" });
    }
  });

  // Semantic search
  app.post("/api/semantic-search", requireAuth, async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const { query, topK, minScore, documentType, clientId } = req.body;
      
      if (!query || typeof query !== "string") {
        return res.status(400).json({ message: "Query is required" });
      }
      
      const results = await embeddingService.semanticSearch(
        query,
        agencyId,
        { topK, minScore, documentType, clientId },
        req.user?.id
      );
      
      res.json({ results });
    } catch (error: any) {
      console.error("Error performing semantic search:", error);
      res.status(500).json({ message: "Failed to perform semantic search" });
    }
  });

  // Get embedding index stats
  app.get("/api/embedding-stats", requireAuth, async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const stats = await embeddingService.getIndexStats(agencyId);
      
      if (!stats) {
        return res.json({
          totalDocuments: 0,
          totalChunks: 0,
          totalTokens: 0,
          queryCount: 0,
        });
      }
      
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching embedding stats:", error);
      res.status(500).json({ message: "Failed to fetch embedding stats" });
    }
  });

  // Rebuild entire index (Admin only)
  app.post("/api/embedding-index/rebuild", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const result = await embeddingService.rebuildIndex(agencyId);
      
      res.json({
        message: "Index rebuild completed",
        result,
      });
    } catch (error: any) {
      console.error("Error rebuilding index:", error);
      res.status(500).json({ message: "Failed to rebuild index" });
    }
  });

  // Prune orphaned embeddings (Admin only)
  app.post("/api/embedding-index/prune", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const prunedCount = await embeddingService.pruneOrphanedEmbeddings(agencyId);
      
      res.json({
        message: "Prune completed",
        prunedCount,
      });
    } catch (error: any) {
      console.error("Error pruning embeddings:", error);
      res.status(500).json({ message: "Failed to prune embeddings" });
    }
  });

  // ===========================================
  // INTELLIGENCE LAYER ENDPOINTS (Priority 16)
  // ===========================================

  // Intelligence Signals - List signals for agency
  app.get("/api/intelligence/signals", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const { limit, sourceSystem, category, processed } = req.query;
      const signals = await storage.getIntelligenceSignalsByAgencyId(agencyId, {
        limit: limit ? parseInt(limit as string) : undefined,
        sourceSystem: sourceSystem as string | undefined,
        category: category as string | undefined,
        processed: processed ? processed === "true" : undefined,
      });
      
      res.json(signals);
    } catch (error: any) {
      console.error("Error fetching intelligence signals:", error);
      res.status(500).json({ message: "Failed to fetch signals" });
    }
  });

  // Intelligence Signals - Get single signal
  app.get("/api/intelligence/signals/:id", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      const signal = await storage.getIntelligenceSignalById(req.params.id);
      if (!signal) {
        return res.status(404).json({ message: "Signal not found" });
      }
      
      // Check agency access
      const agencyId = req.user?.agencyId;
      if (agencyId && signal.agencyId !== agencyId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(signal);
    } catch (error: any) {
      console.error("Error fetching signal:", error);
      res.status(500).json({ message: "Failed to fetch signal" });
    }
  });

  // Intelligence Signals - Create new signal (for internal/integration use)
  app.post("/api/intelligence/signals", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const signalData = {
        ...req.body,
        agencyId,
        occurredAt: new Date(req.body.occurredAt || Date.now()),
      };
      
      const signal = await storage.createIntelligenceSignal(signalData);
      res.status(201).json(signal);
    } catch (error: any) {
      console.error("Error creating signal:", error);
      res.status(500).json({ message: "Failed to create signal" });
    }
  });

  // Intelligence Signals - Discard a signal
  app.post("/api/intelligence/signals/:id/discard", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      const { reason } = req.body;
      if (!reason) {
        return res.status(400).json({ message: "Discard reason is required" });
      }
      
      const signal = await storage.discardSignal(req.params.id, reason);
      res.json(signal);
    } catch (error: any) {
      console.error("Error discarding signal:", error);
      res.status(500).json({ message: "Failed to discard signal" });
    }
  });

  // Intelligence Insights - List insights for agency
  app.get("/api/intelligence/insights", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const { limit, status, severity, clientId } = req.query;
      const insights = await storage.getIntelligenceInsightsByAgencyId(agencyId, {
        limit: limit ? parseInt(limit as string) : undefined,
        status: status as string | undefined,
        severity: severity as string | undefined,
        clientId: clientId as string | undefined,
      });
      
      res.json(insights);
    } catch (error: any) {
      console.error("Error fetching insights:", error);
      res.status(500).json({ message: "Failed to fetch insights" });
    }
  });

  // Intelligence Insights - Get single insight
  app.get("/api/intelligence/insights/:id", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      const insight = await storage.getIntelligenceInsightById(req.params.id);
      if (!insight) {
        return res.status(404).json({ message: "Insight not found" });
      }
      
      const agencyId = req.user?.agencyId;
      if (agencyId && insight.agencyId !== agencyId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(insight);
    } catch (error: any) {
      console.error("Error fetching insight:", error);
      res.status(500).json({ message: "Failed to fetch insight" });
    }
  });

  // Intelligence Insights - Create insight (for internal/aggregator use)
  app.post("/api/intelligence/insights", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const insightData = {
        ...req.body,
        agencyId,
      };
      
      const insight = await storage.createIntelligenceInsight(insightData);
      res.status(201).json(insight);
    } catch (error: any) {
      console.error("Error creating insight:", error);
      res.status(500).json({ message: "Failed to create insight" });
    }
  });

  // Intelligence Insights - Update status
  app.patch("/api/intelligence/insights/:id/status", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }
      
      const validStatuses = ["open", "prioritised", "actioned", "ignored", "invalid"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const insight = await storage.updateIntelligenceInsightStatus(req.params.id, status);
      res.json(insight);
    } catch (error: any) {
      console.error("Error updating insight status:", error);
      res.status(500).json({ message: "Failed to update insight status" });
    }
  });

  // Intelligence Priority Config - Get config for agency
  app.get("/api/intelligence/priority-config", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const config = await storage.getIntelligencePriorityConfig(agencyId);
      if (!config) {
        // Return defaults if no config exists
        return res.json({
          agencyId,
          wImpact: "0.4",
          wUrgency: "0.3",
          wConfidence: "0.2",
          wResource: "0.1",
        });
      }
      
      res.json(config);
    } catch (error: any) {
      console.error("Error fetching priority config:", error);
      res.status(500).json({ message: "Failed to fetch priority config" });
    }
  });

  // Intelligence Priority Config - Update config
  app.put("/api/intelligence/priority-config", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const { wImpact, wUrgency, wConfidence, wResource } = req.body;
      
      const config = await storage.upsertIntelligencePriorityConfig({
        agencyId,
        wImpact: wImpact || "0.4",
        wUrgency: wUrgency || "0.3",
        wConfidence: wConfidence || "0.2",
        wResource: wResource || "0.1",
      });
      
      res.json(config);
    } catch (error: any) {
      console.error("Error updating priority config:", error);
      res.status(500).json({ message: "Failed to update priority config" });
    }
  });

  // Intelligence Priorities - List priorities for agency
  app.get("/api/intelligence/priorities", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const { limit, status, bucket } = req.query;
      const priorities = await storage.getIntelligencePrioritiesByAgencyId(agencyId, {
        limit: limit ? parseInt(limit as string) : undefined,
        status: status as string | undefined,
        bucket: bucket as string | undefined,
      });
      
      res.json(priorities);
    } catch (error: any) {
      console.error("Error fetching priorities:", error);
      res.status(500).json({ message: "Failed to fetch priorities" });
    }
  });

  // Intelligence Priorities - Get single priority
  app.get("/api/intelligence/priorities/:id", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      const priority = await storage.getIntelligencePriorityById(req.params.id);
      if (!priority) {
        return res.status(404).json({ message: "Priority not found" });
      }
      
      const agencyId = req.user?.agencyId;
      if (agencyId && priority.agencyId !== agencyId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(priority);
    } catch (error: any) {
      console.error("Error fetching priority:", error);
      res.status(500).json({ message: "Failed to fetch priority" });
    }
  });

  // Intelligence Priorities - Create priority (for priority engine use)
  app.post("/api/intelligence/priorities", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const priorityData = {
        ...req.body,
        agencyId,
      };
      
      const priority = await storage.createIntelligencePriority(priorityData);
      res.status(201).json(priority);
    } catch (error: any) {
      console.error("Error creating priority:", error);
      res.status(500).json({ message: "Failed to create priority" });
    }
  });

  // Intelligence Priorities - Update status
  app.patch("/api/intelligence/priorities/:id/status", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }
      
      const validStatuses = ["pending", "in_progress", "done", "dismissed"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const priority = await storage.updateIntelligencePriorityStatus(req.params.id, status);
      res.json(priority);
    } catch (error: any) {
      console.error("Error updating priority status:", error);
      res.status(500).json({ message: "Failed to update priority status" });
    }
  });

  // Intelligence Feedback - List feedback for agency
  app.get("/api/intelligence/feedback", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const { limit, insightId } = req.query;
      const feedback = await storage.getIntelligenceFeedbackByAgencyId(agencyId, {
        limit: limit ? parseInt(limit as string) : undefined,
        insightId: insightId as string | undefined,
      });
      
      res.json(feedback);
    } catch (error: any) {
      console.error("Error fetching feedback:", error);
      res.status(500).json({ message: "Failed to fetch feedback" });
    }
  });

  // Intelligence Feedback - Get single feedback
  app.get("/api/intelligence/feedback/:id", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      const feedback = await storage.getIntelligenceFeedbackById(req.params.id);
      if (!feedback) {
        return res.status(404).json({ message: "Feedback not found" });
      }
      
      const agencyId = req.user?.agencyId;
      if (agencyId && feedback.agencyId !== agencyId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(feedback);
    } catch (error: any) {
      console.error("Error fetching feedback:", error);
      res.status(500).json({ message: "Failed to fetch feedback" });
    }
  });

  // Intelligence Feedback - Submit feedback
  app.post("/api/intelligence/feedback", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const feedbackData = {
        ...req.body,
        agencyId,
        createdByUserId: req.user?.id,
      };
      
      const feedback = await storage.createIntelligenceFeedback(feedbackData);
      res.status(201).json(feedback);
    } catch (error: any) {
      console.error("Error creating feedback:", error);
      res.status(500).json({ message: "Failed to create feedback" });
    }
  });

  // Intelligence Overview - Dashboard summary
  app.get("/api/intelligence/overview", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const [signals, insights, priorities] = await Promise.all([
        storage.getIntelligenceSignalsByAgencyId(agencyId, { limit: 100, processed: false }),
        storage.getOpenIntelligenceInsights(agencyId),
        storage.getPendingIntelligencePriorities(agencyId),
      ]);
      
      res.json({
        unprocessedSignalsCount: signals.length,
        openInsightsCount: insights.length,
        pendingPrioritiesCount: priorities.length,
        recentSignals: signals.slice(0, 10),
        topInsights: insights.slice(0, 5),
        topPriorities: priorities.slice(0, 5),
      });
    } catch (error: any) {
      console.error("Error fetching intelligence overview:", error);
      res.status(500).json({ message: "Failed to fetch intelligence overview" });
    }
  });

  // Intelligence Processing - Process signals into insights (Admin only)
  app.post("/api/intelligence/process-signals", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const { insightAggregator } = await import("./intelligence/insight-aggregator");
      const result = await insightAggregator.processSignals(agencyId);
      
      res.json({
        message: "Signal processing completed",
        ...result,
      });
    } catch (error: any) {
      console.error("Error processing signals:", error);
      res.status(500).json({ message: "Failed to process signals" });
    }
  });

  // Intelligence Processing - Compute priorities from insights (Admin only)
  app.post("/api/intelligence/compute-priorities", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const { priorityEngine } = await import("./intelligence/priority-engine");
      const result = await priorityEngine.processInsights(agencyId);
      
      res.json({
        message: "Priority computation completed",
        ...result,
      });
    } catch (error: any) {
      console.error("Error computing priorities:", error);
      res.status(500).json({ message: "Failed to compute priorities" });
    }
  });

  // Intelligence Processing - Run full pipeline (Admin only)
  app.post("/api/intelligence/run-pipeline", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }
      
      const { insightAggregator } = await import("./intelligence/insight-aggregator");
      const { priorityEngine } = await import("./intelligence/priority-engine");
      
      const signalResult = await insightAggregator.processSignals(agencyId);
      const priorityResult = await priorityEngine.processInsights(agencyId);
      
      res.json({
        message: "Intelligence pipeline completed",
        signalsProcessed: signalResult.processed,
        insightsCreated: signalResult.insightsCreated,
        prioritiesCreated: priorityResult.prioritiesCreated,
      });
    } catch (error: any) {
      console.error("Error running intelligence pipeline:", error);
      res.status(500).json({ message: "Failed to run intelligence pipeline" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
