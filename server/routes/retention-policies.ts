/**
 * Retention Policies Router
 *
 * Workflow data retention policy management and cleanup API.
 *
 * Routes: 4
 */

import { Router } from 'express';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/supabase-auth';
import { resolveAgencyContext } from '../middleware/agency-context';
import { RetentionPolicyService } from '../application/retention/retention-policy-service';

const router = Router();
const retentionPolicyService = new RetentionPolicyService();

export function createRetentionPoliciesListHandler(service: RetentionPolicyService = retentionPolicyService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const { agencyId } = resolveAgencyContext(req, { allowQueryParam: true });
      const result = await service.listPolicies(agencyId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error('Error fetching retention policies:', error);
      return res.status(500).json({ message: 'Failed to fetch retention policies' });
    }
  };
}

router.get('/', requireAuth, createRetentionPoliciesListHandler());

export function createRetentionPolicyUpsertHandler(service: RetentionPolicyService = retentionPolicyService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const { agencyId } = resolveAgencyContext(req, { allowQueryParam: true });
      const result = await service.upsertPolicy(agencyId, req.body ?? {});
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error('Error creating/updating retention policy:', error);
      return res.status(500).json({ message: 'Failed to save retention policy' });
    }
  };
}

router.post('/', requireAuth, requireRole('Admin'), createRetentionPolicyUpsertHandler());

export function createRetentionPolicyDeleteHandler(service: RetentionPolicyService = retentionPolicyService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const { agencyId } = resolveAgencyContext(req, { allowQueryParam: true });
      const result = await service.deletePolicy(req.params.id, {
        agencyId,
        isSuperAdmin: req.user?.isSuperAdmin,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error('Error deleting retention policy:', error);
      return res.status(500).json({ message: 'Failed to delete retention policy' });
    }
  };
}

router.delete('/:id', requireAuth, requireRole('Admin'), createRetentionPolicyDeleteHandler());

export function createRetentionCleanupPlanHandler(service: RetentionPolicyService = retentionPolicyService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const { agencyId } = resolveAgencyContext(req, { allowQueryParam: true });
      const includeCounts = String(req.query.includeCounts ?? 'false') === 'true';
      const result = await service.cleanupPlan(agencyId, includeCounts);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error('Error building retention plan:', error);
      return res.status(500).json({ message: 'Failed to build retention plan' });
    }
  };
}

router.get('/cleanup/plan', requireAuth, requireRole('Admin'), createRetentionCleanupPlanHandler());

export function createRetentionCleanupRunHandler(service: RetentionPolicyService = retentionPolicyService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const { agencyId } = resolveAgencyContext(req, { allowQueryParam: true });
      const dryRun = req.body?.dryRun !== false;
      const result = await service.runCleanup(agencyId, dryRun);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error('Error running retention cleanup:', error);
      return res.status(500).json({ message: 'Failed to run retention cleanup' });
    }
  };
}

router.post('/cleanup', requireAuth, requireRole('Admin'), createRetentionCleanupRunHandler());

export default router;
