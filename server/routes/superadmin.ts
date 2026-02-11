/**
 * SuperAdmin Router
 * 
 * Platform-level administration routes for SuperAdmin users.
 * These routes bypass tenant isolation by design and operate
 * across all agencies with full audit logging.
 * 
 * Security: All routes require requireAuth + requireSuperAdmin middleware.
 * Audit: All mutating operations are logged to audit_logs table.
 * 
 * Routes: 16
 */

import { Router } from 'express';
import { requireAuth, requireSuperAdmin, type AuthRequest } from '../middleware/supabase-auth';
import { storage } from '../storage';
import { emitClientRecordUpdatedSignal } from "../clients/client-record-signal";
import { getRequestContext } from "../middleware/request-context";
import { SuperadminReadService } from '../application/superadmin/superadmin-read-service';
import { SuperadminUserService } from '../application/superadmin/superadmin-user-service';
import { SuperadminAgencyService } from '../application/superadmin/superadmin-agency-service';
import { SuperadminRecommendationService } from '../application/superadmin/superadmin-recommendation-service';

const superadminRouter = Router();
const superadminReadService = new SuperadminReadService(storage);
const superadminUserService = new SuperadminUserService(storage);
const superadminAgencyService = new SuperadminAgencyService(storage);
const superadminRecommendationService = new SuperadminRecommendationService(storage, emitClientRecordUpdatedSignal);

const logAuditEvent = async (
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string | null,
  details: any,
  ipAddress: string | undefined,
  userAgent: string | undefined
) => {
  try {
    await storage.createAuditLog({
      userId,
      action,
      resourceType,
      resourceId,
      details,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error('[AUDIT LOG ERROR]', error);
  }
};

function sendSuperadminReadResult(
  res: any,
  result: { ok: boolean; status: number; data?: unknown; error?: string }
) {
  if (!result.ok) {
    return res.status(result.status).json({ message: result.error });
  }
  return res.status(result.status).json(result.data);
}

export function createSuperadminUsersListHandler(service: SuperadminReadService = superadminReadService) {
  return async (_req: AuthRequest, res: any) => {
    try {
      return sendSuperadminReadResult(res, await service.listUsers());
    } catch (error: any) {
      console.error('[SUPER ADMIN] Error fetching users:', error);
      return res.status(500).json({ message: "Failed to fetch users" });
    }
  };
}

superadminRouter.get("/users", requireAuth, requireSuperAdmin, createSuperadminUsersListHandler());

function sendSuperadminUserResult(
  res: any,
  result: { ok: boolean; status: number; data?: unknown; error?: string; errors?: unknown }
) {
  if (!result.ok) {
    if (result.errors !== undefined) {
      return res.status(result.status).json({ message: result.error, errors: result.errors });
    }
    return res.status(result.status).json({ message: result.error });
  }
  return res.status(result.status).json(result.data);
}

async function emitSuperadminAudit(
  req: AuthRequest,
  result: { auditEvent?: { action: string; resourceType: string; resourceId: string | null; details: Record<string, unknown> } }
) {
  if (!result.auditEvent) {
    return;
  }
  await logAuditEvent(
    req.user!.id,
    result.auditEvent.action,
    result.auditEvent.resourceType,
    result.auditEvent.resourceId,
    result.auditEvent.details,
    req.ip,
    req.get('user-agent')
  );
}

export function createSuperadminUserEmailHandler(service: SuperadminUserService = superadminUserService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.updateEmail(req.params.userId, req.body);
      await emitSuperadminAudit(req, result);
      return sendSuperadminUserResult(res, result);
    } catch (error: any) {
      console.error('[SUPER ADMIN] Error updating user email:', error);
      return res.status(500).json({ message: error.message || "Failed to update user email" });
    }
  };
}

export function createSuperadminUserPasswordHandler(service: SuperadminUserService = superadminUserService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.updatePassword(req.params.userId, req.body);
      await emitSuperadminAudit(req, result);
      return sendSuperadminUserResult(res, result);
    } catch (error: any) {
      console.error('[SUPER ADMIN] Error updating user password:', error);
      return res.status(500).json({ message: error.message || "Failed to update user password" });
    }
  };
}

export function createSuperadminUserPromoteHandler(service: SuperadminUserService = superadminUserService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.promoteToSuperadmin(req.params.userId);
      await emitSuperadminAudit(req, result);
      return sendSuperadminUserResult(res, result);
    } catch (error: any) {
      console.error('[SUPER ADMIN] Error promoting user to SuperAdmin:', error);
      return res.status(500).json({ message: error.message || "Failed to promote user" });
    }
  };
}

export function createSuperadminUserRoleHandler(service: SuperadminUserService = superadminUserService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.updateRole(req.params.userId, req.body ?? {});
      await emitSuperadminAudit(req, result);
      return sendSuperadminUserResult(res, result);
    } catch (error: any) {
      console.error('[SUPER ADMIN] Error updating user role:', error);
      return res.status(500).json({ message: error.message || "Failed to update user role" });
    }
  };
}

export function createSuperadminUserDeleteHandler(service: SuperadminUserService = superadminUserService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.deleteUser(req.params.userId);
      await emitSuperadminAudit(req, result);
      return sendSuperadminUserResult(res, result);
    } catch (error: any) {
      console.error('[SUPER ADMIN] Error deleting user:', error);
      return res.status(500).json({ message: "Failed to delete user" });
    }
  };
}

superadminRouter.patch("/users/:userId/email", requireAuth, requireSuperAdmin, createSuperadminUserEmailHandler());
superadminRouter.patch("/users/:userId/password", requireAuth, requireSuperAdmin, createSuperadminUserPasswordHandler());
superadminRouter.patch("/users/:userId/promote-superadmin", requireAuth, requireSuperAdmin, createSuperadminUserPromoteHandler());
superadminRouter.patch("/users/:userId/role", requireAuth, requireSuperAdmin, createSuperadminUserRoleHandler());
superadminRouter.delete("/users/:userId", requireAuth, requireSuperAdmin, createSuperadminUserDeleteHandler());

export function createSuperadminAgenciesListHandler(service: SuperadminReadService = superadminReadService) {
  return async (_req: AuthRequest, res: any) => {
    try {
      return sendSuperadminReadResult(res, await service.listAgencies());
    } catch (error: any) {
      console.error('[SUPER ADMIN] Error fetching agencies:', error);
      return res.status(500).json({ message: "Failed to fetch agencies" });
    }
  };
}

superadminRouter.get("/agencies", requireAuth, requireSuperAdmin, createSuperadminAgenciesListHandler());

export function createSuperadminAgencyDeleteHandler(service: SuperadminAgencyService = superadminAgencyService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.deleteAgency(req.params.agencyId);
      await emitSuperadminAudit(req, result);
      return sendSuperadminUserResult(res, result);
    } catch (error: any) {
      console.error('[SUPER ADMIN] Error deleting agency:', error);
      return res.status(500).json({ message: "Failed to delete agency" });
    }
  };
}

superadminRouter.delete("/agencies/:agencyId", requireAuth, requireSuperAdmin, createSuperadminAgencyDeleteHandler());

export function createSuperadminClientsListHandler(service: SuperadminReadService = superadminReadService) {
  return async (_req: AuthRequest, res: any) => {
    try {
      return sendSuperadminReadResult(res, await service.listClients());
    } catch (error: any) {
      console.error('[SUPER ADMIN] Error fetching clients:', error);
      return res.status(500).json({ message: "Failed to fetch clients" });
    }
  };
}

superadminRouter.get("/clients", requireAuth, requireSuperAdmin, createSuperadminClientsListHandler());

export function createSuperadminClientDeleteHandler(service: SuperadminAgencyService = superadminAgencyService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.deleteClient(req.params.clientId);
      await emitSuperadminAudit(req, result);
      return sendSuperadminUserResult(res, result);
    } catch (error: any) {
      console.error('[SUPER ADMIN] Error deleting client:', error);
      return res.status(500).json({ message: "Failed to delete client" });
    }
  };
}

superadminRouter.delete("/clients/:clientId", requireAuth, requireSuperAdmin, createSuperadminClientDeleteHandler());

export function createSuperadminAgencySettingsGetHandler(service: SuperadminAgencyService = superadminAgencyService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getAgencySettings(req.params.agencyId);
      return sendSuperadminUserResult(res, result);
    } catch (error: any) {
      console.error('[SUPER ADMIN] Error fetching agency settings:', error);
      return res.status(500).json({ message: "Failed to fetch agency settings" });
    }
  };
}

superadminRouter.get(
  "/agencies/:agencyId/settings",
  requireAuth,
  requireSuperAdmin,
  createSuperadminAgencySettingsGetHandler()
);

export function createSuperadminAgencySettingsUpdateHandler(service: SuperadminAgencyService = superadminAgencyService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.updateAgencySettings(req.params.agencyId, req.body);
      await emitSuperadminAudit(req, result);
      return sendSuperadminUserResult(res, result);
    } catch (error: any) {
      console.error('[SUPER ADMIN] Error updating agency settings:', error);
      return res.status(500).json({ message: "Failed to update agency settings" });
    }
  };
}

superadminRouter.put(
  "/agencies/:agencyId/settings",
  requireAuth,
  requireSuperAdmin,
  createSuperadminAgencySettingsUpdateHandler()
);

export function createSuperadminRecommendationsListHandler(service: SuperadminReadService = superadminReadService) {
  return async (_req: AuthRequest, res: any) => {
    try {
      return sendSuperadminReadResult(res, await service.listRecommendations());
    } catch (error: any) {
      console.error('[SUPER ADMIN] Error fetching recommendations:', error);
      return res.status(500).json({ message: "Failed to fetch recommendations" });
    }
  };
}

superadminRouter.get("/recommendations", requireAuth, requireSuperAdmin, createSuperadminRecommendationsListHandler());

export function createSuperadminRecommendationRequestHandler(
  service: SuperadminRecommendationService = superadminRecommendationService
) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.requestRecommendations(getRequestContext(req), req.params.clientId, req.body);
      await emitSuperadminAudit(req, result);
      return sendSuperadminUserResult(res, result);
    } catch (error: any) {
      console.error('[SUPER ADMIN] Error generating recommendations:', error);
      return res.status(500).json({ message: error.message });
    }
  };
}

superadminRouter.post(
  "/clients/:clientId/generate-recommendations",
  requireAuth,
  requireSuperAdmin,
  createSuperadminRecommendationRequestHandler()
);

export function createSuperadminAuditLogsHandler(service: SuperadminReadService = superadminReadService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return sendSuperadminReadResult(res, await service.listAuditLogs(req.query.limit, req.query.offset));
    } catch (error: any) {
      console.error('[SUPER ADMIN] Error fetching audit logs:', error);
      return res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  };
}

superadminRouter.get("/audit-logs", requireAuth, requireSuperAdmin, createSuperadminAuditLogsHandler());

export default superadminRouter;
