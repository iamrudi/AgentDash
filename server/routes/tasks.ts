/**
 * Tasks Router
 * 
 * Task management routes including subtasks, messages, relationships,
 * and CRUD operations with Duration Intelligence integration.
 * 
 * Routes: 9
 */

import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireAuth, requireRole, requireTaskAccess, type AuthRequest } from '../middleware/supabase-auth';
import { storage } from '../storage';
import { db } from '../db';
import { taskRelationships, type Task } from '@shared/schema';
import { durationIntelligenceIntegration } from '../intelligence/duration-intelligence-integration';

const tasksRouter = Router();

async function logTaskActivity(taskId: string, userId: string, oldTask: Task, newTask: Task) {
  try {
    const changes: Array<{action: string, fieldName?: string, oldValue?: string, newValue?: string}> = [];
    
    if (oldTask.status !== newTask.status) {
      changes.push({
        action: 'status_changed',
        fieldName: 'status',
        oldValue: oldTask.status,
        newValue: newTask.status
      });
    }
    
    if (oldTask.priority !== newTask.priority) {
      changes.push({
        action: 'priority_changed',
        fieldName: 'priority',
        oldValue: oldTask.priority || '',
        newValue: newTask.priority || ''
      });
    }
    
    if (oldTask.startDate !== newTask.startDate) {
      changes.push({
        action: 'date_changed',
        fieldName: 'startDate',
        oldValue: oldTask.startDate || '',
        newValue: newTask.startDate || ''
      });
    }
    
    if (oldTask.dueDate !== newTask.dueDate) {
      changes.push({
        action: 'date_changed',
        fieldName: 'dueDate',
        oldValue: oldTask.dueDate || '',
        newValue: newTask.dueDate || ''
      });
    }
    
    if (oldTask.description !== newTask.description) {
      changes.push({
        action: 'description_changed',
        fieldName: 'description',
        oldValue: oldTask.description?.substring(0, 100) || '',
        newValue: newTask.description?.substring(0, 100) || ''
      });
    }
    
    for (const change of changes) {
      await storage.createTaskActivity({
        taskId,
        userId,
        ...change
      });
    }
  } catch (error) {
    console.error('Failed to log task activity:', error);
  }
}

tasksRouter.post("/", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const task = await storage.createTask(req.body);
    res.status(201).json(task);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

tasksRouter.post("/:taskId/subtasks", requireAuth, requireRole("Staff", "Admin", "SuperAdmin"), requireTaskAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { taskId } = req.params;
    
    const profile = await storage.getProfileById(req.user!.id);
    if (!profile) {
      return res.status(403).json({ message: "Profile not found" });
    }
    
    if (req.user!.role === "Staff") {
      const assignments = await storage.getAssignmentsByTaskId(taskId);
      const isAssigned = assignments.some(a => a.staffProfileId === profile.id);
      
      if (!isAssigned) {
        return res.status(403).json({ message: "Not assigned to parent task" });
      }
    }

    const parentTask = await storage.getTaskById(taskId);
    if (!parentTask) {
      return res.status(404).json({ message: "Parent task not found" });
    }

    const { insertTaskSchema } = await import("@shared/schema");
    const subtaskData = insertTaskSchema.parse({
      ...req.body,
      parentId: taskId,
      projectId: parentTask.projectId,
      listId: parentTask.listId,
    });
    
    const newSubtask = await storage.createTask(subtaskData);

    if (req.user!.role === "Staff" || req.user!.role === "Admin") {
      await storage.createStaffAssignment({
        taskId: newSubtask.id,
        staffProfileId: profile.id,
      });
    }

    await storage.createTaskActivity({
      taskId: taskId,
      userId: req.user!.id,
      action: 'subtask_created',
      newValue: newSubtask.description
    });

    res.status(201).json(newSubtask);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    res.status(500).json({ message: error.message });
  }
});

tasksRouter.get("/:taskId/messages", requireAuth, requireRole("Staff", "Admin", "SuperAdmin"), requireTaskAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { taskId } = req.params;
    
    const task = await storage.getTaskById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const messages = await storage.getTaskMessagesByTaskId(taskId);
    res.json(messages);
  } catch (error: any) {
    console.error("Get task messages error:", error);
    res.status(500).json({ message: error.message || "Failed to fetch task messages" });
  }
});

tasksRouter.post("/:taskId/messages", requireAuth, requireRole("Staff", "Admin", "SuperAdmin"), requireTaskAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { taskId } = req.params;
    
    const task = await storage.getTaskById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const profile = await storage.getProfileByUserId(req.user!.id);
    if (!profile) {
      return res.status(403).json({ message: "Profile not found" });
    }

    const { insertTaskMessageSchema } = await import("@shared/schema");
    const messageData = insertTaskMessageSchema.parse({
      ...req.body,
      taskId,
      senderId: profile.id,
    });

    const newMessage = await storage.createTaskMessage(messageData);
    
    const messageWithSender = {
      ...newMessage,
      sender: profile,
    };

    res.status(201).json(messageWithSender);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error("Create task message error:", error);
    res.status(500).json({ message: error.message || "Failed to create task message" });
  }
});

tasksRouter.patch("/messages/:messageId/read", requireAuth, requireRole("Staff", "Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const { messageId } = req.params;
    
    await storage.markTaskMessageAsRead(messageId);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Mark task message as read error:", error);
    res.status(500).json({ message: error.message || "Failed to mark message as read" });
  }
});

tasksRouter.get("/:taskId/relationships", requireAuth, requireRole("Staff", "Admin", "SuperAdmin"), requireTaskAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { taskId } = req.params;
    const relationships = await storage.getTaskRelationships(taskId);
    res.json(relationships);
  } catch (error: any) {
    console.error("Get task relationships error:", error);
    res.status(500).json({ message: error.message || "Failed to fetch task relationships" });
  }
});

tasksRouter.post("/:taskId/relationships", requireAuth, requireRole("Admin", "SuperAdmin"), requireTaskAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { taskId } = req.params;
    const { relatedTaskId, relationshipType } = req.body;

    if (!relatedTaskId || !relationshipType) {
      return res.status(400).json({ message: "relatedTaskId and relationshipType are required" });
    }

    const validTypes = ["blocks", "blocked_by", "relates_to", "duplicates"];
    if (!validTypes.includes(relationshipType)) {
      return res.status(400).json({ message: `Invalid relationshipType. Must be one of: ${validTypes.join(", ")}` });
    }

    const sourceTask = await storage.getTaskById(taskId);
    const relatedTask = await storage.getTaskById(relatedTaskId);
    
    if (!sourceTask) {
      return res.status(404).json({ message: "Source task not found" });
    }
    
    if (!relatedTask) {
      return res.status(404).json({ message: "Related task not found" });
    }

    if (!sourceTask.projectId || !relatedTask.projectId) {
      return res.status(400).json({ message: "Tasks must be associated with projects" });
    }

    const sourceProjectData = await storage.getProjectWithAgency(sourceTask.projectId);
    const relatedProjectData = await storage.getProjectWithAgency(relatedTask.projectId);

    if (!sourceProjectData || !relatedProjectData) {
      return res.status(404).json({ message: "Project not found for one or both tasks" });
    }

    const sourceAgencyId = sourceProjectData.agencyId;
    const relatedAgencyId = relatedProjectData.agencyId;

    if (!sourceAgencyId || !relatedAgencyId) {
      return res.status(403).json({ message: "Cannot create relationships for tasks without agency association" });
    }

    if (sourceAgencyId !== relatedAgencyId) {
      return res.status(403).json({ message: "Cannot create relationships between tasks from different agencies" });
    }

    if (req.user!.role !== "SuperAdmin" && sourceAgencyId !== req.user!.agencyId) {
      return res.status(403).json({ message: "Access denied: Tasks do not belong to your agency" });
    }

    const { insertTaskRelationshipSchema } = await import("@shared/schema");
    const relationshipData = insertTaskRelationshipSchema.parse({
      taskId,
      relatedTaskId,
      relationshipType,
    });

    const relationship = await storage.createTaskRelationship(relationshipData);
    
    const relationships = await storage.getTaskRelationships(taskId);
    const createdRelationship = relationships.find(r => r.id === relationship.id);

    res.status(201).json(createdRelationship);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error("Create task relationship error:", error);
    res.status(500).json({ message: error.message || "Failed to create task relationship" });
  }
});

tasksRouter.delete("/relationships/:relationshipId", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const { relationshipId } = req.params;
    
    const allRelationships = await db
      .select()
      .from(taskRelationships)
      .where(eq(taskRelationships.id, relationshipId))
      .limit(1);
    
    if (allRelationships.length === 0) {
      return res.status(404).json({ message: "Relationship not found" });
    }
    
    const relationship = allRelationships[0];
    
    const sourceTask = await storage.getTaskById(relationship.taskId);
    if (!sourceTask) {
      return res.status(404).json({ message: "Source task not found" });
    }
    
    if (!sourceTask.projectId) {
      return res.status(400).json({ message: "Task must be associated with a project" });
    }
    
    const projectData = await storage.getProjectWithAgency(sourceTask.projectId);
    if (!projectData) {
      return res.status(404).json({ message: "Project not found" });
    }
    
    const projectAgencyId = projectData.agencyId;
    
    if (!projectAgencyId) {
      return res.status(403).json({ message: "Cannot delete relationships for tasks without agency association" });
    }
    
    if (req.user!.role !== "SuperAdmin" && projectAgencyId !== req.user!.agencyId) {
      return res.status(403).json({ message: "Access denied: Task does not belong to your agency" });
    }
    
    await storage.deleteTaskRelationship(relationshipId);
    res.status(204).send();
  } catch (error: any) {
    console.error("Delete task relationship error:", error);
    res.status(500).json({ message: error.message || "Failed to delete task relationship" });
  }
});

tasksRouter.patch("/:id", requireAuth, requireRole("Staff", "Admin"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    if (req.user!.role === "Staff") {
      const profile = await storage.getProfileById(req.user!.id);
      if (!profile) {
        return res.status(403).json({ message: "Profile not found" });
      }
      
      const assignments = await storage.getAssignmentsByTaskId(id);
      const isAssigned = assignments.some(a => a.staffProfileId === profile.id);
      
      if (!isAssigned) {
        return res.status(403).json({ message: "Not authorized to update this task - not assigned" });
      }
    }
    
    const oldTask = await storage.getTaskById(id);
    if (!oldTask) {
      return res.status(404).json({ message: "Task not found" });
    }
    
    if (req.body.timeTracked !== undefined && req.body.timeTracked !== null) {
      const tracked = Number(req.body.timeTracked);
      if (!Number.isFinite(tracked) || tracked < 0 || (tracked * 2) % 1 !== 0) {
        return res.status(400).json({ 
          message: "Time tracked must be a non-negative number in 0.5 hour increments (0, 0.5, 1, 1.5, etc.)" 
        });
      }
    }
    
    if (req.body.timeEstimate !== undefined && req.body.timeEstimate !== null) {
      const estimate = Number(req.body.timeEstimate);
      if (!Number.isFinite(estimate) || estimate < 0 || (estimate * 2) % 1 !== 0) {
        return res.status(400).json({ 
          message: "Time estimate must be a non-negative number in 0.5 hour increments (0, 0.5, 1, 1.5, etc.)" 
        });
      }
    }
    
    const updatedTask = await storage.updateTask(id, req.body);
    
    console.log('[PATCH /api/tasks/:id] Updated task data:', JSON.stringify({
      id: updatedTask.id,
      timeEstimate: updatedTask.timeEstimate,
      timeTracked: updatedTask.timeTracked,
      hasTimeEstimate: 'timeEstimate' in updatedTask,
      hasTimeTracked: 'timeTracked' in updatedTask,
      allKeys: Object.keys(updatedTask)
    }, null, 2));
    
    await logTaskActivity(id, req.user!.id, oldTask, updatedTask);
    
    if (oldTask && oldTask.status !== 'Completed' && updatedTask.status === 'Completed' && req.user?.agencyId) {
      const agencyId = req.user.agencyId;
      setImmediate(async () => {
        try {
          const taskType = (updatedTask.description?.toLowerCase().includes('design') ? 'design' :
                          updatedTask.description?.toLowerCase().includes('content') ? 'content' :
                          updatedTask.description?.toLowerCase().includes('dev') ? 'development' :
                          updatedTask.description?.toLowerCase().includes('seo') ? 'seo' : 'general');
          const complexity = updatedTask.priority === 'High' ? 'high' : 
                            updatedTask.priority === 'Low' ? 'low' : 'medium';
          const actualHours = updatedTask.timeTracked ? parseFloat(updatedTask.timeTracked) : 0;
          
          const assignments = await storage.getAssignmentsByTaskId(updatedTask.id);
          const assigneeId = assignments.length > 0 ? assignments[0].staffProfileId : undefined;
          
          let clientId: string | undefined;
          if (updatedTask.projectId) {
            const project = await storage.getProjectById(updatedTask.projectId);
            clientId = project?.clientId ?? undefined;
          }
          
          await durationIntelligenceIntegration.recordTaskCompletion(
            agencyId, updatedTask.id, taskType, complexity, actualHours, assigneeId, clientId
          );
          
          console.log(`[Duration Intelligence] Staff recorded task completion ${updatedTask.id}: ${actualHours}h actual`);
        } catch (completionError) {
          console.error('[Duration Intelligence] Failed to record staff completion:', completionError);
        }
      });
    }
    
    res.json(updatedTask);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default tasksRouter;
