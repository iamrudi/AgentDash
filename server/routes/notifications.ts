import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/supabase-auth";
import { storage } from "../storage";

const router = Router();

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const isArchived = req.query.archived === 'true';
    const notifications = await storage.getNotificationsByUserId(req.user!.id, isArchived);
    res.json(notifications);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/unread-count", requireAuth, async (req: AuthRequest, res) => {
  try {
    const count = await storage.getUnreadNotificationCount(req.user!.id);
    res.json({ count });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/:id/mark-read", requireAuth, async (req: AuthRequest, res) => {
  try {
    await storage.markNotificationAsRead(req.params.id, req.user!.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/:id/archive", requireAuth, async (req: AuthRequest, res) => {
  try {
    await storage.archiveNotification(req.params.id, req.user!.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/mark-all-read", requireAuth, async (req: AuthRequest, res) => {
  try {
    await storage.markAllNotificationsAsRead(req.user!.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
