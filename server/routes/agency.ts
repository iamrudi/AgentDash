import { Router } from 'express';
import { storage } from '../storage';
import { requireAuth, requireRole, requireClientAccess, requireProjectAccess, requireTaskAccess, type AuthRequest } from '../middleware/supabase-auth';
import { resolveAgencyContext } from '../middleware/agency-context';
import { getRequestContext } from "../middleware/request-context";
import { AgencyReadService } from '../application/agency/agency-read-service';
import { AgencyClientService } from '../application/agency/agency-client-service';
import { AgencyProjectService } from '../application/agency/agency-project-service';
import { AgencyInitiativeService } from '../application/agency/agency-initiative-service';

const router = Router();
const agencyReadService = new AgencyReadService(storage);
const agencyClientService = new AgencyClientService(storage);
const agencyProjectService = new AgencyProjectService(storage);
const agencyInitiativeService = new AgencyInitiativeService(storage);

export function createAgencyClientsListHandler(service: AgencyClientService = agencyClientService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const { agencyId } = resolveAgencyContext(req, { allowQueryParam: true });
      const result = await service.listClients(agencyId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ message: error.message });
      }
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get('/clients', requireAuth, requireRole('Admin'), createAgencyClientsListHandler());

export function createAgencyClientGetHandler(service: AgencyClientService = agencyClientService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getClient(req.params.clientId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get('/clients/:clientId', requireAuth, requireRole('Admin'), requireClientAccess(storage), createAgencyClientGetHandler());

export function createAgencyClientUpdateHandler(service: AgencyClientService = agencyClientService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.updateClient(req.params.clientId, req.body ?? {}, getRequestContext(req));
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.patch('/clients/:clientId', requireAuth, requireRole('Admin'), requireClientAccess(storage), createAgencyClientUpdateHandler());

export function createAgencyClientRetainerHoursHandler(service: AgencyClientService = agencyClientService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.retainerHours(req.params.clientId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get(
  '/clients/:clientId/retainer-hours',
  requireAuth,
  requireRole('Admin'),
  requireClientAccess(storage),
  createAgencyClientRetainerHoursHandler()
);

export function createAgencyClientResetRetainerHoursHandler(service: AgencyClientService = agencyClientService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.resetRetainerHours(req.params.clientId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.post(
  '/clients/:clientId/reset-retainer-hours',
  requireAuth,
  requireRole('Admin'),
  requireClientAccess(storage),
  createAgencyClientResetRetainerHoursHandler()
);

export function createAgencyInitiativeMarkViewedHandler(service: AgencyInitiativeService = agencyInitiativeService) {
  return async (_req: AuthRequest, res: any) => {
    try {
      const result = await service.markResponsesViewed();
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).send();
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.post('/initiatives/mark-viewed', requireAuth, requireRole('Admin'), createAgencyInitiativeMarkViewedHandler());

export function createAgencyProjectsListHandler(service: AgencyProjectService = agencyProjectService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.listProjects({
        agencyId: req.user?.agencyId,
        isSuperAdmin: req.user?.isSuperAdmin,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get('/projects', requireAuth, requireRole('Admin', 'Staff'), createAgencyProjectsListHandler());

export function createAgencyProjectCreateHandler(service: AgencyProjectService = agencyProjectService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.createProject(
        {
          agencyId: req.user?.agencyId,
          isSuperAdmin: req.user?.isSuperAdmin,
        },
        req.body ?? {}
      );
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.post('/projects', requireAuth, requireRole('Admin'), createAgencyProjectCreateHandler());

export function createAgencyProjectGetHandler(service: AgencyProjectService = agencyProjectService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getProject(req.params.id);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get('/projects/:id', requireAuth, requireRole('Admin', 'Staff'), requireProjectAccess(storage), createAgencyProjectGetHandler());

export function createAgencyProjectUpdateHandler(service: AgencyProjectService = agencyProjectService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.updateProject(req.params.id, req.body ?? {});
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.patch('/projects/:id', requireAuth, requireRole('Admin'), requireProjectAccess(storage), createAgencyProjectUpdateHandler());

export function createAgencyProjectListsHandler(service: AgencyProjectService = agencyProjectService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.listTaskLists(req.params.projectId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get('/projects/:projectId/lists', requireAuth, requireRole('Admin', 'Staff', 'SuperAdmin'), requireProjectAccess(storage), createAgencyProjectListsHandler());

export function createAgencyMetricsHandler(service: AgencyReadService = agencyReadService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.metrics(req.user?.agencyId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get('/metrics', requireAuth, requireRole('Admin'), createAgencyMetricsHandler());

export function createAgencyClientMetricsHandler(service: AgencyClientService = agencyClientService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.clientMetrics(req.params.clientId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get('/clients/:clientId/metrics', requireAuth, requireRole('Admin'), requireClientAccess(storage), createAgencyClientMetricsHandler());

export function createAgencyInitiativesHandler(service: AgencyReadService = agencyReadService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.initiatives(req.user?.agencyId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get('/initiatives', requireAuth, requireRole('Admin'), createAgencyInitiativesHandler());

export function createAgencyIntegrationsHandler(service: AgencyReadService = agencyReadService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.integrations(req.user?.agencyId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get('/integrations', requireAuth, requireRole('Admin'), createAgencyIntegrationsHandler());

export function createAgencyStaffHandler(service: AgencyReadService = agencyReadService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.staff({
        isSuperAdmin: req.user?.isSuperAdmin,
        agencyId: req.user?.agencyId,
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

router.get('/staff', requireAuth, requireRole('Admin'), createAgencyStaffHandler());

export function createAgencyMessagesHandler(service: AgencyReadService = agencyReadService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.messages(req.user?.agencyId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get('/messages', requireAuth, requireRole('Admin', 'Staff'), createAgencyMessagesHandler());

export function createAgencyNotificationCountsHandler(service: AgencyReadService = agencyReadService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.notificationCounts(req.user?.agencyId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get('/notifications/counts', requireAuth, requireRole('Admin'), createAgencyNotificationCountsHandler());

export default router;
