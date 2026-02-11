/**
 * Workflow Executions Router
 *
 * Workflow execution events and lineage query routes.
 *
 * Routes: 2
 */

import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/supabase-auth";
import { storage } from "../storage";
import { WorkflowExecutionsService } from "../application/workflows/workflow-executions-service";

const workflowExecutionsRouter = Router();
const workflowExecutionsService = new WorkflowExecutionsService(storage);

export function createExecutionEventsHandler(service: WorkflowExecutionsService = workflowExecutionsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getExecutionEvents(req.params.id, {
        agencyId: req.user?.agencyId,
        isSuperAdmin: req.user?.isSuperAdmin,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error fetching execution events:", error);
      return res.status(500).json({ message: "Failed to fetch execution events" });
    }
  };
}

export function createExecutionLineageHandler(service: WorkflowExecutionsService = workflowExecutionsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getExecutionLineage(req.params.id, {
        agencyId: req.user?.agencyId,
        isSuperAdmin: req.user?.isSuperAdmin,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error fetching execution lineage:", error);
      return res.status(500).json({ message: "Failed to fetch execution lineage" });
    }
  };
}

workflowExecutionsRouter.get("/:id/events", requireAuth, createExecutionEventsHandler());
workflowExecutionsRouter.get("/:id/lineage", requireAuth, createExecutionLineageHandler());

export default workflowExecutionsRouter;

