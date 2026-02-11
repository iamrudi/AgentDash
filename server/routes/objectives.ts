import { Router } from 'express';
import { storage } from '../storage';
import {
  requireAuth,
  requireRole,
  requireClientAccess,
  type AuthRequest
} from '../middleware/supabase-auth';
import { ObjectiveService } from '../application/objectives/objective-service';

const router = Router();
const objectiveService = new ObjectiveService(storage);

export function createObjectivesListHandler(service: ObjectiveService = objectiveService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.listByClientId(req.params.clientId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get(
  "/clients/:clientId/objectives",
  requireAuth,
  requireRole("Admin"),
  requireClientAccess(storage),
  createObjectivesListHandler()
);

export function createObjectiveCreateHandler(service: ObjectiveService = objectiveService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.create(req.params.clientId, req.body);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.post(
  "/clients/:clientId/objectives",
  requireAuth,
  requireRole("Admin"),
  requireClientAccess(storage),
  createObjectiveCreateHandler()
);

export function createObjectiveUpdateHandler(service: ObjectiveService = objectiveService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.update(req.params.id, req.body);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.patch("/objectives/:id", requireAuth, requireRole("Admin"), createObjectiveUpdateHandler());

export function createObjectiveDeleteHandler(service: ObjectiveService = objectiveService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.delete(req.params.id);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).send();
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.delete("/objectives/:id", requireAuth, requireRole("Admin"), createObjectiveDeleteHandler());

export default router;
