import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireAuth, requireRole, type AuthRequest } from "./middleware/auth";
import { generateToken } from "./lib/jwt";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { insertUserSchema, insertProfileSchema, insertClientSchema, createClientUserSchema, createStaffAdminUserSchema, insertInvoiceSchema, insertInvoiceLineItemSchema } from "@shared/schema";
import { getAuthUrl, exchangeCodeForTokens, refreshAccessToken, fetchGA4Properties, fetchGSCSites } from "./lib/googleOAuth";
import { generateOAuthState, verifyOAuthState } from "./lib/oauthState";
import { InvoiceGeneratorService } from "./services/invoiceGenerator";
import { PDFGeneratorService } from "./services/pdfGenerator";
import { PDFStorageService } from "./services/pdfStorage";
import express from "express";
import path from "path";

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve static invoice PDFs
  const pdfStorageService = new PDFStorageService();
  await pdfStorageService.initialize();
  app.use('/invoices', express.static(path.join(process.cwd(), 'public', 'invoices')));

  // Authentication Routes (public)
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, fullName, companyName } = req.body;
      
      // Check if user exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Create user
      const user = await storage.createUser({ email, password });

      // SECURITY: Always assign Client role for self-registration
      // Admin and Staff roles must be assigned by existing administrators
      const profile = await storage.createProfile({
        userId: user.id,
        fullName,
        role: "Client",
      });

      // Create client record
      if (companyName) {
        await storage.createClient({
          companyName,
          profileId: profile.id,
        });
      }

      res.status(201).json({ message: "Account created successfully" });
    } catch (error: any) {
      console.error("Signup error:", error);
      res.status(500).json({ message: error.message || "Signup failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const profile = await storage.getProfileByUserId(user.id);
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }

      // Generate JWT token
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: profile.role,
      });

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          profile,
        },
      });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ message: error.message || "Login failed" });
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
        // Admins see all projects
        const allProjects = await storage.getAllProjects();
        const projectsWithClients = await Promise.all(
          allProjects.map(async (project) => {
            const client = await storage.getClientById(project.clientId);
            return { ...project, client };
          })
        );
        return res.json(projectsWithClients);
      }

      // Clients see only their own projects
      const profile = await storage.getUserById(req.user!.id).then(u => storage.getProfileByUserId(u!.id));
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

  app.get("/api/client/invoices", requireAuth, requireRole("Client", "Admin"), async (req: AuthRequest, res) => {
    try {
      if (req.user!.role === "Admin") {
        // Admins see all invoices
        const allInvoices = await storage.getAllInvoices();
        const invoicesWithClients = await Promise.all(
          allInvoices.map(async (invoice) => {
            const client = await storage.getClientById(invoice.clientId);
            return { ...invoice, client };
          })
        );
        return res.json(invoicesWithClients);
      }

      // Clients see only their own invoices
      const profile = await storage.getUserById(req.user!.id).then(u => storage.getProfileByUserId(u!.id));
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
        // Admins see all initiatives
        const allInitiatives = await storage.getAllInitiatives();
        const initsWithClients = await Promise.all(
          allInitiatives.map(async (init) => {
            const client = await storage.getClientById(init.clientId);
            return { ...init, client };
          })
        );
        return res.json(initsWithClients);
      }

      // Clients see only their own initiatives
      const profile = await storage.getUserById(req.user!.id).then(u => storage.getProfileByUserId(u!.id));
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
      const clients = await storage.getAllClients();
      res.json(clients);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/agency/clients/:clientId", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
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

  app.get("/api/agency/projects", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const projects = await storage.getAllProjects();
      res.json(projects);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/agency/metrics", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const metrics = await storage.getAllMetrics(90);
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/agency/initiatives", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const initiatives = await storage.getAllInitiatives();
      res.json(initiatives);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/agency/integrations", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const integrations = await storage.getAllIntegrations();
      // Only return safe metadata - no tokens
      const safeIntegrations = integrations.map(({ accessToken, refreshToken, accessTokenIv, refreshTokenIv, accessTokenAuthTag, refreshTokenAuthTag, ...safe }) => safe);
      res.json(safeIntegrations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Staff Portal Routes (protected - Staff only)
  app.get("/api/staff/tasks", requireAuth, requireRole("Staff", "Admin"), async (req: AuthRequest, res) => {
    try {
      const allTasks = await storage.getAllTasks();
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

  app.patch("/api/tasks/:id", requireAuth, requireRole("Staff", "Admin"), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const updatedTask = await storage.updateTask(id, req.body);
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

  app.patch("/api/invoices/:invoiceId/status", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
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
  app.get("/api/client/invoices/:invoiceId", requireAuth, requireRole("Client", "Admin"), async (req: AuthRequest, res) => {
    try {
      const { invoiceId } = req.params;
      const invoice = await storage.getInvoiceById(invoiceId);
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Check authorization - clients can only view their own invoices
      if (req.user!.role === "Client") {
        const user = await storage.getUserById(req.user!.id);
        if (!user) {
          return res.status(403).json({ message: "User not found" });
        }
        const profile = await storage.getProfileByUserId(user.id);
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
  app.get("/api/invoices/:invoiceId/line-items", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { invoiceId } = req.params;
      const lineItems = await storage.getInvoiceLineItemsByInvoiceId(invoiceId);
      res.json(lineItems);
    } catch (error: any) {
      console.error("Get invoice line items error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch invoice line items" });
    }
  });

  app.post("/api/invoices/:invoiceId/line-items", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const { invoiceId } = req.params;
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
  app.post("/api/invoices/:invoiceId/generate-pdf", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
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
      const initiative = await storage.createInitiative(req.body);
      res.status(201).json(initiative);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update initiative (edit before sending)
  app.patch("/api/initiatives/:id", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { title, observation, proposedAction, cost, impact } = req.body;
      
      const initiative = await storage.updateInitiative(id, {
        title,
        observation,
        proposedAction,
        cost,
        impact
      });
      
      res.json(initiative);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Send initiative to client
  app.post("/api/initiatives/:id/send", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const initiative = await storage.sendInitiativeToClient(id);
      res.json(initiative);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Client responds to initiative (approve/reject/discuss)
  app.post("/api/initiatives/:id/respond", requireAuth, requireRole("Client", "Admin"), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { response, feedback } = req.body;
      
      if (!["approved", "rejected", "discussing"].includes(response)) {
        return res.status(400).json({ message: "Invalid response. Must be 'approved', 'rejected', or 'discussing'" });
      }
      
      const initiative = await storage.updateInitiativeClientResponse(id, response, feedback);
      res.json(initiative);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Generate invoice from approved initiative
  app.post("/api/initiatives/:id/generate-invoice", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
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

      // Get client ID - for Admin, use query param; for Client, use their own
      let clientId: string;
      
      if (profile.role === "Admin") {
        // Admin is setting up integration for a specific client
        const targetClientId = req.query.clientId as string;
        if (!targetClientId) {
          return res.status(400).json({ message: "clientId query parameter required for Admin" });
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
        return res.status(403).json({ message: "Only Admin and Client can initiate OAuth" });
      }

      // Create cryptographically signed state parameter for CSRF protection
      const state = generateOAuthState(clientId, profile.role, service);

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
      
      const { clientId, service } = stateData;

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

      // Redirect based on who initiated
      if (stateData.initiatedBy === "Admin") {
        res.redirect(`/agency/integrations?success=google_connected&clientId=${clientId}&service=${service}`);
      } else {
        res.redirect('/client?oauth_success=true');
      }
    } catch (error: any) {
      console.error("OAuth callback error:", error);
      res.redirect(`/client?oauth_error=${encodeURIComponent(error.message)}`);
    }
  });

  // Get GA4 integration status for a client
  app.get("/api/integrations/ga4/:clientId", requireAuth, requireRole("Admin", "Client"), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const profile = await storage.getProfileByUserId(req.user!.id);
      
      // Security: Clients can only view their own integration
      if (profile!.role === "Client") {
        const client = await storage.getClientByProfileId(profile!.id);
        if (!client || client.id !== clientId) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

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
  app.get("/api/integrations/ga4/:clientId/properties", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
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

      const properties = await fetchGA4Properties(integration.accessToken!);
      res.json(properties);
    } catch (error: any) {
      console.error("Fetch properties error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch properties" });
    }
  });

  // Save selected GA4 property (Admin only)
  app.post("/api/integrations/ga4/:clientId/property", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const { ga4PropertyId } = req.body;

      if (!ga4PropertyId) {
        return res.status(400).json({ message: "ga4PropertyId is required" });
      }

      const integration = await storage.getIntegrationByClientId(clientId, 'GA4');
      
      if (!integration) {
        return res.status(404).json({ message: "GA4 integration not found" });
      }

      const updated = await storage.updateIntegration(integration.id, {
        ga4PropertyId,
      });

      res.json({
        message: "GA4 property saved successfully",
        ga4PropertyId: updated.ga4PropertyId,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Google Search Console Routes
  
  // Get GSC integration status for a client
  app.get("/api/integrations/gsc/:clientId", requireAuth, requireRole("Admin", "Client"), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const profile = await storage.getProfileByUserId(req.user!.id);
      
      // Security: Clients can only view their own integration
      if (profile!.role === "Client") {
        const client = await storage.getClientByProfileId(profile!.id);
        if (!client || client.id !== clientId) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

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
  app.get("/api/integrations/gsc/:clientId/sites", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
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

      const sites = await fetchGSCSites(integration.accessToken!);
      res.json(sites);
    } catch (error: any) {
      console.error("Fetch sites error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch sites" });
    }
  });

  // Save selected GSC site (Admin only)
  app.post("/api/integrations/gsc/:clientId/site", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
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

  // Save selected GA4 property (Admin only)
  app.post("/api/integrations/ga4/:clientId/property", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const { ga4PropertyId } = req.body;

      if (!ga4PropertyId) {
        return res.status(400).json({ message: "ga4PropertyId is required" });
      }

      const integration = await storage.getIntegrationByClientId(clientId, 'GA4');
      
      if (!integration) {
        return res.status(404).json({ message: "GA4 integration not found" });
      }

      const updated = await storage.updateIntegration(integration.id, {
        ga4PropertyId,
      });

      res.json({
        message: "GA4 property saved successfully",
        ga4PropertyId: updated.ga4PropertyId,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Disconnect GA4 integration (Admin only)
  app.delete("/api/integrations/ga4/:clientId", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
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
  app.delete("/api/integrations/gsc/:clientId", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
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

  // Client Objectives API

  // Get objectives for a client (Admin only)
  app.get("/api/agency/clients/:clientId/objectives", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
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
  app.post("/api/agency/clients/:clientId/objectives", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
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
      const messages = await storage.getAllMessages();
      res.json(messages);
    } catch (error: any) {
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

      res.status(201).json(newMessage);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Send message from admin to client (legacy route with clientId in URL)
  app.post("/api/agency/messages/:clientId", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
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

      res.status(201).json(newMessage);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get notification counts (Admin only)
  app.get("/api/agency/notifications/counts", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const counts = await storage.getNotificationCounts();
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

  // Create client user (Admin only)
  app.post("/api/agency/clients/create-user", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      // Validate request body with schema
      const validatedData = createClientUserSchema.parse(req.body);
      const { email, password, fullName, companyName } = validatedData;

      // Check if user exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      // Create user
      const user = await storage.createUser({ email, password });

      // Create profile with Client role
      const profile = await storage.createProfile({
        userId: user.id,
        fullName,
        role: "Client",
      });

      // Create client record
      const client = await storage.createClient({
        companyName,
        profileId: profile.id,
      });

      res.status(201).json({ 
        message: "Client created successfully",
        client: { 
          id: client.id, 
          companyName: client.companyName,
          user: { 
            email: user.email,
            fullName: profile.fullName
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
      const users = await storage.getAllUsersWithProfiles();
      res.json(users);
    } catch (error: any) {
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

      await storage.deleteUser(userId);
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

      // Check if user exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      // Create user
      const user = await storage.createUser({ email, password });

      // Create profile with specified role
      const profile = await storage.createProfile({
        userId: user.id,
        fullName,
        role,
      });

      res.status(201).json({ 
        message: `${role} user created successfully`,
        user: { 
          id: user.id,
          email: user.email,
          fullName: profile.fullName,
          role: profile.role
        }
      });
    } catch (error: any) {
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
        const { email, password, fullName, role, companyName } = req.body;
        
        // Check if user exists
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser) {
          return res.status(400).json({ message: "User already exists" });
        }

        // Create user
        const user = await storage.createUser({ email, password });

        // Create profile with specified role (bypassing normal security)
        const profile = await storage.createProfile({
          userId: user.id,
          fullName,
          role: role || "Client",
        });

        // Create client record if role is Client and companyName provided
        if (role === "Client" && companyName) {
          await storage.createClient({
            companyName,
            profileId: profile.id,
          });
        }

        res.status(201).json({ 
          message: "Test user created successfully",
          user: { id: user.id, email: user.email },
          profile: { id: profile.id, fullName: profile.fullName, role: profile.role }
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

  const httpServer = createServer(app);
  return httpServer;
}
