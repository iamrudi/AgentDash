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
import { insertUserSchema, insertProfileSchema, insertClientSchema, createClientUserSchema, createStaffAdminUserSchema, insertInvoiceSchema, insertInvoiceLineItemSchema, insertProjectSchema, insertTaskSchema, updateTaskSchema, agencySettings, updateAgencySettingSchema } from "@shared/schema";
import { getAuthUrl, exchangeCodeForTokens, refreshAccessToken, fetchGA4Properties, fetchGSCSites, fetchGA4Data, fetchGA4AcquisitionChannels, fetchGA4KeyEvents, fetchGA4AvailableKeyEvents, fetchGSCData, fetchGSCTopQueries } from "./lib/googleOAuth";
import { generateOAuthState, verifyOAuthState } from "./lib/oauthState";
import { encrypt, decrypt, safeDecryptCredential } from "./lib/encryption";
import { InvoiceGeneratorService } from "./services/invoiceGenerator";
import { PDFGeneratorService } from "./services/pdfGenerator";
import { PDFStorageService } from "./services/pdfStorage";
import { getAIProvider, invalidateAIProviderCache } from "./ai/provider";
import { cache, CACHE_TTL } from "./lib/cache";
import express from "express";
import path from "path";
import { EventEmitter } from "events";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";

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
      const updateData = updateTaskSchema.parse(req.body);
      const updatedTask = await storage.updateTask(req.params.id, updateData);

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
      if (!req.user!.agencyId) {
        return res.status(403).json({ message: "Agency association required" });
      }

      // Validate request body
      const validationResult = updateAgencySettingSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid settings data",
          errors: validationResult.error.errors,
        });
      }

      const { aiProvider } = validationResult.data;

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
          const project = await storage.getProjectById(task.projectId);
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
      
      const updatedTask = await storage.updateTask(id, req.body);
      
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
      
      if (!["approved", "rejected", "discussing"].includes(response)) {
        return res.status(400).json({ message: "Invalid response. Must be 'approved', 'rejected', or 'discussing'" });
      }
      
      // Get initiative to check billing type
      const existingInitiative = await storage.getInitiativeById(id);
      if (!existingInitiative) {
        return res.status(404).json({ message: "Initiative not found" });
      }
      
      // If approving an hours-based initiative, check and deduct retainer hours
      if (response === "approved" && existingInitiative.billingType === "hours" && existingInitiative.estimatedHours) {
        const hoursNeeded = parseFloat(existingInitiative.estimatedHours);
        const hoursInfo = await storage.checkRetainerHours(existingInitiative.clientId);
        
        if (hoursInfo.available < hoursNeeded) {
          return res.status(400).json({ 
            message: `Insufficient retainer hours. You have ${hoursInfo.available} hours available but need ${hoursNeeded} hours. Please contact your account manager to purchase additional hours.` 
          });
        }
        
        // Deduct the hours
        await storage.deductRetainerHours(existingInitiative.clientId, hoursNeeded);
      }
      
      const initiative = await storage.updateInitiativeClientResponse(id, response, feedback);
      
      // If approved, automatically create project and invoice (if not already created)
      let projectId: string | undefined = existingInitiative.projectId || undefined;
      let invoiceId: string | undefined = existingInitiative.invoiceId || undefined;
      
      if (response === "approved") {
        // Create project if not already created
        if (!projectId) {
          try {
            const project = await storage.createProject({
              name: existingInitiative.title,
              description: existingInitiative.proposedAction || existingInitiative.observation,
              status: "Active",
              clientId: existingInitiative.clientId,
            });
            projectId = project.id;
            
            // Persist project reference in initiative
            await storage.updateInitiative(id, { projectId: project.id });
            
            console.log(`Created project ${project.id} from approved initiative ${id}`);
          } catch (projectError) {
            console.error("Failed to create project from initiative:", projectError);
            // Don't fail the approval, just log the error
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
          ? `Initiative approved successfully${projectId ? ', project created' : ''}${invoiceId ? ', invoice generated' : ''}` 
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
      const { encryptedData, iv, authTag } = encrypt(accessToken);

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
            hubspotAccessToken: encryptedData,
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
            hubspotAccessToken: encryptedData,
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
      const { encryptedData, iv, authTag } = encrypt(accessToken);

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
            linkedinAccessToken: encryptedData,
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
            linkedinAccessToken: encryptedData,
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
  app.post("/api/proposals/:id/print-token", requireAuth, async (req, res) => {
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

  const httpServer = createServer(app);
  return httpServer;
}
