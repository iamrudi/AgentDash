import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireAuth, requireRole, type AuthRequest } from "./middleware/auth";
import { generateToken } from "./lib/jwt";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { insertUserSchema, insertProfileSchema, insertClientSchema } from "@shared/schema";
import { getAuthUrl, exchangeCodeForTokens, refreshAccessToken, fetchGA4Properties } from "./lib/googleOAuth";
import { generateOAuthState, verifyOAuthState } from "./lib/oauthState";

export async function registerRoutes(app: Express): Promise<Server> {
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

  app.get("/api/client/recommendations", requireAuth, requireRole("Client", "Admin"), async (req: AuthRequest, res) => {
    try {
      if (req.user!.role === "Admin") {
        // Admins see all recommendations
        const allRecommendations = await storage.getAllRecommendations();
        const recsWithClients = await Promise.all(
          allRecommendations.map(async (rec) => {
            const client = await storage.getClientById(rec.clientId);
            return { ...rec, client };
          })
        );
        return res.json(recsWithClients);
      }

      // Clients see only their own recommendations
      const profile = await storage.getUserById(req.user!.id).then(u => storage.getProfileByUserId(u!.id));
      const client = await storage.getClientByProfileId(profile!.id);
      
      if (!client) {
        return res.json([]);
      }

      const recommendations = await storage.getRecommendationsByClientId(client.id);
      const recsWithClient = recommendations.map(r => ({ ...r, client }));
      res.json(recsWithClient);
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

  app.get("/api/agency/recommendations", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const recommendations = await storage.getAllRecommendations();
      res.json(recommendations);
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
      const invoice = await storage.createInvoice(req.body);
      res.status(201).json(invoice);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/recommendations", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const recommendation = await storage.createRecommendation(req.body);
      res.status(201).json(recommendation);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update recommendation (edit before sending)
  app.patch("/api/recommendations/:id", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { title, observation, proposedAction, cost, impact } = req.body;
      
      const recommendation = await storage.updateRecommendation(id, {
        title,
        observation,
        proposedAction,
        cost,
        impact
      });
      
      res.json(recommendation);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Send recommendation to client
  app.post("/api/recommendations/:id/send", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const recommendation = await storage.sendRecommendationToClient(id);
      res.json(recommendation);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Client responds to recommendation (approve/reject/discuss)
  app.post("/api/recommendations/:id/respond", requireAuth, requireRole("Client", "Admin"), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { response, feedback } = req.body;
      
      if (!["approved", "rejected", "discussing"].includes(response)) {
        return res.status(400).json({ message: "Invalid response. Must be 'approved', 'rejected', or 'discussing'" });
      }
      
      const recommendation = await storage.updateRecommendationClientResponse(id, response, feedback);
      res.json(recommendation);
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

  // OAuth Routes for Google Analytics 4
  // Initiate OAuth flow (Admin or Client can initiate)
  app.get("/api/oauth/google/initiate", requireAuth, async (req: AuthRequest, res) => {
    try {
      const profile = await storage.getProfileByUserId(req.user!.id);
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
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
      const state = generateOAuthState(clientId, profile.role);

      const authUrl = getAuthUrl(state);
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
      
      const { clientId } = stateData;

      // Exchange code for tokens
      const tokens = await exchangeCodeForTokens(code as string);

      // Check if integration already exists (upsert pattern)
      const existing = await storage.getIntegrationByClientId(clientId, 'GA4');
      
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
          serviceName: 'GA4',
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
        });
      }

      // Redirect based on who initiated
      if (stateData.initiatedBy === "Admin") {
        res.redirect(`/agency?success=ga4_connected&clientId=${clientId}`);
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

  // Send message from admin to client
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

  const httpServer = createServer(app);
  return httpServer;
}
