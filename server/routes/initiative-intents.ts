import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole, requireInitiativeAccess, type AuthRequest } from "../middleware/supabase-auth";
import { storage } from "../storage";

const router = Router();

const intentSchema = z.object({
  intentStatement: z.string().min(1),
  constraints: z.array(z.string()).optional(),
  successCriteria: z.array(z.string()).optional(),
  boundaryConditions: z.array(z.string()).optional(),
  evaluationHorizon: z.string().optional(),
});

router.post(
  "/initiative-intents/:initiativeId",
  requireAuth,
  requireRole("Admin"),
  requireInitiativeAccess(storage),
  async (req: AuthRequest, res) => {
    try {
      const data = intentSchema.parse(req.body);
      const { initiativeId } = req.params;
      const record = await storage.createInitiativeIntent({
        initiativeId,
        intentStatement: data.intentStatement,
        constraints: data.constraints,
        successCriteria: data.successCriteria,
        boundaryConditions: data.boundaryConditions,
        evaluationHorizon: data.evaluationHorizon,
      } as any);
      res.status(201).json(record);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid payload", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  }
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
