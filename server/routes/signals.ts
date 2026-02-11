/**
 * Signals Router
 * 
 * Signal ingestion and signal route management API.
 * 
 * Routes: 11
 */

import { Router } from 'express';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/supabase-auth';
import { storage } from '../storage';
import { SignalService } from '../application/signals/signal-service';

const router = Router();
const signalService = new SignalService(storage);
router.use(requireAuth, requireRole("Admin", "SuperAdmin"));

// ============================================
// SIGNAL INGESTION ROUTES
// ============================================

// Ingest signal from specific source
export function createSignalIngestHandler(service: SignalService = signalService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.ingest({
        agencyId: req.user?.agencyId,
        source: req.params.source,
        data: req.body?.data,
        clientId: req.body?.clientId,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error ingesting signal:", error);
      return res.status(500).json({ message: error.message || "Failed to ingest signal" });
    }
  };
}

router.post("/signals/:source/ingest", requireAuth, createSignalIngestHandler());

// Get supported signal sources (must be before :id route)
export function createSignalSourcesHandler(service: SignalService = signalService) {
  return async (_req: AuthRequest, res: any) => {
    const result = service.supportedSources();
    return res.status(result.status).json(result.data);
  };
}

router.get("/signals/sources", requireAuth, createSignalSourcesHandler());

// Get unprocessed signals
export function createSignalPendingHandler(service: SignalService = signalService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.pendingSignals(req.user?.agencyId, req.query.limit);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error fetching pending signals:", error);
      return res.status(500).json({ message: "Failed to fetch pending signals" });
    }
  };
}

router.get("/signals/pending", requireAuth, createSignalPendingHandler());

// Get failed signals
export function createSignalFailedHandler(service: SignalService = signalService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.failedSignals(req.user?.agencyId, req.query.limit);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error fetching failed signals:", error);
      return res.status(500).json({ message: "Failed to fetch failed signals" });
    }
  };
}

router.get("/signals/failed", requireAuth, createSignalFailedHandler());

// Retry failed signal
export function createSignalRetryHandler(service: SignalService = signalService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.retrySignal(req.params.id, {
        agencyId: req.user?.agencyId,
        isSuperAdmin: req.user?.isSuperAdmin,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error retrying signal:", error);
      return res.status(500).json({ message: error.message || "Failed to retry signal" });
    }
  };
}

router.post("/signals/:id/retry", requireAuth, createSignalRetryHandler());

// Get signal by ID
export function createSignalGetHandler(service: SignalService = signalService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getSignal(req.params.id, {
        agencyId: req.user?.agencyId,
        isSuperAdmin: req.user?.isSuperAdmin,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error fetching signal:", error);
      return res.status(500).json({ message: "Failed to fetch signal" });
    }
  };
}

router.get("/signals/:id", requireAuth, createSignalGetHandler());

// ============================================
// SIGNAL ROUTES MANAGEMENT
// ============================================

// Get all signal routes for agency
export function createSignalRoutesListHandler(service: SignalService = signalService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.listRoutes(req.user?.agencyId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error fetching signal routes:", error);
      return res.status(500).json({ message: "Failed to fetch signal routes" });
    }
  };
}

router.get("/signal-routes", requireAuth, createSignalRoutesListHandler());

// Get signal route by ID
export function createSignalRouteGetHandler(service: SignalService = signalService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getRoute(req.params.id, {
        agencyId: req.user?.agencyId,
        isSuperAdmin: req.user?.isSuperAdmin,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error fetching signal route:", error);
      return res.status(500).json({ message: "Failed to fetch signal route" });
    }
  };
}

router.get("/signal-routes/:id", requireAuth, createSignalRouteGetHandler());

// Create signal route
export function createSignalRouteCreateHandler(service: SignalService = signalService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.createRoute(req.user?.agencyId, req.body ?? {});
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error creating signal route:", error);
      return res.status(500).json({ message: "Failed to create signal route" });
    }
  };
}

router.post("/signal-routes", requireAuth, createSignalRouteCreateHandler());

// Update signal route
export function createSignalRouteUpdateHandler(service: SignalService = signalService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.updateRoute(
        req.params.id,
        {
          agencyId: req.user?.agencyId,
          isSuperAdmin: req.user?.isSuperAdmin,
        },
        req.body ?? {}
      );
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error updating signal route:", error);
      return res.status(500).json({ message: "Failed to update signal route" });
    }
  };
}

router.patch("/signal-routes/:id", requireAuth, createSignalRouteUpdateHandler());

// Delete signal route
export function createSignalRouteDeleteHandler(service: SignalService = signalService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.deleteRoute(req.params.id, {
        agencyId: req.user?.agencyId,
        isSuperAdmin: req.user?.isSuperAdmin,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).send();
    } catch (error: any) {
      console.error("Error deleting signal route:", error);
      return res.status(500).json({ message: "Failed to delete signal route" });
    }
  };
}

router.delete("/signal-routes/:id", requireAuth, createSignalRouteDeleteHandler());

export default router;
