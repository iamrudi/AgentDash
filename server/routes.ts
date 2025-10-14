import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireAuth, requireRole, requireClientAccess, type AuthRequest } from "./middleware/supabase-auth";
import { generateToken } from "./lib/jwt";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { insertUserSchema, insertProfileSchema, insertClientSchema, createClientUserSchema, createStaffAdminUserSchema, insertInvoiceSchema, insertInvoiceLineItemSchema, insertProjectSchema, insertTaskSchema } from "@shared/schema";
import { getAuthUrl, exchangeCodeForTokens, refreshAccessToken, fetchGA4Properties, fetchGSCSites, fetchGA4Data, fetchGA4AcquisitionChannels, fetchGA4KeyEvents, fetchGSCData, fetchGSCTopQueries } from "./lib/googleOAuth";
import { generateOAuthState, verifyOAuthState } from "./lib/oauthState";
import { encrypt, decrypt } from "./lib/encryption";
import { generateContentIdeas, generateContentBrief, optimizeContent } from "./lib/contentGeneration";
import { InvoiceGeneratorService } from "./services/invoiceGenerator";
import { PDFGeneratorService } from "./services/pdfGenerator";
import { PDFStorageService } from "./services/pdfStorage";
import { analyzeDataOnDemand, summarizeLighthouseReport, analyzeChatHistory } from "./gemini";
import { SeoAuditService } from "./services/seoAuditService";
import { EnhancedSeoAuditService } from "./services/enhancedSeoAuditService";
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
      
      // Get default agency first
      const defaultAgency = await storage.getDefaultAgency();
      if (!defaultAgency) {
        return res.status(500).json({ message: "System configuration error: No default agency found" });
      }

      // Create user in Supabase Auth with agencyId in app_metadata
      const { createUserWithProfile } = await import("./lib/supabase-auth");
      
      // SECURITY: Always assign Client role for self-registration
      // Admin and Staff roles must be assigned by existing administrators
      const authResult = await createUserWithProfile(email, password, fullName, "Client", defaultAgency.id);

      // Create client record
      if (companyName) {
        await storage.createClient({
          companyName,
          profileId: authResult.profileId, // This is the Supabase Auth user ID
          agencyId: defaultAgency.id,
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
      if (!req.user!.agencyId) {
        return res.status(403).json({ message: "Agency association required" });
      }
      console.log(`[GET /api/agency/clients] User ${req.user!.email} requesting clients for agency: ${req.user!.agencyId}`);
      const clients = await storage.getAllClientsWithDetails(req.user!.agencyId);
      console.log(`[GET /api/agency/clients] Returned ${clients.length} clients:`, clients.map(c => ({ id: c.id, name: c.companyName, agencyId: c.agencyId })));
      res.json(clients);
    } catch (error: any) {
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
        const { fetchGA4Data } = await import("./lib/googleOAuth");
        const ga4Data = await fetchGA4Data(ga4Integration.accessToken, ga4Integration.ga4PropertyId, start, end, clientId);
        
        // Store GA4 metrics
        for (const row of ga4Data.rows || []) {
          const dateValue = row.dimensionValues?.[0]?.value;
          const sessions = parseInt(row.metricValues?.[0]?.value || '0');
          
          if (dateValue) {
            await storage.createMetric({
              date: dateValue,
              clientId: clientId,
              source: 'GA4',
              sessions: sessions,
              conversions: 0,
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

  app.post("/api/agency/clients/:clientId/generate-recommendations", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const { generateAIRecommendations } = await import("./ai-analyzer");
      
      const result = await generateAIRecommendations(storage, clientId);
      
      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }
      
      res.json({ 
        success: true, 
        message: `Successfully generated ${result.recommendationsCreated} AI-powered recommendations`,
        count: result.recommendationsCreated 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/agency/projects", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
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

  // Create new task
  app.post("/api/agency/tasks", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
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
  app.get("/api/agency/projects/:id", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
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
  app.patch("/api/agency/projects/:id", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
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
  app.patch("/api/agency/tasks/:id", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const updateData = insertTaskSchema.partial().parse(req.body);
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
  app.delete("/api/agency/tasks/:id", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      await storage.deleteTask(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Assign staff to task
  app.post("/api/agency/tasks/:taskId/assign", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const { staffProfileId } = req.body;
      
      if (!staffProfileId) {
        return res.status(400).json({ message: "Staff profile ID is required" });
      }

      const assignment = await storage.createStaffAssignment({
        taskId: req.params.taskId,
        staffProfileId,
      });

      res.status(201).json(assignment);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Remove staff assignment
  app.delete("/api/agency/tasks/:taskId/assign/:staffProfileId", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      await storage.deleteStaffAssignment(req.params.taskId, req.params.staffProfileId);
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
      const recentMessages = messages.slice(-15);
      const chatHistoryText = recentMessages.length > 0
        ? recentMessages.map(msg => `${msg.senderRole}: ${msg.message}`).join('\n')
        : "No recent conversations.";
      
      const chatAnalysis = await analyzeChatHistory(chatHistoryText);

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

  // Get all staff members (for assignment dropdowns)
  app.get("/api/agency/staff", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
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
  app.get("/api/invoices/:invoiceId/line-items", requireAuth, async (req: AuthRequest, res) => {
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

  app.post("/api/invoices/:invoiceId/line-items", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
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
  app.patch("/api/initiatives/:id", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
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
  app.post("/api/initiatives/:id/send", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
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
  app.post("/api/initiatives/:id/respond", requireAuth, requireRole("Client", "Admin"), async (req: AuthRequest, res) => {
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

  // Soft delete initiative (move to trash)
  app.delete("/api/initiatives/:id", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const initiative = await storage.softDeleteInitiative(id);
      res.json({ message: "Initiative moved to trash", initiative });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Restore initiative from trash
  app.post("/api/initiatives/:id/restore", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
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

      res.json({
        message: "Lead event configuration updated successfully",
        ga4LeadEventName: updated.ga4LeadEventName,
      });
    } catch (error: any) {
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

      res.json({
        message: "GA4 property and lead event saved successfully",
        ga4PropertyId: updated.ga4PropertyId,
        ga4LeadEventName: updated.ga4LeadEventName,
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

  // Data for SEO Integration Endpoints

  // Connect Data for SEO integration (Admin only)
  app.post("/api/integrations/dataforseo/:clientId/connect", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const { login, password } = req.body;

      if (!login || !password) {
        return res.status(400).json({ message: "Login and password are required" });
      }

      // Encrypt credentials
      const encryptedLogin = encrypt(login);
      const encryptedPassword = encrypt(password);

      // Check if integration already exists
      const existingIntegration = await storage.getIntegrationByClientId(clientId, 'DataForSEO');

      if (existingIntegration) {
        // Update existing integration
        await storage.updateIntegration(existingIntegration.id, {
          dataForSeoLogin: encryptedLogin.encrypted,
          dataForSeoLoginIv: encryptedLogin.iv,
          dataForSeoLoginAuthTag: encryptedLogin.authTag,
          dataForSeoPassword: encryptedPassword.encrypted,
          dataForSeoPasswordIv: encryptedPassword.iv,
          dataForSeoPasswordAuthTag: encryptedPassword.authTag,
          updatedAt: new Date(),
        });
      } else {
        // Create new integration
        await storage.createIntegration({
          clientId,
          serviceName: 'DataForSEO',
          dataForSeoLogin: encryptedLogin.encrypted,
          dataForSeoLoginIv: encryptedLogin.iv,
          dataForSeoLoginAuthTag: encryptedLogin.authTag,
          dataForSeoPassword: encryptedPassword.encrypted,
          dataForSeoPasswordIv: encryptedPassword.iv,
          dataForSeoPasswordAuthTag: encryptedPassword.authTag,
        });
      }

      res.json({ message: "Data for SEO integration connected successfully" });
    } catch (error: any) {
      console.error("Data for SEO connect error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get Data for SEO integration status (Admin only)
  app.get("/api/integrations/dataforseo/:clientId", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;

      const integration = await storage.getIntegrationByClientId(clientId, 'DataForSEO');

      if (!integration || !integration.dataForSeoLogin) {
        return res.json({ connected: false });
      }

      res.json({
        connected: true,
        createdAt: integration.createdAt,
        updatedAt: integration.updatedAt,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Disconnect Data for SEO integration (Admin only)
  app.delete("/api/integrations/dataforseo/:clientId", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;

      const integration = await storage.getIntegrationByClientId(clientId, 'DataForSEO');

      if (!integration) {
        return res.status(404).json({ message: "Data for SEO integration not found" });
      }

      await storage.deleteIntegration(integration.id);

      res.json({ message: "Data for SEO integration disconnected successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Content Co-pilot API

  // Generate content ideas (Admin only)
  app.post("/api/content/ideas/:clientId", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const { primaryKeyword, competitorUrls, locationCode } = req.body;

      console.error('[Content Ideas] Request received:', { clientId, primaryKeyword, competitorUrls, locationCode });

      // Get client to verify it exists
      const client = await storage.getClientById(clientId);
      if (!client) {
        console.error('[Content Ideas] Client not found:', clientId);
        return res.status(404).json({ message: "Client not found" });
      }

      console.error('[Content Ideas] Client found:', client.companyName);

      // Get GSC integration to retrieve domain
      const gscIntegration = await storage.getIntegrationByClientId(clientId, 'GSC');
      console.error('[Content Ideas] GSC Integration:', { exists: !!gscIntegration, gscSiteUrl: gscIntegration?.gscSiteUrl });
      
      if (!gscIntegration || !gscIntegration.gscSiteUrl) {
        console.error('[Content Ideas] GSC not configured - returning 400');
        return res.status(400).json({ message: "Client website URL not configured. Please configure Google Search Console integration first." });
      }

      // Get Data for SEO credentials
      const dataForSeoIntegration = await storage.getIntegrationByClientId(clientId, 'DataForSEO');
      if (!dataForSeoIntegration || !dataForSeoIntegration.dataForSeoLogin || !dataForSeoIntegration.dataForSeoPassword) {
        return res.status(404).json({ message: "Data for SEO integration not configured" });
      }

      // Verify all required decryption fields are present
      if (!dataForSeoIntegration.dataForSeoLoginIv || !dataForSeoIntegration.dataForSeoLoginAuthTag || !dataForSeoIntegration.dataForSeoPasswordIv || !dataForSeoIntegration.dataForSeoPasswordAuthTag) {
        return res.status(500).json({ message: "Data for SEO integration data is corrupted. Please reconnect the integration." });
      }

      const credentials = {
        login: decrypt(dataForSeoIntegration.dataForSeoLogin, dataForSeoIntegration.dataForSeoLoginIv, dataForSeoIntegration.dataForSeoLoginAuthTag),
        password: decrypt(dataForSeoIntegration.dataForSeoPassword, dataForSeoIntegration.dataForSeoPasswordIv, dataForSeoIntegration.dataForSeoPasswordAuthTag),
      };

      const ideas = await generateContentIdeas(
        credentials,
        gscIntegration.gscSiteUrl,
        primaryKeyword,
        competitorUrls || [],
        locationCode
      );

      res.json(ideas);
    } catch (error: any) {
      console.error("Content ideas generation error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Generate content brief (Admin only)
  app.post("/api/content/brief/:clientId", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const { topic, targetKeywords, targetAudience, contentType, competitorUrls } = req.body;

      const brief = await generateContentBrief(
        topic,
        targetKeywords || [],
        targetAudience || "General audience",
        contentType || "Article",
        competitorUrls || []
      );

      console.log('[Route] Sending brief response:', JSON.stringify(brief, null, 2));
      res.json(brief);
    } catch (error: any) {
      console.error("Content brief generation error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Optimize existing content (Admin only)
  app.post("/api/content/optimize/:clientId", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const { content, targetKeywords, currentUrl } = req.body;

      const optimization = await optimizeContent(
        content,
        targetKeywords || [],
        currentUrl
      );

      res.json(optimization);
    } catch (error: any) {
      console.error("Content optimization error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Analytics Data API

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

      const analysis = await analyzeDataOnDemand(
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

      res.status(201).json(newMessage);
    } catch (error: any) {
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

      // Create user in Supabase Auth
      const { createUserWithProfile } = await import("./lib/supabase-auth");
      
      // Create user and profile in admin's agency
      if (!req.user!.agencyId) {
        return res.status(403).json({ message: "Admin user has no agency association" });
      }
      
      const authResult = await createUserWithProfile(email, password, fullName, "Client", req.user!.agencyId);
      
      // Create client record in the admin's agency
      const client = await storage.createClient({
        companyName,
        profileId: authResult.profileId, // Supabase Auth user ID
        agencyId: req.user!.agencyId,
      });

      res.status(201).json({ 
        message: "Client created successfully",
        client: { 
          id: client.id, 
          companyName: client.companyName,
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
      if (!req.user!.agencyId) {
        return res.status(403).json({ message: "Agency association required" });
      }
      const users = await storage.getAllUsersWithProfiles(req.user!.agencyId);
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

      // Create user in Supabase Auth
      const { createUserWithProfile } = await import("./lib/supabase-auth");
      
      // Ensure admin has agencyId for Staff/Admin users
      if (!req.user!.agencyId) {
        return res.status(403).json({ message: "Admin user has no agency association" });
      }
      
      const authResult = await createUserWithProfile(email, password, fullName, role, req.user!.agencyId);

      res.status(201).json({ 
        message: `${role} user created successfully`,
        user: { 
          id: authResult.profileId,
          email: email,
          fullName: fullName,
          role: role
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
        const { email, password, fullName, role, companyName, agencyId: requestedAgencyId } = req.body;
        
        console.log(`[TEST CREATE USER] Request: email=${email}, role=${role}, requestedAgencyId=${requestedAgencyId}`);
        
        // Create user in Supabase Auth
        const { createUserWithProfile } = await import("./lib/supabase-auth");
        
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
        
        const authResult = await createUserWithProfile(
          email, 
          password, 
          fullName, 
          role || "Client",
          agencyId
        );
        
        console.log(`[TEST CREATE USER] Profile created with ID: ${authResult.profileId}`);

        // Create client record if role is Client and companyName provided
        if ((role === "Client" || !role) && companyName && agencyId) {
          await storage.createClient({
            companyName,
            profileId: authResult.profileId,
            agencyId: agencyId,
          });
        }

        res.status(201).json({ 
          message: "Test user created successfully",
          user: { id: authResult.profileId, email: email },
          profile: { id: authResult.profileId, fullName: fullName, role: role || "Client", agencyId }
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

  // SEO Audit endpoint (Admin only)
  app.post("/api/seo/audit", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const { url, clientId, targetKeyword } = req.body;
      if (!url) {
        return res.status(400).json({ message: "URL is required" });
      }

      const enhancedAuditService = new EnhancedSeoAuditService();
      let dataForSeoCredentials;

      // If client ID is provided, try to get Data for SEO credentials
      if (clientId) {
        const integration = await storage.getIntegrationByClientId(clientId, 'DataForSEO');
        if (integration?.dataForSeoLogin && integration?.dataForSeoPassword) {
          try {
            const login = decrypt(
              integration.dataForSeoLogin,
              integration.dataForSeoLoginIv!,
              integration.dataForSeoLoginAuthTag!
            );
            const password = decrypt(
              integration.dataForSeoPassword,
              integration.dataForSeoPasswordIv!,
              integration.dataForSeoPasswordAuthTag!
            );
            dataForSeoCredentials = { login, password };
          } catch (error) {
            console.error('Failed to decrypt Data for SEO credentials:', error);
          }
        }
      }

      // Run enhanced audit
      const auditResult = await enhancedAuditService.runEnhancedAudit(
        url,
        targetKeyword,
        dataForSeoCredentials
      );

      // Get AI summary with enhanced data
      const aiSummary = await summarizeLighthouseReport(url, auditResult.lighthouseReport);

      res.json({
        ...auditResult,
        aiSummary,
      });
    } catch (error: any) {
      console.error("SEO Audit endpoint error:", error);
      res.status(500).json({ message: error.message || "Failed to perform SEO audit" });
    }
  });

  // Create initiative from SEO recommendation (Admin only)
  app.post("/api/seo/audit/create-initiative", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      // Validate request body with Zod
      const schema = z.object({
        clientId: z.string().uuid(),
        recommendation: z.string().min(1),
        auditUrl: z.string().url(),
      });
      
      const validation = schema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid request data", errors: validation.error.errors });
      }

      const { clientId, recommendation, auditUrl } = validation.data;

      // Get client to include company name in observation
      const client = await storage.getClientById(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // Create initiative with client-friendly language including company name
      const initiative = await storage.createInitiative({
        title: `SEO Improvement: ${recommendation.substring(0, 80)}${recommendation.length > 80 ? '...' : ''}`,
        observation: `Based on our SEO audit of ${auditUrl}, we identified an opportunity to improve ${client.companyName}'s website search engine performance and user experience.`,
        proposedAction: recommendation,
        status: "Draft",
        clientId,
        impact: "Medium",
      });

      res.json(initiative);
    } catch (error: any) {
      console.error("Create initiative from SEO error:", error);
      res.status(500).json({ message: error.message || "Failed to create initiative" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
