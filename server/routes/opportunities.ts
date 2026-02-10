import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole, requireClientAccess, verifyClientAccess, type AuthRequest } from "../middleware/supabase-auth";
import { storage } from "../storage";
import { OpportunityArtifactRequestSchema } from "../domain/opportunities/schemas";
import { OpportunityService } from "../application/opportunities/opportunity-service";
import { getRequestContext } from "../middleware/request-context";

const router = Router();

const opportunitySchema = OpportunityArtifactRequestSchema;

const gateDecisionSchema = z.object({
  gateType: z.enum(["opportunity", "initiative", "acceptance", "outcome", "learning"]),
  decision: z.enum(["approve", "reject", "defer"]),
  rationale: z.string().optional(),
  targetType: z.string().min(1),
  targetId: z.string().uuid(),
});

export function createOpportunityHandler(service: OpportunityService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const data = opportunitySchema.parse(req.body);
      const ctx = getRequestContext(req);

      const allowed = await verifyClientAccess(req, data.clientId, storage);
      if (!allowed) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (data.mode === "ai_generate") {
        const aiResult = await service.generateOpportunityArtifactFromAI(data.clientId, ctx);
        if (!aiResult.ok || !aiResult.data) {
          return res.status(400).json({ message: aiResult.error || "AI generation failed" });
        }

        const saved = await service.persistOpportunityArtifact(data.clientId, aiResult.data, ctx);
        if (!saved.ok || !saved.data) {
          return res.status(500).json({ message: saved.error || "Failed to persist opportunity artifact" });
        }

        return res.status(201).json(saved.data);
      }

      const saved = await service.persistOpportunityArtifact(data.clientId, data, ctx);
      if (!saved.ok || !saved.data) {
        return res.status(500).json({ message: saved.error || "Failed to persist opportunity artifact" });
      }

      return res.status(201).json(saved.data);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid payload", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  };
}

router.post(
  "/opportunities",
  requireAuth,
  requireRole("Admin"),
  createOpportunityHandler(new OpportunityService(storage))
);

router.get(
  "/opportunities/clients/:clientId",
  requireAuth,
  requireRole("Admin"),
  requireClientAccess(storage),
  async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const records = await storage.getOpportunityArtifactsByClientId(clientId);
      res.json(records);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

router.post(
  "/gate-decisions",
  requireAuth,
  requireRole("Admin"),
  async (req: AuthRequest, res) => {
    try {
      const data = gateDecisionSchema.parse(req.body);
      const record = await storage.createGateDecision({
        agencyId: req.user!.agencyId!,
        gateType: data.gateType,
        decision: data.decision,
        rationale: data.rationale,
        targetType: data.targetType,
        targetId: data.targetId,
        actorId: req.user!.id,
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
