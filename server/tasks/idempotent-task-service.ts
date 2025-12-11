import { db } from "../db";
import { tasks, taskLists, projects, clients, InsertTask, Task } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { createHash } from "crypto";

export interface IdempotentTaskInput {
  description: string;
  status?: string;
  startDate?: string;
  dueDate?: string;
  priority?: string;
  timeEstimate?: string;
  listId?: string;
  parentId?: string;
  projectId?: string;
  initiativeId?: string;
  workflowExecutionId?: string;
}

export interface BatchTaskInput {
  tasks: IdempotentTaskInput[];
  idempotencyPrefix?: string;
  workflowExecutionId?: string;
}

export interface TaskCreationResult {
  task: Task;
  created: boolean;
  idempotencyKey: string;
}

export interface BatchTaskResult {
  tasks: TaskCreationResult[];
  totalCreated: number;
  totalDeduplicated: number;
}

function generateContentHash(input: IdempotentTaskInput): string {
  const normalized = {
    description: input.description,
    status: input.status || 'To Do',
    priority: input.priority || 'Medium',
    listId: input.listId || null,
    projectId: input.projectId || null,
    parentId: input.parentId || null,
    dueDate: input.dueDate || null,
  };
  return createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex');
}

function generateIdempotencyKey(
  input: IdempotentTaskInput,
  prefix?: string,
  index?: number
): string {
  const base = prefix
    ? `${prefix}:${index ?? 0}:${input.description.substring(0, 50)}`
    : `${input.workflowExecutionId || 'manual'}:${input.description.substring(0, 50)}`;
  return createHash('sha256').update(base).digest('hex').substring(0, 32);
}

class IdempotentTaskService {
  async createTaskIdempotent(
    input: IdempotentTaskInput,
    idempotencyKey: string,
    agencyId: string
  ): Promise<TaskCreationResult> {
    const existing = await db
      .select()
      .from(tasks)
      .where(eq(tasks.idempotencyKey, idempotencyKey))
      .limit(1);

    if (existing.length > 0) {
      return {
        task: existing[0],
        created: false,
        idempotencyKey,
      };
    }

    const contentHash = generateContentHash(input);

    const [created] = await db
      .insert(tasks)
      .values({
        description: input.description,
        status: input.status || 'To Do',
        startDate: input.startDate,
        dueDate: input.dueDate,
        priority: input.priority || 'Medium',
        timeEstimate: input.timeEstimate || '0',
        listId: input.listId,
        parentId: input.parentId,
        projectId: input.projectId,
        initiativeId: input.initiativeId,
        workflowExecutionId: input.workflowExecutionId,
        idempotencyKey,
        contentHash,
      })
      .returning();

    return {
      task: created,
      created: true,
      idempotencyKey,
    };
  }

  async createTaskByContentHash(
    input: IdempotentTaskInput,
    agencyId: string
  ): Promise<TaskCreationResult> {
    const contentHash = generateContentHash(input);

    const existing = await db
      .select()
      .from(tasks)
      .where(eq(tasks.contentHash, contentHash))
      .limit(1);

    if (existing.length > 0) {
      return {
        task: existing[0],
        created: false,
        idempotencyKey: existing[0].idempotencyKey || contentHash,
      };
    }

    const idempotencyKey = generateIdempotencyKey(input);

    const [created] = await db
      .insert(tasks)
      .values({
        description: input.description,
        status: input.status || 'To Do',
        startDate: input.startDate,
        dueDate: input.dueDate,
        priority: input.priority || 'Medium',
        timeEstimate: input.timeEstimate || '0',
        listId: input.listId,
        parentId: input.parentId,
        projectId: input.projectId,
        initiativeId: input.initiativeId,
        workflowExecutionId: input.workflowExecutionId,
        idempotencyKey,
        contentHash,
      })
      .returning();

    return {
      task: created,
      created: true,
      idempotencyKey,
    };
  }

  async createTasksIdempotent(
    input: BatchTaskInput,
    agencyId: string
  ): Promise<BatchTaskResult> {
    const results: TaskCreationResult[] = [];
    let totalCreated = 0;
    let totalDeduplicated = 0;

    await db.transaction(async (tx) => {
      for (let i = 0; i < input.tasks.length; i++) {
        const taskInput = input.tasks[i];
        const idempotencyKey = generateIdempotencyKey(
          taskInput,
          input.idempotencyPrefix,
          i
        );

        const existing = await tx
          .select()
          .from(tasks)
          .where(eq(tasks.idempotencyKey, idempotencyKey))
          .limit(1);

        if (existing.length > 0) {
          results.push({
            task: existing[0],
            created: false,
            idempotencyKey,
          });
          totalDeduplicated++;
          continue;
        }

        const contentHash = generateContentHash(taskInput);
        const workflowExecId = taskInput.workflowExecutionId || input.workflowExecutionId;

        const [created] = await tx
          .insert(tasks)
          .values({
            description: taskInput.description,
            status: taskInput.status || 'To Do',
            startDate: taskInput.startDate,
            dueDate: taskInput.dueDate,
            priority: taskInput.priority || 'Medium',
            timeEstimate: taskInput.timeEstimate || '0',
            listId: taskInput.listId,
            parentId: taskInput.parentId,
            projectId: taskInput.projectId,
            initiativeId: taskInput.initiativeId,
            workflowExecutionId: workflowExecId,
            idempotencyKey,
            contentHash,
          })
          .returning();

        results.push({
          task: created,
          created: true,
          idempotencyKey,
        });
        totalCreated++;
      }
    });

    return {
      tasks: results,
      totalCreated,
      totalDeduplicated,
    };
  }

  async upsertTask(
    input: IdempotentTaskInput,
    idempotencyKey: string,
    agencyId: string
  ): Promise<TaskCreationResult> {
    const existing = await db
      .select()
      .from(tasks)
      .where(eq(tasks.idempotencyKey, idempotencyKey))
      .limit(1);

    const contentHash = generateContentHash(input);

    if (existing.length > 0) {
      const [updated] = await db
        .update(tasks)
        .set({
          description: input.description,
          status: input.status || existing[0].status,
          startDate: input.startDate ?? existing[0].startDate,
          dueDate: input.dueDate ?? existing[0].dueDate,
          priority: input.priority || existing[0].priority,
          timeEstimate: input.timeEstimate || existing[0].timeEstimate,
          contentHash,
        })
        .where(eq(tasks.id, existing[0].id))
        .returning();

      return {
        task: updated,
        created: false,
        idempotencyKey,
      };
    }

    const [created] = await db
      .insert(tasks)
      .values({
        description: input.description,
        status: input.status || 'To Do',
        startDate: input.startDate,
        dueDate: input.dueDate,
        priority: input.priority || 'Medium',
        timeEstimate: input.timeEstimate || '0',
        listId: input.listId,
        parentId: input.parentId,
        projectId: input.projectId,
        initiativeId: input.initiativeId,
        workflowExecutionId: input.workflowExecutionId,
        idempotencyKey,
        contentHash,
      })
      .returning();

    return {
      task: created,
      created: true,
      idempotencyKey,
    };
  }

  async findDuplicateTasks(
    input: IdempotentTaskInput,
    agencyId: string
  ): Promise<Task[]> {
    const contentHash = generateContentHash(input);
    return db
      .select()
      .from(tasks)
      .where(eq(tasks.contentHash, contentHash));
  }

  async getTaskLineage(taskId: string): Promise<{
    task: Task;
    workflowExecutionId: string | null;
    project: { id: string; name: string } | null;
    client: { id: string; companyName: string } | null;
  } | null> {
    const result = await db
      .select({
        task: tasks,
        project: {
          id: projects.id,
          name: projects.name,
        },
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (result.length === 0) return null;

    const { task, project } = result[0];

    let client = null;
    if (project) {
      const clientResult = await db
        .select({ id: clients.id, companyName: clients.companyName })
        .from(clients)
        .innerJoin(projects, eq(projects.clientId, clients.id))
        .where(eq(projects.id, project.id))
        .limit(1);

      if (clientResult.length > 0) {
        client = clientResult[0];
      }
    }

    return {
      task,
      workflowExecutionId: task.workflowExecutionId,
      project,
      client,
    };
  }
}

export const idempotentTaskService = new IdempotentTaskService();
