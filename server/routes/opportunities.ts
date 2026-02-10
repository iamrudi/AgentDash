import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole, requireClientAccess, verifyClientAccess, type AuthRequest } from "../middleware/supabase-auth";
import { storage } from "../storage";
import { OpportunityArtifactRequestSchema } from "../domain/opportunities/schemas";
import { OpportunityService } from "../application/opportunities/opportunity-service";
import { getRequestContext } from "../middleware/request-context";
import { GateDecisionService } from "../application/gates/gate-decision-service";

const router = Router();

const opportunitySchema = OpportunityArtifactRequestSchema;

const gateDecisionSchema = z.object({
  gateType: z.enum(["opportunity", "initiative", "acceptance", "outcome", "learning"]),
  decision: z.enum(["approve", "reject", "defer"]),
  rationale: z.string().optional(),
  targetType: z.string().min(1),
  targetId: z.string().uuid(),
  metadata: z.record(z.unknown()).optional(),
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
  createGateDecisionHandler(new GateDecisionService(storage))
);

export function createGateDecisionHandler(service: GateDecisionService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const data = gateDecisionSchema.parse(req.body);
      const ctx = getRequestContext(req);
      const result = await service.recordDecision(ctx, data as any);
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

export default router;
