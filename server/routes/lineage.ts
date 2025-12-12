/**
 * Lineage Router
 * 
 * Lineage query routes for tracing entities back to their
 * originating workflow/signal.
 * 
 * Routes: 2
 */

import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { requireAuth, type AuthRequest } from '../middleware/supabase-auth';
import { storage } from '../storage';
import { db } from '../db';
import { tasks, projects, clients, taskLists } from '@shared/schema';

const lineageRouter = Router();

// Get lineage for a task (trace back to originating workflow/signal)
lineageRouter.get("/task/:taskId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { taskId } = req.params;
    const task = await storage.getTaskById(taskId);
    
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    
    const userAgencyId = req.user?.agencyId;
    const taskWithProject = await db.select({
      task: tasks,
      project: projects,
      client: clients,
    })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(eq(tasks.id, taskId))
      .limit(1);
    
    if (taskWithProject.length === 0) {
      return res.status(404).json({ message: "Task not found" });
    }
    
    const clientAgencyId = taskWithProject[0].client?.agencyId;
    if (clientAgencyId !== userAgencyId && !req.user?.isSuperAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const lineage: any = {
      task: taskWithProject[0].task,
      project: taskWithProject[0].project,
      client: taskWithProject[0].client,
      workflowExecution: null,
      workflow: null,
      signal: null,
      events: [],
    };
    
    const taskData = taskWithProject[0].task as any;
    if (taskData.workflowExecutionId) {
      const execution = await storage.getWorkflowExecutionById(taskData.workflowExecutionId);
      if (execution) {
        lineage.workflowExecution = execution;
        
        const workflow = await storage.getWorkflowById(execution.workflowId);
        lineage.workflow = workflow;
        
        if (execution.triggerId) {
          const signal = await storage.getSignalById(execution.triggerId);
          lineage.signal = signal;
        }
        
        const events = await storage.getWorkflowEventsByExecutionId(execution.id);
        lineage.events = events;
      }
    }
    
    res.json(lineage);
  } catch (error: any) {
    console.error('Error fetching task lineage:', error);
    res.status(500).json({ message: "Failed to fetch task lineage" });
  }
});

// Get lineage for a project
lineageRouter.get("/project/:projectId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    
    const projectWithClient = await db.select({
      project: projects,
      client: clients,
    })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(eq(projects.id, projectId))
      .limit(1);
    
    if (projectWithClient.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }
    
    const userAgencyId = req.user?.agencyId;
    const clientAgencyId = projectWithClient[0].client?.agencyId;
    if (clientAgencyId !== userAgencyId && !req.user?.isSuperAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const lineage: any = {
      project: projectWithClient[0].project,
      client: projectWithClient[0].client,
      workflowExecution: null,
      workflow: null,
      signal: null,
      events: [],
      createdTasks: [],
      createdLists: [],
    };
    
    const projectData = projectWithClient[0].project as any;
    if (projectData.workflowExecutionId) {
      const execution = await storage.getWorkflowExecutionById(projectData.workflowExecutionId);
      if (execution) {
        lineage.workflowExecution = execution;
        
        const workflow = await storage.getWorkflowById(execution.workflowId);
        lineage.workflow = workflow;
        
        if (execution.triggerId) {
          const signal = await storage.getSignalById(execution.triggerId);
          lineage.signal = signal;
        }
        
        const events = await storage.getWorkflowEventsByExecutionId(execution.id);
        lineage.events = events;
      }
    }
    
    if (projectData.workflowExecutionId) {
      const createdTasks = await db.select()
        .from(tasks)
        .where(eq((tasks as any).workflowExecutionId, projectData.workflowExecutionId));
      lineage.createdTasks = createdTasks;
      
      const createdLists = await db.select()
        .from(taskLists)
        .where(eq((taskLists as any).workflowExecutionId, projectData.workflowExecutionId));
      lineage.createdLists = createdLists;
    }
    
    res.json(lineage);
  } catch (error: any) {
    console.error('Error fetching project lineage:', error);
    res.status(500).json({ message: "Failed to fetch project lineage" });
  }
});

export default lineageRouter;
