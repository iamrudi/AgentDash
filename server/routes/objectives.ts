import { Router } from 'express';
import { storage } from '../storage';
import {
  requireAuth,
  requireRole,
  requireClientAccess,
  type AuthRequest
} from '../middleware/supabase-auth';

const router = Router();

router.get("/clients/:clientId/objectives", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    const objectives = await storage.getObjectivesByClientId(clientId);
    res.json(objectives);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/clients/:clientId/objectives", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    const { description, targetMetric } = req.body;

    if (!description || !targetMetric) {
      return res.status(400).json({ message: "description and targetMetric are required" });
    }

    const objective = await storage.createObjective({
      clientId,
      description,
      targetMetric,
    });

    res.status(201).json(objective);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.patch("/objectives/:id", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updated = await storage.updateObjective(id, updates);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.delete("/objectives/:id", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await storage.deleteObjective(id);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
