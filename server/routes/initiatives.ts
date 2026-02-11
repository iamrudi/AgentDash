import { Router } from "express";
import { 
  requireAuth, 
  requireRole, 
  requireInitiativeAccess,
  type AuthRequest 
} from "../middleware/supabase-auth";
import { getRequestContext } from "../middleware/request-context";
import { storage } from "../storage";
import { InitiativeResponseService } from "../application/initiatives/initiative-response-service";
import { InitiativeSendService } from "../application/initiatives/initiative-send-service";
import { InitiativeDraftService } from "../application/initiatives/initiative-draft-service";
import { InitiativeLifecycleService } from "../application/initiatives/initiative-lifecycle-service";

const router = Router();
const initiativeResponseService = new InitiativeResponseService(storage);
const initiativeSendService = new InitiativeSendService(storage);
const initiativeDraftService = new InitiativeDraftService(storage);
const initiativeLifecycleService = new InitiativeLifecycleService(storage);

export function createInitiativeRespondHandler(service: InitiativeResponseService = initiativeResponseService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const ctx = getRequestContext(req);
      const result = await service.respondToInitiative(ctx, req.params.id, req.body);
      if (!result.ok) {
        const payload: any = { message: result.error };
        if (result.errors) {
          payload.errors = result.errors;
        }
        return res.status(result.status).json(payload);
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

export function createInitiativeSendHandler(service: InitiativeSendService = initiativeSendService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const ctx = getRequestContext(req);
      const result = await service.sendInitiative(ctx, req.params.id);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

export function createInitiativeCreateHandler(service: InitiativeDraftService = initiativeDraftService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.createInitiative(req.body);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

export function createInitiativeUpdateHandler(service: InitiativeDraftService = initiativeDraftService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.updateInitiative(req.params.id, req.body);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

export function createInitiativeGenerateInvoiceHandler(service: InitiativeLifecycleService = initiativeLifecycleService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const ctx = getRequestContext(req);
      const result = await service.generateInvoice(ctx, req.params.id);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Failed to generate invoice" });
    }
  };
}

export function createInitiativeSoftDeleteHandler(service: InitiativeLifecycleService = initiativeLifecycleService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const ctx = getRequestContext(req);
      const result = await service.softDeleteInitiative(ctx, req.params.id);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

export function createInitiativeRestoreHandler(service: InitiativeLifecycleService = initiativeLifecycleService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const ctx = getRequestContext(req);
      const result = await service.restoreInitiative(ctx, req.params.id);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

export function createInitiativeTrashListHandler(service: InitiativeLifecycleService = initiativeLifecycleService) {
  return async (_req: AuthRequest, res: any) => {
    try {
      const result = await service.getDeletedInitiatives();
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

export function createInitiativePermanentDeleteHandler(service: InitiativeLifecycleService = initiativeLifecycleService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const ctx = getRequestContext(req);
      const result = await service.permanentlyDeleteInitiative(ctx, req.params.id);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

// Create initiative
router.post("/", requireAuth, requireRole("Admin"), createInitiativeCreateHandler());

// Update initiative (edit before sending)
router.patch(
  "/:id",
  requireAuth,
  requireRole("Admin"),
  requireInitiativeAccess(storage),
  createInitiativeUpdateHandler()
);

// Send initiative to client
router.post(
  "/:id/send",
  requireAuth,
  requireRole("Admin"),
  requireInitiativeAccess(storage),
  createInitiativeSendHandler()
);

// Client responds to initiative (approve/reject/discuss)
router.post(
  "/:id/respond",
  requireAuth,
  requireRole("Client", "Admin"),
  requireInitiativeAccess(storage),
  createInitiativeRespondHandler()
);

// Generate invoice from approved initiative
router.post(
  "/:id/generate-invoice",
  requireAuth,
  requireRole("Admin"),
  requireInitiativeAccess(storage),
  createInitiativeGenerateInvoiceHandler()
);

// Soft delete initiative (move to trash)
router.delete("/:id", requireAuth, requireRole("Admin"), requireInitiativeAccess(storage), createInitiativeSoftDeleteHandler());

// Restore initiative from trash
router.post("/:id/restore", requireAuth, requireRole("Admin"), requireInitiativeAccess(storage), createInitiativeRestoreHandler());

// Get deleted initiatives (trash)
router.get("/trash", requireAuth, requireRole("Admin"), createInitiativeTrashListHandler());

// Permanently delete initiative
router.delete("/:id/permanent", requireAuth, requireRole("Admin"), createInitiativePermanentDeleteHandler());

export default router;
