import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole, requireInitiativeAccess, type AuthRequest } from "../middleware/supabase-auth";
import { storage } from "../storage";
import { LearningArtifactService } from "../application/learning/learning-artifact-service";

const router = Router();

const learningSchema = z.object({
  learning: z.string().min(1),
  invalidatedAssumptions: z.array(z.string()).optional(),
  confidence: z.string().optional(),
});

export function createLearningArtifactHandler(service: LearningArtifactService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const data = learningSchema.parse(req.body);
      const { initiativeId } = req.params;
      const result = await service.createLearning(initiativeId, data);
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
  "/learning-artifacts/:initiativeId",
  requireAuth,
  requireRole("Admin"),
  requireInitiativeAccess(storage),
  createLearningArtifactHandler(new LearningArtifactService(storage))
);

export default router;
