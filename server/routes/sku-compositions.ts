import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole, requireInitiativeAccess, type AuthRequest } from "../middleware/supabase-auth";
import { storage } from "../storage";
import { SkuCompositionRequestSchema } from "../domain/sku/schemas";
import { SkuCompositionService } from "../application/sku/sku-composition-service";
import { getRequestContext } from "../middleware/request-context";

const router = Router();

const skuSchema = SkuCompositionRequestSchema;

export function createSkuCompositionHandler(service: SkuCompositionService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const data = skuSchema.parse(req.body);
      const { initiativeId } = req.params;
      const ctx = getRequestContext(req);
      const result = await service.createComposition(ctx, initiativeId, data);
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
  "/sku-compositions/:initiativeId",
  requireAuth,
  requireRole("Admin"),
  requireInitiativeAccess(storage),
  createSkuCompositionHandler(new SkuCompositionService(storage))
);

export function createSkuFreezeHandler(service: SkuCompositionService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const { initiativeId } = req.params;
      const ctx = getRequestContext(req);
      const result = await service.freezeComposition(ctx, initiativeId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.post(
  "/sku-compositions/:initiativeId/freeze",
  requireAuth,
  requireRole("Admin"),
  requireInitiativeAccess(storage),
  createSkuFreezeHandler(new SkuCompositionService(storage))
);

export default router;
