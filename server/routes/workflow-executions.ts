/**
 * Workflow Executions Router
 * 
 * Workflow execution events and lineage query routes.
 * 
 * Routes: 4
 */

import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { requireAuth, type AuthRequest } from '../middleware/supabase-auth';
import { storage } from '../storage';
import { db } from '../db';
import { tasks, projects, clients, taskLists, aiExecutions as aiExecutionsTable } from '@shared/schema';

const workflowExecutionsRouter = Router();

// Get execution events (step logs)
workflowExecutionsRouter.get("/:id/events", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const execution = await storage.getWorkflowExecutionById(id);
    
    if (!execution) {
      return res.status(404).json({ message: "Execution not found" });
    }
    
    const workflow = await storage.getWorkflowById(execution.workflowId);
    const userAgencyId = req.user?.agencyId;
    if (!workflow || (workflow.agencyId !== userAgencyId && !req.user?.isSuperAdmin)) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const events = await storage.getWorkflowEventsByExecutionId(id);
    res.json(events);
  } catch (error: any) {
    console.error('Error fetching execution events:', error);
    res.status(500).json({ message: "Failed to fetch execution events" });
  }
});

// Get all entities created by a workflow execution
workflowExecutionsRouter.get("/:id/lineage", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userAgencyId = req.user?.agencyId;
    const execution = await storage.getWorkflowExecutionById(id);
    
    if (!execution) {
      return res.status(404).json({ message: "Execution not found" });
    }
    
    if (execution.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
      return res.status(403).json({ message: "Access denied - execution belongs to different agency" });
    }
    
    const workflow = await storage.getWorkflowById(execution.workflowId);
    if (!workflow) {
      return res.status(404).json({ message: "Workflow not found" });
    }
    if (workflow.agencyId !== userAgencyId && !req.user?.isSuperAdmin) {
      return res.status(403).json({ message: "Access denied - workflow belongs to different agency" });
    }
    
    const createdProjects = await db.select()
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(and(
        eq((projects as any).workflowExecutionId, id),
        eq(clients.agencyId, userAgencyId!)
      ));
    
    const createdLists = await db.select()
      .from(taskLists)
      .where(and(
        eq((taskLists as any).workflowExecutionId, id),
        eq(taskLists.agencyId, userAgencyId!)
      ));
    
    const createdTasks = await db.select()
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(and(
        eq((tasks as any).workflowExecutionId, id),
        eq(clients.agencyId, userAgencyId!)
      ));
    
    const aiExecs = await db.select()
      .from(aiExecutionsTable)
      .where(and(
        eq(aiExecutionsTable.workflowExecutionId, id),
        eq(aiExecutionsTable.agencyId, userAgencyId!)
      ));
    
    let signal = null;
    if (execution.triggerId) {
      const signalData = await storage.getSignalById(execution.triggerId);
      if (signalData && signalData.agencyId === userAgencyId) {
        signal = signalData;
      }
    }
    
    const events = await storage.getWorkflowEventsByExecutionId(id);
    
    res.json({
      execution,
      workflow,
      signal,
      events,
      createdEntities: {
        projects: createdProjects.map(p => p.projects),
        taskLists: createdLists,
        tasks: createdTasks.map(t => t.tasks),
        aiExecutions: aiExecs,
      },
    });
  } catch (error: any) {
    console.error('Error fetching execution lineage:', error);
    res.status(500).json({ message: "Failed to fetch execution lineage" });
  }
});

export default workflowExecutionsRouter;
