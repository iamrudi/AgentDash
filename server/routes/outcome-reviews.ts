import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole, requireInitiativeAccess, type AuthRequest } from "../middleware/supabase-auth";
import { storage } from "../storage";

const router = Router();

const outcomeSchema = z.object({
  outcomeSummary: z.string().optional(),
  kpiDelta: z.record(z.unknown()).optional(),
  qualitativeFeedback: z.record(z.unknown()).optional(),
});

router.post(
  "/outcome-reviews/:initiativeId",
  requireAuth,
  requireRole("Admin"),
  requireInitiativeAccess(storage),
  async (req: AuthRequest, res) => {
    try {
      const data = outcomeSchema.parse(req.body);
      const { initiativeId } = req.params;
      const acceptance = await storage.getLatestGateDecisionForTarget("initiative", initiativeId, "acceptance");
      if (!acceptance || acceptance.decision !== "approve") {
        return res.status(400).json({ message: "Acceptance must be approved before outcome review" });
      }
      const record = await storage.createOutcomeReview({
        initiativeId,
        outcomeSummary: data.outcomeSummary,
        kpiDelta: data.kpiDelta,
        qualitativeFeedback: data.qualitativeFeedback,
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
