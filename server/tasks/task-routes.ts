import { Router, Response } from "express";
import { z } from "zod";
import { idempotentTaskService } from "./idempotent-task-service";
import { db } from "../db";
import { tasks, taskLists, projects, clients } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/supabase-auth";

export const taskRouter = Router();
taskRouter.use(requireAuth, requireRole("Admin", "SuperAdmin"));

const idempotentTaskSchema = z.object({
  description: z.string().min(1),
  status: z.string().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.string().optional(),
  timeEstimate: z.string().optional(),
  listId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  initiativeId: z.string().uuid().optional(),
  workflowExecutionId: z.string().uuid().optional(),
  idempotencyKey: z.string().min(1),
});

const batchTaskSchema = z.object({
  tasks: z.array(z.object({
    description: z.string().min(1),
    status: z.string().optional(),
    startDate: z.string().optional(),
    dueDate: z.string().optional(),
    priority: z.string().optional(),
    timeEstimate: z.string().optional(),
    listId: z.string().uuid().optional(),
    parentId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    initiativeId: z.string().uuid().optional(),
    workflowExecutionId: z.string().uuid().optional(),
  })),
  idempotencyPrefix: z.string().optional(),
  workflowExecutionId: z.string().uuid().optional(),
});

async function verifyProjectBelongsToAgency(projectId: string, agencyId: string): Promise<boolean> {
  const result = await db
    .select({ id: projects.id })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(and(eq(projects.id, projectId), eq(clients.agencyId, agencyId)))
    .limit(1);
  return result.length > 0;
}

async function verifyListBelongsToAgency(listId: string, agencyId: string): Promise<boolean> {
  const result = await db
    .select({ id: taskLists.id })
    .from(taskLists)
    .where(and(eq(taskLists.id, listId), eq(taskLists.agencyId, agencyId)))
    .limit(1);
  return result.length > 0;
}

taskRouter.post("/idempotent", async (req: AuthRequest, res: Response) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ error: "Agency context required" });
    }

    const validation = idempotentTaskSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid input", details: validation.error.errors });
    }

    const { idempotencyKey, ...taskInput } = validation.data;

    if (taskInput.projectId) {
      const belongs = await verifyProjectBelongsToAgency(taskInput.projectId, agencyId);
      if (!belongs) {
        return res.status(403).json({ error: "Access denied: project does not belong to your agency" });
      }
    }

    if (taskInput.listId) {
      const belongs = await verifyListBelongsToAgency(taskInput.listId, agencyId);
      if (!belongs) {
        return res.status(403).json({ error: "Access denied: task list does not belong to your agency" });
      }
    }

    const result = await idempotentTaskService.createTaskIdempotent(
      taskInput,
      idempotencyKey,
      agencyId
    );

    res.status(result.created ? 201 : 200).json({
      task: result.task,
      created: result.created,
      idempotencyKey: result.idempotencyKey,
      message: result.created ? "Task created" : "Task already exists (idempotent)",
    });
  } catch (error: any) {
    console.error("[TASKS] Error creating idempotent task:", error);
    res.status(500).json({ error: error.message });
  }
});

taskRouter.post("/batch", async (req: AuthRequest, res: Response) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ error: "Agency context required" });
    }

    const validation = batchTaskSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid input", details: validation.error.errors });
    }

    const batchInput = validation.data;

    const projectIds = Array.from(new Set(batchInput.tasks.map(t => t.projectId).filter((id): id is string => !!id)));
    const listIds = Array.from(new Set(batchInput.tasks.map(t => t.listId).filter((id): id is string => !!id)));

    for (const projectId of projectIds) {
      const belongs = await verifyProjectBelongsToAgency(projectId, agencyId);
      if (!belongs) {
        return res.status(403).json({ error: `Access denied: project ${projectId} does not belong to your agency` });
      }
    }

    for (const listId of listIds) {
      const belongs = await verifyListBelongsToAgency(listId, agencyId);
      if (!belongs) {
        return res.status(403).json({ error: `Access denied: task list ${listId} does not belong to your agency` });
      }
    }

    const result = await idempotentTaskService.createTasksIdempotent(batchInput, agencyId);

    res.status(201).json({
      tasks: result.tasks.map(r => ({
        id: r.task.id,
        description: r.task.description,
        created: r.created,
        idempotencyKey: r.idempotencyKey,
      })),
      totalCreated: result.totalCreated,
      totalDeduplicated: result.totalDeduplicated,
      message: `Created ${result.totalCreated} tasks, skipped ${result.totalDeduplicated} duplicates`,
    });
  } catch (error: any) {
    console.error("[TASKS] Error creating batch tasks:", error);
    res.status(500).json({ error: error.message });
  }
});

taskRouter.put("/upsert", async (req: AuthRequest, res: Response) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ error: "Agency context required" });
    }

    const validation = idempotentTaskSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid input", details: validation.error.errors });
    }

    const { idempotencyKey, ...taskInput } = validation.data;

    if (taskInput.projectId) {
      const belongs = await verifyProjectBelongsToAgency(taskInput.projectId, agencyId);
      if (!belongs) {
        return res.status(403).json({ error: "Access denied: project does not belong to your agency" });
      }
    }

    if (taskInput.listId) {
      const belongs = await verifyListBelongsToAgency(taskInput.listId, agencyId);
      if (!belongs) {
        return res.status(403).json({ error: "Access denied: task list does not belong to your agency" });
      }
    }

    const result = await idempotentTaskService.upsertTask(
      taskInput,
      idempotencyKey,
      agencyId
    );

    res.status(result.created ? 201 : 200).json({
      task: result.task,
      created: result.created,
      idempotencyKey: result.idempotencyKey,
      message: result.created ? "Task created" : "Task updated (upsert)",
    });
  } catch (error: any) {
    console.error("[TASKS] Error upserting task:", error);
    res.status(500).json({ error: error.message });
  }
});

taskRouter.post("/deduplicate", async (req: AuthRequest, res: Response) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ error: "Agency context required" });
    }

    const taskInput = req.body;
    if (!taskInput.description) {
      return res.status(400).json({ error: "Task description is required" });
    }

    const duplicates = await idempotentTaskService.findDuplicateTasks(taskInput, agencyId);

    res.json({
      duplicatesFound: duplicates.length,
      duplicates: duplicates.map(t => ({
        id: t.id,
        description: t.description,
        status: t.status,
        projectId: t.projectId,
        createdAt: t.createdAt,
        contentHash: t.contentHash,
      })),
    });
  } catch (error: any) {
    console.error("[TASKS] Error finding duplicate tasks:", error);
    res.status(500).json({ error: error.message });
  }
});

taskRouter.get("/:taskId/lineage", async (req: AuthRequest, res: Response) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ error: "Agency context required" });
    }

    const { taskId } = req.params;

    const lineage = await idempotentTaskService.getTaskLineage(taskId);

    if (!lineage) {
      return res.status(404).json({ error: "Task not found" });
    }

    if (lineage.project) {
      const belongs = await verifyProjectBelongsToAgency(lineage.project.id, agencyId);
      if (!belongs) {
        return res.status(403).json({ error: "Access denied: task does not belong to your agency" });
      }
    }

    res.json({
      taskId,
      task: {
        id: lineage.task.id,
        description: lineage.task.description,
        status: lineage.task.status,
        createdAt: lineage.task.createdAt,
        idempotencyKey: lineage.task.idempotencyKey,
        contentHash: lineage.task.contentHash,
      },
      workflowExecutionId: lineage.workflowExecutionId,
      project: lineage.project,
      client: lineage.client,
    });
  } catch (error: any) {
    console.error("[TASKS] Error getting task lineage:", error);
    res.status(500).json({ error: error.message });
  }
});
