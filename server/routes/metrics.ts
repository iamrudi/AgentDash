import { Router } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/supabase-auth";

const router = Router();

router.post("/metrics", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const metric = await storage.createMetric(req.body);
    res.status(201).json(metric);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
