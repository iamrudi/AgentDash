import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole, requireInitiativeAccess, type AuthRequest } from "../middleware/supabase-auth";
import { storage } from "../storage";
import { InitiativeIntentRequestSchema } from "../domain/initiatives/schemas";
import { InitiativeIntentService } from "../application/initiatives/initiative-intent-service";
import { getRequestContext } from "../middleware/request-context";

const router = Router();

const intentSchema = InitiativeIntentRequestSchema;

export function createInitiativeIntentHandler(service: InitiativeIntentService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const data = intentSchema.parse(req.body);
      const { initiativeId } = req.params;
      const ctx = getRequestContext(req);
      const result = await service.createIntent(ctx, initiativeId, data);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid payload", errors: error.errors });
      }
      return res.status(500).json({ message: error.message });
    }
  };
}

router.post(
  "/initiative-intents/:initiativeId",
  requireAuth,
  requireRole("Admin"),
  requireInitiativeAccess(storage),
  createInitiativeIntentHandler(new InitiativeIntentService(storage))
);

router.get(
  "/initiative-intents/:initiativeId",
  requireAuth,
  requireRole("Admin"),
  requireInitiativeAccess(storage),
  async (req: AuthRequest, res) => {
    try {
      const { initiativeId } = req.params;
      const record = await storage.getInitiativeIntentByInitiativeId(initiativeId);
      if (!record) {
        return res.status(404).json({ message: "Intent not found" });
      }
      res.json(record);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

export default router;
