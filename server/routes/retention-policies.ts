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
import { buildRetentionPlan, estimateRetentionCounts, runRetentionExecution } from '../jobs/retention-job';
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

    const includeCounts = String(req.query.includeCounts ?? "false") === "true";

    const policies = await db.select()
      .from(workflowRetentionPolicies)
      .where(eq(workflowRetentionPolicies.agencyId, agencyId));

    let plan = buildRetentionPlan(
      policies.map((policy) => ({
        resourceType: policy.resourceType,
        retentionDays: policy.retentionDays,
        enabled: policy.enabled ?? true,
        archiveBeforeDelete: policy.archiveBeforeDelete ?? false,
      }))
    );

    if (includeCounts) {
      plan = await estimateRetentionCounts({ agencyId, plan });
    }

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

    const dryRun = req.body?.dryRun !== false;
    
    const policies = await db.select()
      .from(workflowRetentionPolicies)
      .where(and(
        eq(workflowRetentionPolicies.agencyId, agencyId),
        eq(workflowRetentionPolicies.enabled, true)
      ));
    
    const plan = buildRetentionPlan(
      policies.map((policy) => ({
        resourceType: policy.resourceType,
        retentionDays: policy.retentionDays,
        enabled: policy.enabled ?? true,
        archiveBeforeDelete: policy.archiveBeforeDelete ?? false,
      }))
    );

    const results = await runRetentionExecution({
      agencyId,
      plan,
      dryRun,
    });

    const updatedAt = new Date();
    for (const policy of policies) {
      const result = results.find((row) => row.resourceType === policy.resourceType);
      if (!result) continue;
      const deletedCount = result.deletedCount ?? 0;

      await db.update(workflowRetentionPolicies)
        .set({
          lastCleanupAt: updatedAt,
          recordsDeleted: sql`${workflowRetentionPolicies.recordsDeleted} + ${deletedCount}`,
          updatedAt,
        })
        .where(eq(workflowRetentionPolicies.id, policy.id));
    }
    
    res.json({ 
      message: dryRun ? "Retention cleanup dry-run completed" : "Retention cleanup completed",
      dryRun,
      results,
    });
  } catch (error: any) {
    console.error("Error running retention cleanup:", error);
    res.status(500).json({ message: "Failed to run retention cleanup" });
  }
});

export default router;
