import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { aiExecutions as aiExecutionsTable, clients, projects, taskLists, tasks } from "@shared/schema";
import type { IStorage } from "../../storage";

export interface WorkflowExecutionsResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class WorkflowExecutionsService {
  constructor(private readonly storage: IStorage) {}

  async getExecutionEvents(
    executionId: string,
    user: { agencyId?: string; isSuperAdmin?: boolean }
  ): Promise<WorkflowExecutionsResult<unknown>> {
    const execution = await this.storage.getWorkflowExecutionById(executionId);
    if (!execution) {
      return { ok: false, status: 404, error: "Execution not found" };
    }

    const workflow = await this.storage.getWorkflowById(execution.workflowId);
    if (!workflow || (workflow.agencyId !== user.agencyId && !user.isSuperAdmin)) {
      return { ok: false, status: 403, error: "Access denied" };
    }

    const events = await this.storage.getWorkflowEventsByExecutionId(executionId);
    return { ok: true, status: 200, data: events };
  }

  async getExecutionLineage(
    executionId: string,
    user: { agencyId?: string; isSuperAdmin?: boolean }
  ): Promise<WorkflowExecutionsResult<unknown>> {
    const execution = await this.storage.getWorkflowExecutionById(executionId);
    if (!execution) {
      return { ok: false, status: 404, error: "Execution not found" };
    }

    if (execution.agencyId !== user.agencyId && !user.isSuperAdmin) {
      return { ok: false, status: 403, error: "Access denied - execution belongs to different agency" };
    }

    const workflow = await this.storage.getWorkflowById(execution.workflowId);
    if (!workflow) {
      return { ok: false, status: 404, error: "Workflow not found" };
    }
    if (workflow.agencyId !== user.agencyId && !user.isSuperAdmin) {
      return { ok: false, status: 403, error: "Access denied - workflow belongs to different agency" };
    }

    const userAgencyId = user.agencyId!;

    const createdProjects = await db
      .select()
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(and(eq((projects as any).workflowExecutionId, executionId), eq(clients.agencyId, userAgencyId)));

    const createdLists = await db
      .select()
      .from(taskLists)
      .where(and(eq((taskLists as any).workflowExecutionId, executionId), eq(taskLists.agencyId, userAgencyId)));

    const createdTasks = await db
      .select()
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(and(eq((tasks as any).workflowExecutionId, executionId), eq(clients.agencyId, userAgencyId)));

    const aiExecs = await db
      .select()
      .from(aiExecutionsTable)
      .where(and(eq(aiExecutionsTable.workflowExecutionId, executionId), eq(aiExecutionsTable.agencyId, userAgencyId)));

    let signal = null;
    if (execution.triggerId) {
      const signalData = await this.storage.getSignalById(execution.triggerId);
      if (signalData && signalData.agencyId === userAgencyId) {
        signal = signalData;
      }
    }

    const events = await this.storage.getWorkflowEventsByExecutionId(executionId);

    return {
      ok: true,
      status: 200,
      data: {
        execution,
        workflow,
        signal,
        events,
        createdEntities: {
          projects: createdProjects.map((entry: any) => entry.projects),
          taskLists: createdLists,
          tasks: createdTasks.map((entry: any) => entry.tasks),
          aiExecutions: aiExecs,
        },
      },
    };
  }
}

