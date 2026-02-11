import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/supabase-auth";
import { storage } from "../storage";
import { NotificationService } from "../application/notifications/notification-service";

const router = Router();
const notificationService = new NotificationService(storage);

export function createNotificationsListHandler(service: NotificationService = notificationService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.listByUser(req.user!.id, req.query.archived);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get("/", requireAuth, createNotificationsListHandler());

export function createNotificationsUnreadCountHandler(service: NotificationService = notificationService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.unreadCount(req.user!.id);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get("/unread-count", requireAuth, createNotificationsUnreadCountHandler());

export function createNotificationsMarkReadHandler(service: NotificationService = notificationService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.markRead(req.user!.id, req.params.id);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).send();
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.post("/:id/mark-read", requireAuth, createNotificationsMarkReadHandler());

export function createNotificationsArchiveHandler(service: NotificationService = notificationService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.archive(req.user!.id, req.params.id);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).send();
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.post("/:id/archive", requireAuth, createNotificationsArchiveHandler());

export function createNotificationsMarkAllReadHandler(service: NotificationService = notificationService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.markAllRead(req.user!.id);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).send();
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.post("/mark-all-read", requireAuth, createNotificationsMarkAllReadHandler());

export default router;
