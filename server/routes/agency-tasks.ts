import { Router } from 'express';
import { storage } from '../storage';
import { requireAuth, requireRole, requireTaskAccess, type AuthRequest } from '../middleware/supabase-auth';
import { TaskListService } from '../application/tasks/task-list-service';
import { TaskQueryService } from '../application/tasks/task-query-service';
import { TaskAssignmentService } from '../application/tasks/task-assignment-service';
import { TaskMutationService } from '../application/tasks/task-mutation-service';
import { TaskReadService } from '../application/tasks/task-read-service';

const router = Router();
const taskListService = new TaskListService(storage);
const taskQueryService = new TaskQueryService(storage);
const taskAssignmentService = new TaskAssignmentService(storage);
const taskMutationService = new TaskMutationService(storage);
const taskReadService = new TaskReadService(storage);

function sendTaskListResult(
  res: any,
  result: { ok: boolean; status: number; data?: unknown; error?: string }
) {
  if (!result.ok) {
    return res.status(result.status).json({ message: result.error });
  }
  if (result.status === 204) {
    return res.status(204).send();
  }
  return res.status(result.status).json(result.data);
}

function sendTaskQueryResult(
  res: any,
  result: { ok: boolean; status: number; data?: unknown; error?: string }
) {
  if (!result.ok) {
    return res.status(result.status).json({ message: result.error });
  }
  return res.status(result.status).json(result.data);
}

function sendTaskAssignmentResult(
  res: any,
  result: { ok: boolean; status: number; data?: unknown; error?: string }
) {
  if (!result.ok) {
    return res.status(result.status).json({ message: result.error });
  }
  if (result.status === 204) {
    return res.status(204).send();
  }
  return res.status(result.status).json(result.data);
}

function sendTaskMutationResult(
  res: any,
  result: { ok: boolean; status: number; data?: unknown; error?: string }
) {
  if (!result.ok) {
    return res.status(result.status).json({ message: result.error });
  }
  if (result.status === 204) {
    return res.status(204).send();
  }
  return res.status(result.status).json(result.data);
}

function sendTaskReadResult(
  res: any,
  result: { ok: boolean; status: number; data?: unknown; error?: string }
) {
  if (!result.ok) {
    return res.status(result.status).json({ message: result.error });
  }
  return res.status(result.status).json(result.data);
}

export function createTaskListCreateHandler(service: TaskListService = taskListService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return sendTaskListResult(
        res,
        await service.createTaskList(
          { agencyId: req.user?.agencyId, isSuperAdmin: req.user?.isSuperAdmin },
          req.body
        )
      );
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

export function createTaskListUpdateHandler(service: TaskListService = taskListService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return sendTaskListResult(
        res,
        await service.updateTaskList(
          { agencyId: req.user?.agencyId, isSuperAdmin: req.user?.isSuperAdmin },
          req.params.id,
          req.body
        )
      );
    } catch (error: any) {
      return res.status(500).json({ message: 'Failed to update task list' });
    }
  };
}

export function createTaskListDeleteHandler(service: TaskListService = taskListService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return sendTaskListResult(
        res,
        await service.deleteTaskList(
          { agencyId: req.user?.agencyId, isSuperAdmin: req.user?.isSuperAdmin },
          req.params.id
        )
      );
    } catch (error: any) {
      return res.status(500).json({ message: 'Failed to delete task list' });
    }
  };
}

router.post('/task-lists', requireAuth, requireRole('Admin', 'SuperAdmin'), createTaskListCreateHandler());
router.patch('/task-lists/:id', requireAuth, requireRole('Admin', 'SuperAdmin'), createTaskListUpdateHandler());
router.delete('/task-lists/:id', requireAuth, requireRole('Admin', 'SuperAdmin'), createTaskListDeleteHandler());

export function createTaskListTasksHandler(service: TaskReadService = taskReadService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return sendTaskReadResult(res, await service.listTasksByListId(req.params.listId));
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

export function createTaskSubtasksHandler(service: TaskReadService = taskReadService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return sendTaskReadResult(res, await service.listSubtasks(req.params.taskId));
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

export function createTaskActivitiesHandler(service: TaskReadService = taskReadService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return sendTaskReadResult(res, await service.listTaskActivities(req.params.taskId));
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get('/task-lists/:listId/tasks', requireAuth, requireRole('Admin', 'Staff', 'SuperAdmin'), createTaskListTasksHandler());
router.get('/tasks/:taskId/subtasks', requireAuth, requireRole('Admin', 'Staff', 'SuperAdmin'), requireTaskAccess(storage), createTaskSubtasksHandler());
router.get('/tasks/:taskId/activities', requireAuth, requireRole('Admin', 'Staff', 'Client', 'SuperAdmin'), requireTaskAccess(storage), createTaskActivitiesHandler());

export function createTasksListHandler(service: TaskQueryService = taskQueryService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return sendTaskQueryResult(
        res,
        await service.listTasksWithProject({
          agencyId: req.user?.agencyId,
          isSuperAdmin: req.user?.isSuperAdmin,
        })
      );
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

export function createStaffAssignmentsListHandler(service: TaskQueryService = taskQueryService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return sendTaskQueryResult(
        res,
        await service.listStaffAssignments({
          agencyId: req.user?.agencyId,
          isSuperAdmin: req.user?.isSuperAdmin,
        })
      );
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get('/tasks', requireAuth, requireRole('Admin', 'SuperAdmin'), createTasksListHandler());
router.get('/staff-assignments', requireAuth, requireRole('Admin', 'SuperAdmin'), createStaffAssignmentsListHandler());

export function createTaskCreateHandler(service: TaskMutationService = taskMutationService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return sendTaskMutationResult(
        res,
        await service.createTask(req.body, { agencyId: req.user?.agencyId })
      );
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

export function createTaskUpdateHandler(service: TaskMutationService = taskMutationService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return sendTaskMutationResult(
        res,
        await service.updateTask(req.params.id, req.body, { agencyId: req.user?.agencyId })
      );
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

export function createTaskDeleteHandler(service: TaskMutationService = taskMutationService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return sendTaskMutationResult(res, await service.deleteTask(req.params.id));
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.post('/tasks', requireAuth, requireRole('Admin', 'SuperAdmin'), createTaskCreateHandler());
router.patch('/tasks/:id', requireAuth, requireRole('Admin', 'SuperAdmin'), requireTaskAccess(storage), createTaskUpdateHandler());
router.delete('/tasks/:id', requireAuth, requireRole('Admin', 'SuperAdmin'), requireTaskAccess(storage), createTaskDeleteHandler());

export function createTaskAssignHandler(service: TaskAssignmentService = taskAssignmentService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return sendTaskAssignmentResult(
        res,
        await service.assignStaff(req.params.taskId, req.body?.staffProfileId, { userId: req.user?.id })
      );
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

export function createTaskUnassignHandler(service: TaskAssignmentService = taskAssignmentService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return sendTaskAssignmentResult(
        res,
        await service.unassignStaff(req.params.taskId, req.params.staffProfileId, { userId: req.user?.id })
      );
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.post('/tasks/:taskId/assign', requireAuth, requireRole('Admin', 'SuperAdmin'), requireTaskAccess(storage), createTaskAssignHandler());
router.delete('/tasks/:taskId/assign/:staffProfileId', requireAuth, requireRole('Admin', 'SuperAdmin'), requireTaskAccess(storage), createTaskUnassignHandler());

export default router;
