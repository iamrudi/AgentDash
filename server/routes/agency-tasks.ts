import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { requireAuth, requireRole, requireTaskAccess, type AuthRequest } from '../middleware/supabase-auth';
import { insertTaskSchema, updateTaskSchema, type Task } from '@shared/schema';
import { durationIntelligenceIntegration } from '../intelligence/duration-intelligence-integration';

const router = Router();

router.post('/task-lists', requireAuth, requireRole('Admin', 'SuperAdmin'), async (req: AuthRequest, res) => {
  try {
    if (!req.body.projectId) {
      return res.status(400).json({ message: 'projectId is required' });
    }

    const projectWithAgency = await storage.getProjectWithAgency(req.body.projectId);
    if (!projectWithAgency) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    let agencyId: string;
    
    if (req.user!.isSuperAdmin) {
      agencyId = projectWithAgency.agencyId;
    } else {
      if (!req.user!.agencyId) {
        return res.status(403).json({ message: 'Agency association required' });
      }
      
      if (projectWithAgency.agencyId !== req.user!.agencyId) {
        return res.status(403).json({ message: 'Cannot create task list for another agency\'s project' });
      }
      
      agencyId = req.user!.agencyId;
    }

    if (req.body.agencyId && req.body.agencyId !== agencyId) {
      return res.status(403).json({ message: 'Cannot specify different agencyId' });
    }

    const { insertTaskListSchema } = await import('@shared/schema');
    const taskListData = insertTaskListSchema.parse({
      ...req.body,
      agencyId
    });

    const newTaskList = await storage.createTaskList(taskListData);
    res.status(201).json(newTaskList);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    res.status(500).json({ message: error.message });
  }
});

router.patch('/task-lists/:id', requireAuth, requireRole('Admin', 'SuperAdmin'), async (req: AuthRequest, res) => {
  try {
    let agencyId: string | undefined;
    if (req.user!.isSuperAdmin) {
      agencyId = undefined;
    } else {
      if (!req.user!.agencyId) {
        return res.status(403).json({ message: 'Agency association required' });
      }
      agencyId = req.user!.agencyId;
    }

    const { insertTaskListSchema } = await import('@shared/schema');
    const updateData = insertTaskListSchema.partial().parse(req.body);
    const updatedTaskList = await storage.updateTaskList(req.params.id, updateData, agencyId);

    res.json(updatedTaskList);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    if (error.message?.includes('not found or access denied')) {
      return res.status(404).json({ message: 'Task list not found' });
    }
    res.status(500).json({ message: 'Failed to update task list' });
  }
});

router.delete('/task-lists/:id', requireAuth, requireRole('Admin', 'SuperAdmin'), async (req: AuthRequest, res) => {
  try {
    let agencyId: string | undefined;
    if (req.user!.isSuperAdmin) {
      agencyId = undefined;
    } else {
      if (!req.user!.agencyId) {
        return res.status(403).json({ message: 'Agency association required' });
      }
      agencyId = req.user!.agencyId;
    }

    await storage.deleteTaskList(req.params.id, agencyId);
    res.status(204).send();
  } catch (error: any) {
    if (error.message?.includes('not found or access denied')) {
      return res.status(404).json({ message: 'Task list not found' });
    }
    res.status(500).json({ message: 'Failed to delete task list' });
  }
});

router.get('/task-lists/:listId/tasks', requireAuth, requireRole('Admin', 'Staff', 'SuperAdmin'), async (req: AuthRequest, res) => {
  try {
    const tasks = await storage.getTasksByListId(req.params.listId);
    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/tasks/:taskId/subtasks', requireAuth, requireRole('Admin', 'Staff', 'SuperAdmin'), requireTaskAccess(storage), async (req: AuthRequest, res) => {
  try {
    const subtasks = await storage.getSubtasksByParentId(req.params.taskId);
    res.json(subtasks);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/tasks/:taskId/activities', requireAuth, requireRole('Admin', 'Staff', 'Client', 'SuperAdmin'), requireTaskAccess(storage), async (req: AuthRequest, res) => {
  try {
    const activities = await storage.getTaskActivities(req.params.taskId);
    res.json(activities);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/tasks', requireAuth, requireRole('Admin', 'SuperAdmin'), async (req: AuthRequest, res) => {
  try {
    let agencyId: string | undefined;
    if (req.user!.isSuperAdmin) {
      agencyId = undefined;
    } else {
      if (!req.user!.agencyId) {
        return res.status(403).json({ message: 'Agency association required' });
      }
      agencyId = req.user!.agencyId;
    }

    const tasks = await storage.getAllTasks(agencyId);
    
    const tasksWithProject = await Promise.all(
      tasks.map(async (task) => {
        const project = task.projectId ? await storage.getProjectById(task.projectId) : null;
        return { ...task, project };
      })
    );
    
    res.json(tasksWithProject);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/staff-assignments', requireAuth, requireRole('Admin', 'SuperAdmin'), async (req: AuthRequest, res) => {
  try {
    let agencyId: string | undefined;
    if (req.user!.isSuperAdmin) {
      agencyId = undefined;
    } else {
      if (!req.user!.agencyId) {
        return res.status(403).json({ message: 'Agency association required' });
      }
      agencyId = req.user!.agencyId;
    }

    const assignments = await storage.getAllTaskAssignments(agencyId);
    res.json(assignments);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/tasks', requireAuth, requireRole('Admin', 'SuperAdmin'), async (req: AuthRequest, res) => {
  try {
    const taskData = insertTaskSchema.parse(req.body);
    
    const newTask = await storage.createTask(taskData);

    if (req.user?.agencyId) {
      const agencyId = req.user.agencyId;
      setImmediate(async () => {
        try {
          const taskType = (newTask.description?.toLowerCase().includes('design') ? 'design' :
                          newTask.description?.toLowerCase().includes('content') ? 'content' :
                          newTask.description?.toLowerCase().includes('dev') ? 'development' :
                          newTask.description?.toLowerCase().includes('seo') ? 'seo' : 'general');
          const complexity = newTask.priority === 'High' ? 'high' : 
                            newTask.priority === 'Low' ? 'low' : 'medium';
          
          await durationIntelligenceIntegration.onTaskCreated(agencyId, newTask, {
            taskType,
            complexity
          });
          
          console.log(`[Duration Intelligence] Generated prediction for task ${newTask.id}`);
        } catch (predictionError) {
          console.error('[Duration Intelligence] Failed to generate prediction:', predictionError);
        }
      });
    }

    res.status(201).json(newTask);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    res.status(500).json({ message: error.message });
  }
});

router.patch('/tasks/:id', requireAuth, requireRole('Admin', 'SuperAdmin'), requireTaskAccess(storage), async (req: AuthRequest, res) => {
  try {
    const oldTask = await storage.getTaskById(req.params.id);
    
    if (req.body.timeTracked !== undefined && req.body.timeTracked !== null) {
      const tracked = Number(req.body.timeTracked);
      if (!Number.isFinite(tracked) || tracked < 0 || (tracked * 2) % 1 !== 0) {
        return res.status(400).json({ 
          message: 'Time tracked must be a non-negative number in 0.5 hour increments (0, 0.5, 1, 1.5, etc.)' 
        });
      }
    }
    
    if (req.body.timeEstimate !== undefined && req.body.timeEstimate !== null) {
      const estimate = Number(req.body.timeEstimate);
      if (!Number.isFinite(estimate) || estimate < 0 || (estimate * 2) % 1 !== 0) {
        return res.status(400).json({ 
          message: 'Time estimate must be a non-negative number in 0.5 hour increments (0, 0.5, 1, 1.5, etc.)' 
        });
      }
    }
    
    const updateData = updateTaskSchema.parse(req.body);
    
    const storageData: Partial<Task> = {
      ...updateData,
      timeEstimate: updateData.timeEstimate !== undefined && updateData.timeEstimate !== null 
        ? String(updateData.timeEstimate) 
        : updateData.timeEstimate as string | null | undefined,
      timeTracked: updateData.timeTracked !== undefined && updateData.timeTracked !== null 
        ? String(updateData.timeTracked) 
        : updateData.timeTracked as string | null | undefined,
    };
    
    const updatedTask = await storage.updateTask(req.params.id, storageData);

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
          
          console.log(`[Duration Intelligence] Recorded task completion ${updatedTask.id}: ${actualHours}h actual`);
          
          const feedback = await durationIntelligenceIntegration.generateOutcomeFeedback(agencyId, updatedTask.id);
          if (feedback) {
            console.log(`[Duration Intelligence] Outcome feedback for ${updatedTask.id}: predicted ${feedback.predictedHours}h vs actual ${feedback.actualHours}h (variance: ${feedback.variancePercent.toFixed(1)}%)`);
          }
        } catch (completionError) {
          console.error('[Duration Intelligence] Failed to record completion:', completionError);
        }
      });
    }

    res.json(updatedTask);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    res.status(500).json({ message: error.message });
  }
});

router.delete('/tasks/:id', requireAuth, requireRole('Admin', 'SuperAdmin'), requireTaskAccess(storage), async (req: AuthRequest, res) => {
  try {
    await storage.deleteTask(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/tasks/:taskId/assign', requireAuth, requireRole('Admin', 'SuperAdmin'), requireTaskAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { staffProfileId } = req.body;
    
    if (!staffProfileId) {
      return res.status(400).json({ message: 'Staff profile ID is required' });
    }

    const staffProfile = await storage.getStaffProfileById(staffProfileId);
    if (!staffProfile) {
      return res.status(404).json({ message: 'Staff profile not found' });
    }

    const assignment = await storage.createStaffAssignment({
      taskId: req.params.taskId,
      staffProfileId,
    });

    try {
      await storage.createTaskActivity({
        taskId: req.params.taskId,
        userId: req.user!.id,
        action: 'assignee_added',
        fieldName: 'assignees',
        newValue: staffProfile.fullName
      });
    } catch (error) {
      console.error('Failed to log assignee addition:', error);
    }

    res.status(201).json(assignment);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/tasks/:taskId/assign/:staffProfileId', requireAuth, requireRole('Admin', 'SuperAdmin'), requireTaskAccess(storage), async (req: AuthRequest, res) => {
  try {
    const staffProfile = await storage.getStaffProfileById(req.params.staffProfileId);
    
    await storage.deleteStaffAssignment(req.params.taskId, req.params.staffProfileId);

    if (staffProfile) {
      try {
        await storage.createTaskActivity({
          taskId: req.params.taskId,
          userId: req.user!.id,
          action: 'assignee_removed',
          fieldName: 'assignees',
          oldValue: staffProfile.fullName
        });
      } catch (error) {
        console.error('Failed to log assignee removal:', error);
      }
    }

    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
