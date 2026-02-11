import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { clients, projects, taskLists, tasks } from "@shared/schema";
import type { IStorage } from "../../storage";

export interface LineageResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class LineageService {
  constructor(private readonly storage: IStorage) {}

  async getTaskLineage(
    taskId: string,
    user: { agencyId?: string; isSuperAdmin?: boolean }
  ): Promise<LineageResult<unknown>> {
    const task = await this.storage.getTaskById(taskId);
    if (!task) {
      return { ok: false, status: 404, error: "Task not found" };
    }

    const taskWithProject = await db
      .select({
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
      return { ok: false, status: 404, error: "Task not found" };
    }

    const clientAgencyId = taskWithProject[0].client?.agencyId;
    if (clientAgencyId !== user.agencyId && !user.isSuperAdmin) {
      return { ok: false, status: 403, error: "Access denied" };
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
      const execution = await this.storage.getWorkflowExecutionById(taskData.workflowExecutionId);
      if (execution) {
        lineage.workflowExecution = execution;
        lineage.workflow = await this.storage.getWorkflowById(execution.workflowId);
        if (execution.triggerId) {
          lineage.signal = await this.storage.getSignalById(execution.triggerId);
        }
        lineage.events = await this.storage.getWorkflowEventsByExecutionId(execution.id);
      }
    }

    return { ok: true, status: 200, data: lineage };
  }

  async getProjectLineage(
    projectId: string,
    user: { agencyId?: string; isSuperAdmin?: boolean }
  ): Promise<LineageResult<unknown>> {
    const projectWithClient = await db
      .select({
        project: projects,
        client: clients,
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(eq(projects.id, projectId))
      .limit(1);

    if (projectWithClient.length === 0) {
      return { ok: false, status: 404, error: "Project not found" };
    }

    const clientAgencyId = projectWithClient[0].client?.agencyId;
    if (clientAgencyId !== user.agencyId && !user.isSuperAdmin) {
      return { ok: false, status: 403, error: "Access denied" };
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
      const execution = await this.storage.getWorkflowExecutionById(projectData.workflowExecutionId);
      if (execution) {
        lineage.workflowExecution = execution;
        lineage.workflow = await this.storage.getWorkflowById(execution.workflowId);
        if (execution.triggerId) {
          lineage.signal = await this.storage.getSignalById(execution.triggerId);
        }
        lineage.events = await this.storage.getWorkflowEventsByExecutionId(execution.id);
      }
    }

    if (projectData.workflowExecutionId) {
      lineage.createdTasks = await db
        .select()
        .from(tasks)
        .where(eq((tasks as any).workflowExecutionId, projectData.workflowExecutionId));
      lineage.createdLists = await db
        .select()
        .from(taskLists)
        .where(eq((taskLists as any).workflowExecutionId, projectData.workflowExecutionId));
    }

    return { ok: true, status: 200, data: lineage };
  }
}

