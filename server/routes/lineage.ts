/**
 * Lineage Router
 *
 * Lineage query routes for tracing entities back to their
 * originating workflow/signal.
 *
 * Routes: 2
 */

import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/supabase-auth";
import { storage } from "../storage";
import { LineageService } from "../application/lineage/lineage-service";

const lineageRouter = Router();
const lineageService = new LineageService(storage);

export function createTaskLineageHandler(service: LineageService = lineageService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getTaskLineage(req.params.taskId, {
        agencyId: req.user?.agencyId,
        isSuperAdmin: req.user?.isSuperAdmin,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error fetching task lineage:", error);
      return res.status(500).json({ message: "Failed to fetch task lineage" });
    }
  };
}

export function createProjectLineageHandler(service: LineageService = lineageService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getProjectLineage(req.params.projectId, {
        agencyId: req.user?.agencyId,
        isSuperAdmin: req.user?.isSuperAdmin,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error fetching project lineage:", error);
      return res.status(500).json({ message: "Failed to fetch project lineage" });
    }
  };
}

lineageRouter.get("/task/:taskId", requireAuth, createTaskLineageHandler());
lineageRouter.get("/project/:projectId", requireAuth, createProjectLineageHandler());

export default lineageRouter;

