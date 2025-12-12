/**
 * Signals Router
 * 
 * Signal ingestion and signal route management API.
 * 
 * Routes: 11
 */

import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/supabase-auth';
import { storage } from '../storage';
import { signalRouter } from '../workflow/signal-router';
import { SignalAdapterFactory } from '../workflow/signal-adapters';
import { insertWorkflowSignalRouteSchema, updateWorkflowSignalRouteSchema } from '@shared/schema';

const router = Router();

// ============================================
// SIGNAL INGESTION ROUTES
// ============================================

// Ingest signal from specific source
router.post("/signals/:source/ingest", requireAuth, async (req: AuthRequest, res) => {
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

// Get supported signal sources (must be before :id route)
router.get("/signals/sources", requireAuth, async (_req: AuthRequest, res) => {
  res.json({
    sources: SignalAdapterFactory.getSupportedSources(),
  });
});

// Get unprocessed signals
router.get("/signals/pending", requireAuth, async (req: AuthRequest, res) => {
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
router.get("/signals/failed", requireAuth, async (req: AuthRequest, res) => {
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
router.post("/signals/:id/retry", requireAuth, async (req: AuthRequest, res) => {
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
router.get("/signals/:id", requireAuth, async (req: AuthRequest, res) => {
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

// ============================================
// SIGNAL ROUTES MANAGEMENT
// ============================================

// Get all signal routes for agency
router.get("/signal-routes", requireAuth, async (req: AuthRequest, res) => {
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
router.get("/signal-routes/:id", requireAuth, async (req: AuthRequest, res) => {
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
router.post("/signal-routes", requireAuth, async (req: AuthRequest, res) => {
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
router.patch("/signal-routes/:id", requireAuth, async (req: AuthRequest, res) => {
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
router.delete("/signal-routes/:id", requireAuth, async (req: AuthRequest, res) => {
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

export default router;
