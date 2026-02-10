import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole, requireInitiativeAccess, type AuthRequest } from "../middleware/supabase-auth";
import { storage } from "../storage";
import { canCaptureLearning } from "../control/gate-service";

const router = Router();

const learningSchema = z.object({
  learning: z.string().min(1),
  invalidatedAssumptions: z.array(z.string()).optional(),
  confidence: z.string().optional(),
});

router.post(
  "/learning-artifacts/:initiativeId",
  requireAuth,
  requireRole("Admin"),
  requireInitiativeAccess(storage),
  async (req: AuthRequest, res) => {
    try {
      const data = learningSchema.parse(req.body);
      const { initiativeId } = req.params;
      const initiative = await storage.getInitiativeById(initiativeId);
      if (!initiative) {
        return res.status(404).json({ message: "Initiative not found" });
      }

      if (!initiative.opportunityArtifactId) {
        return res.status(400).json({ message: "Initiative is missing opportunity artifact link" });
      }

      const opportunityGate = await storage.getLatestGateDecisionForTarget(
        "opportunity_artifact",
        initiative.opportunityArtifactId,
        "opportunity"
      );
      const sku = await storage.getSkuCompositionByInitiativeId(initiativeId);
      const outcome = await storage.getOutcomeReviewByInitiativeId(initiativeId);

      const canWrite = canCaptureLearning({
        opportunityApproved: Boolean(opportunityGate && opportunityGate.decision === "approve"),
        skuFrozen: Boolean(sku?.frozenAt),
        outcomeReviewed: Boolean(outcome?.outcomeSummary),
      });

      if (!canWrite) {
        return res.status(400).json({ message: "Learning can only be captured after opportunity approval, SKU freeze, and outcome review" });
      }
      const record = await storage.createLearningArtifact({
        initiativeId,
        learning: data.learning,
        invalidatedAssumptions: data.invalidatedAssumptions,
        confidence: data.confidence,
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
