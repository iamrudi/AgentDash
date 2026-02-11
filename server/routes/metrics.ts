import { Router } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/supabase-auth";
import { MetricService } from "../application/metrics/metric-service";

const router = Router();
const metricService = new MetricService(storage);

export function createMetricCreateHandler(service: MetricService = metricService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.createMetric(req.body ?? {});
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.post("/metrics", requireAuth, requireRole("Admin"), createMetricCreateHandler());

export default router;
