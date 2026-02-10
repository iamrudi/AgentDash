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
import { db } from '../db';
import { buildRetentionPlan } from '../jobs/retention-job';
import { 
  workflowRetentionPolicies, 
  workflowExecutions, 
  workflowEvents, 
  workflowSignals, 
  aiExecutions as aiExecutionsTable, 
  workflowRules, 
  workflowRuleEvaluations 
} from '@shared/schema';
import { eq, and, lt, sql } from 'drizzle-orm';

const router = Router();

// Get retention policies for agency
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { agencyId } = resolveAgencyContext(req, { allowQueryParam: true });
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const policies = await db.select()
      .from(workflowRetentionPolicies)
      .where(eq(workflowRetentionPolicies.agencyId, agencyId));
    
    res.json(policies);
  } catch (error: any) {
    console.error("Error fetching retention policies:", error);
    res.status(500).json({ message: "Failed to fetch retention policies" });
  }
});

// Create or update retention policy
router.post("/", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const { agencyId } = resolveAgencyContext(req, { allowQueryParam: true });
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const { resourceType, retentionDays, archiveBeforeDelete, enabled } = req.body;
    
    if (!resourceType || !retentionDays) {
      return res.status(400).json({ message: "resourceType and retentionDays are required" });
    }
    
    // Upsert policy
    const existing = await db.select()
      .from(workflowRetentionPolicies)
      .where(and(
        eq(workflowRetentionPolicies.agencyId, agencyId),
        eq(workflowRetentionPolicies.resourceType, resourceType)
      ))
      .limit(1);
    
    let policy;
    if (existing.length > 0) {
      [policy] = await db.update(workflowRetentionPolicies)
        .set({
          retentionDays,
          archiveBeforeDelete: archiveBeforeDelete ?? false,
          enabled: enabled ?? true,
          updatedAt: new Date(),
        })
        .where(eq(workflowRetentionPolicies.id, existing[0].id))
        .returning();
    } else {
      [policy] = await db.insert(workflowRetentionPolicies)
        .values({
          agencyId,
          resourceType,
          retentionDays,
          archiveBeforeDelete: archiveBeforeDelete ?? false,
          enabled: enabled ?? true,
        })
        .returning();
    }
    
    res.json(policy);
  } catch (error: any) {
    console.error("Error creating/updating retention policy:", error);
    res.status(500).json({ message: "Failed to save retention policy" });
  }
});

// Delete retention policy
router.delete("/:id", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { agencyId } = resolveAgencyContext(req, { allowQueryParam: true });
    
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const [policy] = await db.select()
      .from(workflowRetentionPolicies)
      .where(eq(workflowRetentionPolicies.id, id))
      .limit(1);
    
    if (!policy) {
      return res.status(404).json({ message: "Retention policy not found" });
    }
    
    if (policy.agencyId !== agencyId && !req.user?.isSuperAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    await db.delete(workflowRetentionPolicies)
      .where(eq(workflowRetentionPolicies.id, id));
    
    res.json({ message: "Retention policy deleted" });
  } catch (error: any) {
    console.error("Error deleting retention policy:", error);
    res.status(500).json({ message: "Failed to delete retention policy" });
  }
});

// Preview retention cleanup plan (admin only, non-destructive)
router.get("/cleanup/plan", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const { agencyId } = resolveAgencyContext(req, { allowQueryParam: true });
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const policies = await db.select()
      .from(workflowRetentionPolicies)
      .where(eq(workflowRetentionPolicies.agencyId, agencyId));

    const plan = buildRetentionPlan(
      policies.map((policy) => ({
        resourceType: policy.resourceType,
        retentionDays: policy.retentionDays,
        enabled: policy.enabled ?? true,
        archiveBeforeDelete: policy.archiveBeforeDelete ?? false,
      }))
    );

    res.json({ plan });
  } catch (error: any) {
    console.error("Error building retention plan:", error);
    res.status(500).json({ message: "Failed to build retention plan" });
  }
});

// Run retention cleanup (admin only, typically called by cron)
router.post("/cleanup", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const { agencyId } = resolveAgencyContext(req, { allowQueryParam: true });
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const policies = await db.select()
      .from(workflowRetentionPolicies)
      .where(and(
        eq(workflowRetentionPolicies.agencyId, agencyId),
        eq(workflowRetentionPolicies.enabled, true)
      ));
    
    const results: any[] = [];
    
    for (const policy of policies) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);
      
      let deletedCount = 0;
      
      switch (policy.resourceType) {
        case 'workflow_executions':
          const execResult = await db.delete(workflowExecutions)
            .where(and(
              eq(workflowExecutions.agencyId, agencyId),
              lt(workflowExecutions.createdAt, cutoffDate)
            ));
          deletedCount = (execResult as any).rowCount || 0;
          break;
          
        case 'workflow_events':
          const eventsResult = await db.delete(workflowEvents)
            .where(and(
              eq(workflowEvents.agencyId, agencyId),
              lt(workflowEvents.timestamp, cutoffDate)
            ));
          deletedCount = (eventsResult as any).rowCount || 0;
          break;
          
        case 'signals':
          const signalsResult = await db.delete(workflowSignals)
            .where(and(
              eq(workflowSignals.agencyId, agencyId),
              lt(workflowSignals.ingestedAt, cutoffDate)
            ));
          deletedCount = (signalsResult as any).rowCount || 0;
          break;
          
        case 'ai_executions':
          const aiResult = await db.delete(aiExecutionsTable)
            .where(and(
              eq(aiExecutionsTable.agencyId, agencyId),
              lt(aiExecutionsTable.createdAt, cutoffDate)
            ));
          deletedCount = (aiResult as any).rowCount || 0;
          break;
          
        case 'rule_evaluations':
          // Rule evaluations don't have agencyId directly, so we need to join through workflowRules
          // First get rule IDs for this agency, then delete evaluations for those rules
          const agencyRules = await db.select({ id: workflowRules.id })
            .from(workflowRules)
            .where(eq(workflowRules.agencyId, agencyId));
          const agencyRuleIds = agencyRules.map(r => r.id);
          
          if (agencyRuleIds.length > 0) {
            let evalDeletedCount = 0;
            for (const ruleId of agencyRuleIds) {
              const evalResult = await db.delete(workflowRuleEvaluations)
                .where(and(
                  eq(workflowRuleEvaluations.ruleId, ruleId),
                  lt(workflowRuleEvaluations.createdAt, cutoffDate)
                ));
              evalDeletedCount += (evalResult as any).rowCount || 0;
            }
            deletedCount = evalDeletedCount;
          }
          break;
      }
      
      // Update policy with cleanup stats
      await db.update(workflowRetentionPolicies)
        .set({
          lastCleanupAt: new Date(),
          recordsDeleted: sql`${workflowRetentionPolicies.recordsDeleted} + ${deletedCount}`,
          updatedAt: new Date(),
        })
        .where(eq(workflowRetentionPolicies.id, policy.id));
      
      results.push({
        resourceType: policy.resourceType,
        retentionDays: policy.retentionDays,
        deletedCount,
        cutoffDate,
      });
    }
    
    res.json({ 
      message: "Retention cleanup completed",
      results 
    });
  } catch (error: any) {
    console.error("Error running retention cleanup:", error);
    res.status(500).json({ message: "Failed to run retention cleanup" });
  }
});

export default router;
