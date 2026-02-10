import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole, requireInitiativeAccess, type AuthRequest } from "../middleware/supabase-auth";
import { storage } from "../storage";
import { OutcomeReviewService } from "../application/outcomes/outcome-review-service";

const router = Router();

const outcomeSchema = z.object({
  outcomeSummary: z.string().optional(),
  kpiDelta: z.record(z.unknown()).optional(),
  qualitativeFeedback: z.record(z.unknown()).optional(),
});

export function createOutcomeReviewHandler(service: OutcomeReviewService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const data = outcomeSchema.parse(req.body);
      const { initiativeId } = req.params;
      const result = await service.createOutcome(initiativeId, data);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(201).json(result.data);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid payload", errors: error.errors });
      }
      return res.status(500).json({ message: error.message });
    }
  };
}

router.post(
  "/outcome-reviews/:initiativeId",
  requireAuth,
  requireRole("Admin"),
  requireInitiativeAccess(storage),
  createOutcomeReviewHandler(new OutcomeReviewService(storage))
);

export default router;
