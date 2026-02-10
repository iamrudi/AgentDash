import type { Express, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import settingsRouter from "./routes/settings";
import { mountDomainRouters } from "./routes/index";
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve static invoice PDFs
  const pdfStorageService = new PDFStorageService();
  await pdfStorageService.initialize();
  app.use('/invoices', express.static(path.join(process.cwd(), 'public', 'invoices')));

  // Mount domain routers (modular route handlers)
  mountDomainRouters(app);



  // Agency Portal Routes (protected - Admin only)
  // Note: /api/client/* routes are now handled by client.ts domain router
  // Note: /api/agency/clients, /api/agency/clients/:clientId, /api/agency/clients/:clientId/retainer-hours, 
  //       /api/agency/clients/:clientId/reset-retainer-hours are now handled by agency.ts domain router

  // Note: Agency client routes (/api/agency/clients/:clientId/sync-metrics, /api/agency/clients/:clientId/generate-recommendations,
  // /api/agency/clients/:clientId/strategy-card, /api/agency/clients/:clientId/dashboard-summary)
  // and /api/clients/:clientId/connection-status are now handled by agency-clients.ts domain router

  // Note: GET /api/agency/projects, POST /api/agency/projects, and GET /api/agency/projects/:projectId/lists 
  // are now handled by agency.ts domain router
  // Note: Agency task routes (/api/agency/task-lists, /api/agency/tasks, /api/agency/staff-assignments)
  // are now handled by agency-tasks.ts domain router

  // Note: GET /api/agency/metrics and GET /api/agency/clients/:clientId/metrics 
  // are now handled by agency.ts domain router

  // Note: GET /api/agency/initiatives and GET /api/agency/integrations 
  // are now handled by agency.ts domain router
  // Note: Agency settings routes are now handled by agency-settings.ts domain router

  // Note: GET /api/agency/staff is now handled by agency.ts domain router
  // Note: GET /api/staff/tasks and GET /api/staff/tasks/full are now handled by staff.ts domain router
  // Note: Initiative routes are now handled by initiatives.ts domain router

  app.post("/api/metrics", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const metric = await storage.createMetric(req.body);
      res.status(201).json(metric);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Note: OAuth routes are now handled by oauth.ts domain router
  // Note: Integration routes (GA4, GSC, HubSpot, LinkedIn) are now handled by integrations.ts domain router
  // Note: Dashboard summary route (/api/agency/clients/:clientId/dashboard-summary) 
  // is now handled by agency-clients.ts domain router
  // Note: Analytics routes (/api/analytics/ga4/:clientId/*, /api/analytics/gsc/:clientId/*, /api/analytics/outcome-metrics/:clientId) 
  // are now handled by analytics.ts domain router

  // Note: Client Objectives API routes (/api/agency/clients/:clientId/objectives, /api/agency/objectives/:id)
  // are now handled by objectives.ts domain router

  // Note: AI Chat & Data Analysis routes (/api/ai/analyze-data, /api/ai/request-action)
  // are now handled by ai-chat.ts domain router

  // Client Messages API
  // Note: GET /api/client/messages and POST /api/client/messages are now handled by client.ts domain router
  // Note: Agency messaging routes (/api/agency/messages/*) are now handled by messages.ts domain router

  // Note: GET /api/agency/notifications/counts is now handled by agency.ts domain router

  // Mark initiative responses as viewed (Admin only)
  app.post("/api/agency/initiatives/mark-viewed", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      await storage.markInitiativeResponsesViewed();
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Note: Notification Center Endpoints moved to server/routes/notifications.ts
  // Note: Agency user management routes are now handled by agency-users.ts domain router

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

  // Note: GET /api/client/notifications/counts is now handled by client.ts domain router
  // Note: GET /api/staff/notifications/counts is now handled by staff.ts domain router
  // Note: Proposals routes (/api/proposals) are now handled by proposals.ts domain router

  // Register Settings routes - MOVED TO domain routers
  // app.use("/api/settings", settingsRouter);

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

  // Register SuperAdmin Health routes (system health, maintenance mode)
  const superadminHealthRouter = (await import("./routes/superadmin-health")).default;
  app.use("/api/superadmin", requireAuth, (req, res, next) => {
    const authReq = req as AuthRequest;
    (req as any).user = {
      id: authReq.user?.id,
      agencyId: authReq.user?.agencyId,
      email: authReq.user?.email,
      role: authReq.user?.role,
      isSuperAdmin: authReq.user?.isSuperAdmin,
    };
    next();
  }, superadminHealthRouter);

  // Note: Intelligence routes (signals, insights, priorities, feedback, overview, 
  // process-signals, compute-priorities, run-pipeline, duration/*, resource-optimization/*)
  // are now handled by intelligence.ts and intelligence-extended.ts domain routers

  const httpServer = createServer(app);
  return httpServer;
}
