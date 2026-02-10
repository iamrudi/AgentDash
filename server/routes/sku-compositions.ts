import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole, requireInitiativeAccess, type AuthRequest } from "../middleware/supabase-auth";
import { storage } from "../storage";

const router = Router();

const skuSchema = z.object({
  productSku: z.string().min(1),
  executionSkus: z.array(z.string()).min(1),
});

router.post(
  "/sku-compositions/:initiativeId",
  requireAuth,
  requireRole("Admin"),
  requireInitiativeAccess(storage),
  async (req: AuthRequest, res) => {
    try {
      const data = skuSchema.parse(req.body);
      const { initiativeId } = req.params;
      const record = await storage.createSkuComposition({
        initiativeId,
        productSku: data.productSku,
        executionSkus: data.executionSkus,
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

router.post(
  "/sku-compositions/:initiativeId/freeze",
  requireAuth,
  requireRole("Admin"),
  requireInitiativeAccess(storage),
  async (req: AuthRequest, res) => {
    try {
      const { initiativeId } = req.params;
      const record = await storage.freezeSkuComposition(initiativeId);
      if (!record) {
        return res.status(404).json({ message: "SKU composition not found" });
      }
      res.json(record);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

export default router;
