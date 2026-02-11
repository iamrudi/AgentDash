/**
 * Workflows Router
 * 
 * Workflow engine routes including CRUD operations, execution,
 * validation, duplication, and lineage queries.
 * 
 * Routes: 12
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/supabase-auth';
import { storage } from '../storage';
import { resolveAgencyContext } from '../middleware/agency-context';

const workflowsRouter = Router();
workflowsRouter.use(requireAuth, requireRole("Admin", "SuperAdmin"));

// Get all workflows for agency
workflowsRouter.get("/", async (req: AuthRequest, res) => {
  try {
    const { agencyId } = resolveAgencyContext(req, { allowQueryParam: true });
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const workflows = await storage.getWorkflowsByAgencyId(agencyId);
    res.json(workflows);
  } catch (error: any) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({ message: "Failed to fetch workflows" });
  }
});

// Validate workflow configuration
const workflowValidationSchema = z.object({
  steps: z.array(z.object({
    id: z.string().min(1),
    type: z.enum(["signal", "rule", "ai", "action", "transform", "notification", "branch"]),
    name: z.string().optional(),
    config: z.record(z.unknown()).optional(),
    position: z.object({
      x: z.number(),
      y: z.number(),
    }).optional(),
  })),
  connections: z.array(z.object({
    source: z.string().min(1),
    target: z.string().min(1),
    sourceHandle: z.string().optional(),
    targetHandle: z.string().optional(),
  })).optional().default([]),
});

workflowsRouter.post("/validate", async (req: AuthRequest, res) => {
  try {
    const validationResult = workflowValidationSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        valid: false,
        errors: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
        warnings: [],
      });
    }
    
    const { steps, connections } = validationResult.data;
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (steps.length === 0) {
      errors.push("Workflow must have at least one step");
    }
    
    const signalSteps = steps.filter((s) => s.type === "signal");
    if (signalSteps.length === 0) {
      errors.push("Workflow must have at least one signal step as entry point");
    }
    
    const connectedTargets = new Set(connections.map((c) => c.target));
    const orphanedSteps = steps.filter((s) => 
      s.type !== "signal" && !connectedTargets.has(s.id)
    );
    if (orphanedSteps.length > 0) {
      warnings.push(`${orphanedSteps.length} step(s) have no incoming connections`);
    }
    
    steps.forEach((step) => {
      if (step.type === "ai" && !step.config?.promptTemplate) {
        warnings.push(`AI step "${step.name || step.id}" is missing a prompt template`);
      }
      if (step.type === "notification" && !step.config?.channel) {
        warnings.push(`Notification step "${step.name || step.id}" is missing a channel`);
      }
    });
    
    res.json({
      valid: errors.length === 0,
      errors,
      warnings,
    });
  } catch (error: any) {
    console.error('Error validating workflow:', error);
    res.status(500).json({ message: "Failed to validate workflow" });
  }
});

// Get single workflow
workflowsRouter.get("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const workflow = await storage.getWorkflowById(id);
    
    if (!workflow) {
      return res.status(404).json({ message: "Workflow not found" });
    }
    
    const userAgencyId = req.user?.agencyId;
    if (workflow.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    res.json(workflow);
  } catch (error: any) {
    console.error('Error fetching workflow:', error);
    res.status(500).json({ message: "Failed to fetch workflow" });
  }
});

// Create workflow
workflowsRouter.post("/", async (req: AuthRequest, res) => {
  try {
    const { agencyId } = resolveAgencyContext(req, { requireBodyField: 'agencyId' });
    const resolvedAgencyId = agencyId || req.user?.agencyId;
    
    if (!resolvedAgencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const { name, description, triggerType, triggerConfig, steps, timeout, retryPolicy } = req.body;
    
    if (!name || !triggerType || !steps) {
      return res.status(400).json({ message: "name, triggerType, and steps are required" });
    }
    
    const workflow = await storage.createWorkflow({
      agencyId: resolvedAgencyId,
      name,
      description,
      triggerType,
      triggerConfig,
      steps,
      timeout,
      retryPolicy,
      createdBy: req.user?.id,
      status: "draft",
    });
    
    res.status(201).json(workflow);
  } catch (error: any) {
    console.error('Error creating workflow:', error);
    res.status(500).json({ message: "Failed to create workflow" });
  }
});

// Update workflow
workflowsRouter.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const workflow = await storage.getWorkflowById(id);
    
    if (!workflow) {
      return res.status(404).json({ message: "Workflow not found" });
    }
    
    const userAgencyId = req.user?.agencyId;
    if (workflow.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const { name, description, status, triggerType, triggerConfig, steps, timeout, retryPolicy } = req.body;
    
    const updated = await storage.updateWorkflow(id, {
      name,
      description,
      status,
      triggerType,
      triggerConfig,
      steps,
      timeout,
      retryPolicy,
    });
    
    res.json(updated);
  } catch (error: any) {
    console.error('Error updating workflow:', error);
    res.status(500).json({ message: "Failed to update workflow" });
  }
});

// Delete workflow
workflowsRouter.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const workflow = await storage.getWorkflowById(id);
    
    if (!workflow) {
      return res.status(404).json({ message: "Workflow not found" });
    }
    
    const userAgencyId = req.user?.agencyId;
    if (workflow.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    await storage.deleteWorkflow(id);
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting workflow:', error);
    res.status(500).json({ message: "Failed to delete workflow" });
  }
});

// Execute workflow manually
workflowsRouter.post("/:id/execute", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const workflow = await storage.getWorkflowById(id);
    
    if (!workflow) {
      return res.status(404).json({ message: "Workflow not found" });
    }
    
    const userAgencyId = req.user?.agencyId;
    if (workflow.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    if (workflow.status !== "active") {
      return res.status(400).json({ message: "Workflow must be active to execute" });
    }
    
    const { createWorkflowEngine } = await import("../workflow/engine");
    const engine = createWorkflowEngine(storage);
    
    const triggerPayload = req.body.payload || {};
    
    const execution = await engine.execute(workflow, triggerPayload, {
      triggerId: `manual-${Date.now()}`,
      triggerType: "manual",
      skipIdempotencyCheck: req.body.skipIdempotencyCheck,
    });
    
    res.json(execution);
  } catch (error: any) {
    console.error('Error executing workflow:', error);
    res.status(500).json({ message: "Failed to execute workflow", error: error.message });
  }
});

// Get workflow executions
workflowsRouter.get("/:id/executions", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const workflow = await storage.getWorkflowById(id);
    
    if (!workflow) {
      return res.status(404).json({ message: "Workflow not found" });
    }
    
    const userAgencyId = req.user?.agencyId;
    if (workflow.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const executions = await storage.getWorkflowExecutionsByWorkflowId(id);
    res.json(executions);
  } catch (error: any) {
    console.error('Error fetching workflow executions:', error);
    res.status(500).json({ message: "Failed to fetch workflow executions" });
  }
});

// Duplicate workflow
workflowsRouter.post("/:id/duplicate", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const workflow = await storage.getWorkflowById(id);
    
    if (!workflow) {
      return res.status(404).json({ message: "Workflow not found" });
    }
    
    const userAgencyId = req.user?.agencyId;
    if (workflow.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const duplicatedWorkflow = await storage.createWorkflow({
      agencyId: workflow.agencyId,
      name: `${workflow.name} (Copy)`,
      description: workflow.description,
      status: "draft",
      triggerType: workflow.triggerType,
      triggerConfig: workflow.triggerConfig as any,
      steps: workflow.steps as any,
      timeout: workflow.timeout,
      retryPolicy: workflow.retryPolicy as any,
      createdBy: req.user?.id || null,
    });
    
    res.json(duplicatedWorkflow);
  } catch (error: any) {
    console.error('Error duplicating workflow:', error);
    res.status(500).json({ message: "Failed to duplicate workflow" });
  }
});

export default workflowsRouter;
