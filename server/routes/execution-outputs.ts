import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole, requireInitiativeAccess, type AuthRequest } from "../middleware/supabase-auth";
import { storage } from "../storage";
import { ExecutionOutputService } from "../application/execution/execution-output-service";

const router = Router();

const executionOutputSchema = z.object({
  output: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export function createExecutionOutputHandler(service: ExecutionOutputService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const data = executionOutputSchema.parse(req.body);
      const { initiativeId } = req.params;
      const result = await service.createOutput(initiativeId, data);
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
  "/execution-outputs/:initiativeId",
  requireAuth,
  requireRole("Admin"),
  requireInitiativeAccess(storage),
  createExecutionOutputHandler(new ExecutionOutputService(storage))
);

export default router;
