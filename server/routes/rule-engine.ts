/**
 * Rule Engine Router
 * 
 * Workflow rules API including CRUD operations, versions, 
 * conditions, actions, audits, and evaluations.
 * 
 * Routes: 12
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/supabase-auth';
import { resolveAgencyContext } from '../middleware/agency-context';
import { storage } from '../storage';
import { insertWorkflowRuleSchema, updateWorkflowRuleSchema } from '@shared/schema';

const router = Router();

// Get all rules for agency
router.get("/workflow-rules", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { agencyId } = resolveAgencyContext(req, { allowQueryParam: true });
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const rules = await storage.getWorkflowRulesByAgencyId(agencyId);
    res.json(rules);
  } catch (error: any) {
    console.error('Error fetching workflow rules:', error);
    res.status(500).json({ message: "Failed to fetch workflow rules" });
  }
});

// Get single rule
router.get("/workflow-rules/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const rule = await storage.getWorkflowRuleById(id);
    
    if (!rule) {
      return res.status(404).json({ message: "Rule not found" });
    }
    
    const userAgencyId = req.user?.agencyId;
    if (rule.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    res.json(rule);
  } catch (error: any) {
    console.error('Error fetching workflow rule:', error);
    res.status(500).json({ message: "Failed to fetch workflow rule" });
  }
});

// Create rule
router.post("/workflow-rules", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { agencyId } = resolveAgencyContext(req, { allowQueryParam: true });
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const ruleInput = {
      ...req.body,
      agencyId,
      createdBy: req.user?.id || null,
    };
    
    const parsed = insertWorkflowRuleSchema.safeParse(ruleInput);
    if (!parsed.success) {
      return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
    }
    
    const rule = await storage.createWorkflowRule(parsed.data);
    
    await storage.createRuleAudit({
      ruleId: rule.id,
      actorId: req.user?.id || null,
      changeType: "created",
      changeSummary: `Rule "${rule.name}" created`,
      newState: rule as any,
    });
    
    res.status(201).json(rule);
  } catch (error: any) {
    console.error('Error creating workflow rule:', error);
    res.status(500).json({ message: "Failed to create workflow rule" });
  }
});

// Update rule
router.patch("/workflow-rules/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const rule = await storage.getWorkflowRuleById(id);
    
    if (!rule) {
      return res.status(404).json({ message: "Rule not found" });
    }
    
    const userAgencyId = req.user?.agencyId;
    if (rule.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const parsed = updateWorkflowRuleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
    }
    
    const previousState = { ...rule };
    
    const updated = await storage.updateWorkflowRule(id, parsed.data);
    
    await storage.createRuleAudit({
      ruleId: id,
      actorId: req.user?.id || null,
      changeType: "updated",
      changeSummary: `Rule updated`,
      previousState: previousState as any,
      newState: updated as any,
    });
    
    res.json(updated);
  } catch (error: any) {
    console.error('Error updating workflow rule:', error);
    res.status(500).json({ message: "Failed to update workflow rule" });
  }
});

// Delete rule
router.delete("/workflow-rules/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const rule = await storage.getWorkflowRuleById(id);
    
    if (!rule) {
      return res.status(404).json({ message: "Rule not found" });
    }
    
    const userAgencyId = req.user?.agencyId;
    if (rule.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    await storage.createRuleAudit({
      ruleId: id,
      actorId: req.user?.id || null,
      changeType: "deleted",
      changeSummary: `Rule "${rule.name}" deleted`,
      previousState: rule as any,
    });
    
    await storage.deleteWorkflowRule(id);
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting workflow rule:', error);
    res.status(500).json({ message: "Failed to delete workflow rule" });
  }
});

// Get rule versions
router.get("/workflow-rules/:id/versions", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const rule = await storage.getWorkflowRuleById(id);
    
    if (!rule) {
      return res.status(404).json({ message: "Rule not found" });
    }
    
    const userAgencyId = req.user?.agencyId;
    if (rule.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const versions = await storage.getRuleVersionsByRuleId(id);
    res.json(versions);
  } catch (error: any) {
    console.error('Error fetching rule versions:', error);
    res.status(500).json({ message: "Failed to fetch rule versions" });
  }
});

// Create rule version
router.post("/workflow-rules/:id/versions", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const rule = await storage.getWorkflowRuleById(id);
    
    if (!rule) {
      return res.status(404).json({ message: "Rule not found" });
    }
    
    const userAgencyId = req.user?.agencyId;
    if (rule.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const existingVersions = await storage.getRuleVersionsByRuleId(id);
    const nextVersion = existingVersions.length > 0 
      ? Math.max(...existingVersions.map(v => v.version)) + 1 
      : 1;
    
    const { conditions, actions, ...versionData } = req.body;
    
    const versionRequestSchema = z.object({
      conditionLogic: z.enum(["all", "any"]).optional(),
      thresholdConfig: z.record(z.unknown()).optional(),
      lifecycleConfig: z.record(z.unknown()).optional(),
      anomalyConfig: z.record(z.unknown()).optional(),
    });
    
    const parsedRequest = versionRequestSchema.safeParse(versionData);
    if (!parsedRequest.success) {
      return res.status(400).json({ message: "Validation error", errors: parsedRequest.error.errors });
    }
    
    const version = await storage.createRuleVersion({
      ruleId: id,
      version: nextVersion,
      status: "draft",
      conditionLogic: parsedRequest.data.conditionLogic || "all",
      thresholdConfig: parsedRequest.data.thresholdConfig,
      lifecycleConfig: parsedRequest.data.lifecycleConfig,
      anomalyConfig: parsedRequest.data.anomalyConfig,
      createdBy: req.user?.id || null,
    });
    
    if (conditions && Array.isArray(conditions) && conditions.length > 0) {
      const conditionSchema = z.object({
        fieldPath: z.string().min(1),
        operator: z.string().min(1),
        comparisonValue: z.unknown().optional(),
        windowConfig: z.record(z.unknown()).optional(),
        scope: z.enum(["signal", "context", "history", "aggregated"]).optional(),
        order: z.number().optional(),
      });
      
      const conditionInputs = [];
      for (let i = 0; i < conditions.length; i++) {
        const parsed = conditionSchema.safeParse(conditions[i]);
        if (!parsed.success) {
          return res.status(400).json({ 
            message: "Condition validation error", 
            errors: parsed.error.errors 
          });
        }
        conditionInputs.push({
          ruleVersionId: version.id,
          order: parsed.data.order ?? i,
          fieldPath: parsed.data.fieldPath,
          operator: parsed.data.operator,
          comparisonValue: parsed.data.comparisonValue as any,
          windowConfig: parsed.data.windowConfig as any,
          scope: parsed.data.scope || "signal",
        });
      }
      
      await storage.createRuleConditions(conditionInputs);
    }
    
    if (actions && Array.isArray(actions) && actions.length > 0) {
      const actionSchema = z.object({
        actionType: z.string().min(1),
        actionConfig: z.record(z.unknown()).optional(),
        order: z.number().optional(),
      });
      
      const actionInputs = [];
      for (let i = 0; i < actions.length; i++) {
        const parsed = actionSchema.safeParse(actions[i]);
        if (!parsed.success) {
          return res.status(400).json({ 
            message: "Action validation error", 
            errors: parsed.error.errors 
          });
        }
        actionInputs.push({
          ruleVersionId: version.id,
          order: parsed.data.order ?? i,
          actionType: parsed.data.actionType,
          actionConfig: parsed.data.actionConfig || {},
        });
      }
      
      await storage.createRuleActions(actionInputs);
    }
    
    res.status(201).json(version);
  } catch (error: any) {
    console.error('Error creating rule version:', error);
    res.status(500).json({ message: "Failed to create rule version" });
  }
});

// Publish rule version
router.post("/workflow-rule-versions/:id/publish", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const version = await storage.getRuleVersionById(id);
    
    if (!version) {
      return res.status(404).json({ message: "Version not found" });
    }
    
    const rule = await storage.getWorkflowRuleById(version.ruleId);
    if (!rule) {
      return res.status(404).json({ message: "Rule not found" });
    }
    
    const userAgencyId = req.user?.agencyId;
    if (rule.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const published = await storage.publishRuleVersion(id);
    
    await storage.updateWorkflowRule(rule.id, { defaultVersionId: id });
    
    await storage.createRuleAudit({
      ruleId: rule.id,
      ruleVersionId: id,
      actorId: req.user?.id || null,
      changeType: "published",
      changeSummary: `Version ${version.version} published`,
      newState: published as any,
    });
    
    res.json(published);
  } catch (error: any) {
    console.error('Error publishing rule version:', error);
    res.status(500).json({ message: "Failed to publish rule version" });
  }
});

// Get rule conditions for a version
router.get("/workflow-rule-versions/:id/conditions", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const conditions = await storage.getRuleConditionsByVersionId(id);
    res.json(conditions);
  } catch (error: any) {
    console.error('Error fetching rule conditions:', error);
    res.status(500).json({ message: "Failed to fetch rule conditions" });
  }
});

// Get rule actions for a version
router.get("/workflow-rule-versions/:id/actions", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const actions = await storage.getRuleActionsByVersionId(id);
    res.json(actions);
  } catch (error: any) {
    console.error('Error fetching rule actions:', error);
    res.status(500).json({ message: "Failed to fetch rule actions" });
  }
});

// Get rule audits
router.get("/workflow-rules/:id/audits", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const rule = await storage.getWorkflowRuleById(id);
    
    if (!rule) {
      return res.status(404).json({ message: "Rule not found" });
    }
    
    const userAgencyId = req.user?.agencyId;
    if (rule.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const audits = await storage.getRuleAuditsByRuleId(id);
    res.json(audits);
  } catch (error: any) {
    console.error('Error fetching rule audits:', error);
    res.status(500).json({ message: "Failed to fetch rule audits" });
  }
});

// Get rule evaluations
router.get("/workflow-rules/:id/evaluations", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const rule = await storage.getWorkflowRuleById(id);
    
    if (!rule) {
      return res.status(404).json({ message: "Rule not found" });
    }
    
    const userAgencyId = req.user?.agencyId;
    if (rule.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const limit = parseInt(req.query.limit as string) || 100;
    const evaluations = await storage.getRuleEvaluationsByRuleId(id, limit);
    res.json(evaluations);
  } catch (error: any) {
    console.error('Error fetching rule evaluations:', error);
    res.status(500).json({ message: "Failed to fetch rule evaluations" });
  }
});

export default router;
