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

const router = Router();

// Get AI execution by ID
router.get("/ai-executions/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const execution = await hardenedAIExecutor.getExecutionById(id);
    
    if (!execution) {
      return res.status(404).json({ message: "AI execution not found" });
    }

    const agencyId = req.user?.agencyId;
    if (execution.agencyId !== agencyId && !req.user?.isSuperAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(execution);
  } catch (error: any) {
    console.error("Error fetching AI execution:", error);
    res.status(500).json({ message: "Failed to fetch AI execution" });
  }
});

// Get AI executions by workflow execution ID
router.get("/workflow-executions/:id/ai-executions", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agencyId;

    const executions = await hardenedAIExecutor.getExecutionsByWorkflow(id);
    
    const filteredExecutions = executions.filter(
      exec => exec.agencyId === agencyId || req.user?.isSuperAdmin
    );

    if (executions.length > 0 && filteredExecutions.length === 0 && !req.user?.isSuperAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(filteredExecutions);
  } catch (error: any) {
    console.error("Error fetching AI executions:", error);
    res.status(500).json({ message: "Failed to fetch AI executions" });
  }
});

// Get AI usage tracking for agency
router.get("/ai-usage", requireAuth, async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(403).json({ message: "Agency ID required" });
    }

    const { periodStart, periodEnd } = req.query;
    const usage = await hardenedAIExecutor.getUsageByAgency(
      agencyId,
      periodStart ? new Date(periodStart as string) : undefined,
      periodEnd ? new Date(periodEnd as string) : undefined
    );

    res.json(usage);
  } catch (error: any) {
    console.error("Error fetching AI usage:", error);
    res.status(500).json({ message: "Failed to fetch AI usage" });
  }
});

// Get AI cache stats (admin only)
router.get("/ai-cache/stats", requireAuth, requireRole("Admin"), async (_req: AuthRequest, res) => {
  try {
    const stats = hardenedAIExecutor.getCacheStats();
    res.json(stats);
  } catch (error: any) {
    console.error("Error fetching AI cache stats:", error);
    res.status(500).json({ message: "Failed to fetch AI cache stats" });
  }
});

// Clear AI cache (admin only)
router.delete("/ai-cache", requireAuth, requireRole("Admin"), async (_req: AuthRequest, res) => {
  try {
    hardenedAIExecutor.clearCache();
    res.json({ message: "AI cache cleared" });
  } catch (error: any) {
    console.error("Error clearing AI cache:", error);
    res.status(500).json({ message: "Failed to clear AI cache" });
  }
});

export default router;
