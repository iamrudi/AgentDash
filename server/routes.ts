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
import { durationIntelligenceIntegration } from "./intelligence/duration-intelligence-integration";
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

  // ===========================================
  // DURATION INTELLIGENCE API ENDPOINTS
  // ===========================================

  // Duration Model - Get prediction for a task
  app.post("/api/intelligence/duration/predict", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }

      const { durationModelService } = await import("./intelligence/duration-model-service");
      const prediction = await durationModelService.predictDuration(agencyId, req.body);
      res.json(prediction);
    } catch (error: any) {
      console.error("Error generating duration prediction:", error);
      res.status(500).json({ message: "Failed to generate duration prediction" });
    }
  });

  // Duration Model - Get model stats
  app.get("/api/intelligence/duration/stats", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }

      const { durationModelService } = await import("./intelligence/duration-model-service");
      const stats = await durationModelService.getModelStats(agencyId);
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching duration model stats:", error);
      res.status(500).json({ message: "Failed to fetch duration model stats" });
    }
  });

  // Duration Model - Get execution history
  app.get("/api/intelligence/duration/history", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const taskType = req.query.taskType as string;
      const clientId = req.query.clientId as string;

      const history = await storage.getTaskExecutionHistoryByAgencyId(agencyId, { limit, taskType, clientId });
      res.json(history);
    } catch (error: any) {
      console.error("Error fetching execution history:", error);
      res.status(500).json({ message: "Failed to fetch execution history" });
    }
  });

  // Duration Model - Record task completion
  app.post("/api/intelligence/duration/record-completion", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }

      const { durationModelService } = await import("./intelligence/duration-model-service");
      await durationModelService.recordTaskCompletion(agencyId, req.body);
      res.json({ success: true, message: "Completion recorded successfully" });
    } catch (error: any) {
      console.error("Error recording task completion:", error);
      res.status(500).json({ message: "Failed to record task completion" });
    }
  });

  // Resource Optimization - Generate allocation plan
  app.post("/api/intelligence/resource-optimization/generate-plan", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }

      const { resourceOptimizerService } = await import("./intelligence/resource-optimizer-service");
      const { tasks, startDate, endDate } = req.body;
      
      const result = await resourceOptimizerService.generateAllocationPlan(
        agencyId,
        tasks,
        new Date(startDate),
        new Date(endDate)
      );
      res.json(result);
    } catch (error: any) {
      console.error("Error generating allocation plan:", error);
      res.status(500).json({ message: "Failed to generate allocation plan" });
    }
  });

  // Resource Optimization - Save allocation plan
  app.post("/api/intelligence/resource-optimization/save-plan", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        return res.status(400).json({ message: "Agency context required" });
      }

      const { resourceOptimizerService } = await import("./intelligence/resource-optimizer-service");
      const { name, startDate, endDate, assignments, objective } = req.body;
      
      const plan = await resourceOptimizerService.saveAllocationPlan(
        agencyId,
        name,
        new Date(startDate),
        new Date(endDate),
        assignments,
        objective,
        req.user?.id || null
      );
      res.json(plan);
    } catch (error: any) {
      console.error("Error saving allocation plan:", error);
      res.status(500).json({ message: "Failed to save allocation plan" });
    }
  });



  const httpServer = createServer(app);
  return httpServer;
}
