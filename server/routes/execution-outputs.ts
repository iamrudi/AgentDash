import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole, requireInitiativeAccess, type AuthRequest } from "../middleware/supabase-auth";
import { storage } from "../storage";

const router = Router();

const executionOutputSchema = z.object({
  output: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

router.post(
  "/execution-outputs/:initiativeId",
  requireAuth,
  requireRole("Admin"),
  requireInitiativeAccess(storage),
  async (req: AuthRequest, res) => {
    try {
      const data = executionOutputSchema.parse(req.body);
      const { initiativeId } = req.params;
      const sku = await storage.getSkuCompositionByInitiativeId(initiativeId);
      if (!sku?.frozenAt) {
        return res.status(400).json({ message: "SKU composition must be frozen before execution" });
      }
      const record = await storage.createExecutionOutput({
        initiativeId,
        output: data.output,
        metadata: data.metadata,
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

export default router;
