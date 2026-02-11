import { Router } from 'express';
import { storage } from '../storage';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/supabase-auth';
import logger from '../middleware/logger';
import { ClientReadService } from '../application/client/client-read-service';
import { ClientPortfolioService } from '../application/client/client-portfolio-service';
import { ClientWorkspaceService } from '../application/client/client-workspace-service';
import { ClientMessageService } from '../application/client/client-message-service';

const router = Router();
const clientReadService = new ClientReadService(storage);
const clientPortfolioService = new ClientPortfolioService(storage);
const clientWorkspaceService = new ClientWorkspaceService(storage);
const clientMessageService = new ClientMessageService(storage, logger);

export function createClientProfileHandler(service: ClientReadService = clientReadService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.profile(req.user!.id);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get('/profile', requireAuth, requireRole('Client'), createClientProfileHandler());

export function createClientProjectsHandler(service: ClientPortfolioService = clientPortfolioService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.listProjects({
        userId: req.user!.id,
        role: req.user!.role,
        agencyId: req.user!.agencyId,
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

router.get('/projects', requireAuth, requireRole('Client', 'Admin'), createClientProjectsHandler());

export function createClientRecentTasksHandler(service: ClientWorkspaceService = clientWorkspaceService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.recentTasks(req.user!.id);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get('/tasks/recent', requireAuth, requireRole('Client'), createClientRecentTasksHandler());

export function createClientProjectsWithTasksHandler(service: ClientWorkspaceService = clientWorkspaceService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.projectsWithTasks(req.user!.id);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get('/projects-with-tasks', requireAuth, requireRole('Client'), createClientProjectsWithTasksHandler());

export function createClientInvoicesHandler(service: ClientPortfolioService = clientPortfolioService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.listInvoices({
        userId: req.user!.id,
        role: req.user!.role,
        agencyId: req.user!.agencyId,
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

router.get('/invoices', requireAuth, requireRole('Client', 'Admin'), createClientInvoicesHandler());

export function createClientInitiativesHandler(service: ClientPortfolioService = clientPortfolioService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.listInitiatives({
        userId: req.user!.id,
        role: req.user!.role,
        agencyId: req.user!.agencyId,
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

router.get('/initiatives', requireAuth, requireRole('Client', 'Admin'), createClientInitiativesHandler());

export function createClientObjectivesHandler(service: ClientWorkspaceService = clientWorkspaceService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.objectives(req.user!.id);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get('/objectives', requireAuth, requireRole('Client'), createClientObjectivesHandler());

export function createClientMessagesHandler(service: ClientWorkspaceService = clientWorkspaceService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.messages(req.user!.id);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get('/messages', requireAuth, requireRole('Client'), createClientMessagesHandler());

export function createClientMessageCreateHandler(service: ClientMessageService = clientMessageService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.createMessage(req.user!.id, req.body ?? {});
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.post('/messages', requireAuth, requireRole('Client'), createClientMessageCreateHandler());

export function createClientNotificationCountsHandler(service: ClientReadService = clientReadService) {
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

router.get('/notifications/counts', requireAuth, requireRole('Client'), createClientNotificationCountsHandler());

export default router;
