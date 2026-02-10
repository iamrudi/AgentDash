import type { Express } from "express";
import { createServer, type Server } from "http";
import { mountDomainRouters } from "./routes/index";
import { requireAuth } from "./middleware/supabase-auth";
import { policyBoundary } from "./middleware/policy-boundary";
import { PDFStorageService } from "./services/pdfStorage";
import express from "express";
import path from "path";

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve static invoice PDFs
  const pdfStorageService = new PDFStorageService();
  await pdfStorageService.initialize();
  app.use('/invoices', express.static(path.join(process.cwd(), 'public', 'invoices')));

  // Control-plane policy boundaries
  app.use("/api/workflows", requireAuth, policyBoundary("workflows"));
  app.use("/api/signals", requireAuth, policyBoundary("signals"));
  app.use("/api/workflow-rules", requireAuth, policyBoundary("workflow-rules"));
  app.use("/api/governance", requireAuth, policyBoundary("governance"));

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

  // Note: Notification Center Endpoints moved to server/routes/notifications.ts
  // Note: Agency user management routes are now handled by agency-users.ts domain router

  // Test routes now handled by server/routes/test.ts

  // Note: GET /api/client/notifications/counts is now handled by client.ts domain router
  // Note: GET /api/staff/notifications/counts is now handled by staff.ts domain router
  // Note: Proposals routes (/api/proposals) are now handled by proposals.ts domain router

  // Register Settings routes - MOVED TO domain routers
  // app.use("/api/settings", settingsRouter);

  // Note: Intelligence routes (signals, insights, priorities, feedback, overview, 
  // process-signals, compute-priorities, run-pipeline, duration/*, resource-optimization/*)
  // are now handled by intelligence.ts and intelligence-extended.ts domain routers

  const httpServer = createServer(app);
  return httpServer;
}
