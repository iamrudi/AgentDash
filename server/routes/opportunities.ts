import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole, requireClientAccess, type AuthRequest } from "../middleware/supabase-auth";
import { storage } from "../storage";

const router = Router();

const opportunitySchema = z.object({
  clientId: z.string().uuid(),
  opportunityStatement: z.string().min(1),
  reasoning: z.string().optional(),
  assumptions: z.array(z.string()).optional(),
  confidence: z.string().optional(),
  evidenceRefs: z.array(z.string()).optional(),
  risks: z.array(z.string()).optional(),
  suggestedSuccessCriteria: z.array(z.string()).optional(),
});

const gateDecisionSchema = z.object({
  gateType: z.enum(["opportunity", "initiative", "acceptance", "outcome", "learning"]),
  decision: z.enum(["approve", "reject", "defer"]),
  rationale: z.string().optional(),
  targetType: z.string().min(1),
  targetId: z.string().uuid(),
});

router.post(
  "/opportunities",
  requireAuth,
  requireRole("Admin"),
  async (req: AuthRequest, res) => {
    try {
      const data = opportunitySchema.parse(req.body);
      const record = await storage.createOpportunityArtifact({
        agencyId: req.user!.agencyId!,
        clientId: data.clientId,
        opportunityStatement: data.opportunityStatement,
        reasoning: data.reasoning,
        assumptions: data.assumptions,
        confidence: data.confidence,
        evidenceRefs: data.evidenceRefs,
        risks: data.risks,
        suggestedSuccessCriteria: data.suggestedSuccessCriteria,
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
