import { Router } from 'express';
import { storage } from '../storage';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/supabase-auth';
import { StaffReadService } from '../application/staff/staff-read-service';

const router = Router();
const staffReadService = new StaffReadService(storage);

export function createStaffTasksHandler(service: StaffReadService = staffReadService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.listTasks(req.user?.agencyId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get('/tasks', requireAuth, requireRole('Staff', 'Admin'), createStaffTasksHandler());

export function createStaffFullTasksHandler(service: StaffReadService = staffReadService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.listFullTasks({
        agencyId: req.user?.agencyId,
        userId: req.user!.id,
        role: req.user!.role,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get('/tasks/full', requireAuth, requireRole('Staff', 'Admin'), createStaffFullTasksHandler());

export function createStaffNotificationCountsHandler(service: StaffReadService = staffReadService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.notificationCounts(req.user!.id);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get('/notifications/counts', requireAuth, requireRole('Staff'), createStaffNotificationCountsHandler());

export default router;
