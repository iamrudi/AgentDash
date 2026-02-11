/**
 * AI Execution Router
 *
 * AI execution tracking, usage, and cache management API.
 *
 * Routes: 5
 */

import { Router } from 'express';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/supabase-auth';
import { hardenedAIExecutor } from '../ai/hardened-executor';
import { AiExecutionService } from '../application/ai/ai-execution-service';

const router = Router();
const aiExecutionService = new AiExecutionService(hardenedAIExecutor);

export function createAiExecutionGetHandler(service: AiExecutionService = aiExecutionService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getExecutionById(req.params.id, {
        agencyId: req.user?.agencyId,
        isSuperAdmin: req.user?.isSuperAdmin,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error('Error fetching AI execution:', error);
      return res.status(500).json({ message: 'Failed to fetch AI execution' });
    }
  };
}

router.get('/ai-executions/:id', requireAuth, createAiExecutionGetHandler());

export function createAiExecutionsByWorkflowHandler(service: AiExecutionService = aiExecutionService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getExecutionsByWorkflow(req.params.id, {
        agencyId: req.user?.agencyId,
        isSuperAdmin: req.user?.isSuperAdmin,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error('Error fetching AI executions:', error);
      return res.status(500).json({ message: 'Failed to fetch AI executions' });
    }
  };
}

router.get('/workflow-executions/:id/ai-executions', requireAuth, createAiExecutionsByWorkflowHandler());

export function createAiUsageHandler(service: AiExecutionService = aiExecutionService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getUsageByAgency(req.user?.agencyId, {
        periodStart: req.query.periodStart as string | undefined,
        periodEnd: req.query.periodEnd as string | undefined,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error('Error fetching AI usage:', error);
      return res.status(500).json({ message: 'Failed to fetch AI usage' });
    }
  };
}

router.get('/ai-usage', requireAuth, createAiUsageHandler());

export function createAiCacheStatsHandler(service: AiExecutionService = aiExecutionService) {
  return async (_req: AuthRequest, res: any) => {
    try {
      const result = service.getCacheStats();
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error('Error fetching AI cache stats:', error);
      return res.status(500).json({ message: 'Failed to fetch AI cache stats' });
    }
  };
}

router.get('/ai-cache/stats', requireAuth, requireRole('Admin'), createAiCacheStatsHandler());

export function createAiCacheClearHandler(service: AiExecutionService = aiExecutionService) {
  return async (_req: AuthRequest, res: any) => {
    try {
      const result = service.clearCache();
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error('Error clearing AI cache:', error);
      return res.status(500).json({ message: 'Failed to clear AI cache' });
    }
  };
}

router.delete('/ai-cache', requireAuth, requireRole('Admin'), createAiCacheClearHandler());

export default router;
