import { insertTaskListSchema } from "@shared/schema";
import type { IStorage } from "../../storage";

export interface TaskListServiceResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

interface TaskListPrincipal {
  agencyId?: string;
  isSuperAdmin?: boolean;
}

export class TaskListService {
  constructor(private storage: IStorage) {}

  async createTaskList(
    principal: TaskListPrincipal,
    payload: unknown
  ): Promise<TaskListServiceResult<unknown>> {
    const input = payload as Record<string, unknown>;
    const projectId = input?.projectId;
    if (!projectId || typeof projectId !== "string") {
      return { ok: false, status: 400, error: "projectId is required" };
    }

    const projectWithAgency = await this.storage.getProjectWithAgency(projectId);
    if (!projectWithAgency) {
      return { ok: false, status: 404, error: "Project not found" };
    }

    let agencyId: string;
    if (principal.isSuperAdmin) {
      agencyId = projectWithAgency.agencyId;
    } else {
      if (!principal.agencyId) {
        return { ok: false, status: 403, error: "Agency association required" };
      }
      if (projectWithAgency.agencyId !== principal.agencyId) {
        return {
          ok: false,
          status: 403,
          error: "Cannot create task list for another agency's project",
        };
      }
      agencyId = principal.agencyId;
    }

    if (input?.agencyId && input.agencyId !== agencyId) {
      return { ok: false, status: 403, error: "Cannot specify different agencyId" };
    }

    const parsed = insertTaskListSchema.safeParse({
      ...input,
      agencyId,
    });
    if (!parsed.success) {
      return { ok: false, status: 400, error: parsed.error.errors[0]?.message ?? "Validation failed" };
    }

    const created = await this.storage.createTaskList(parsed.data);
    return { ok: true, status: 201, data: created };
  }

  async updateTaskList(
    principal: TaskListPrincipal,
    id: string,
    payload: unknown
  ): Promise<TaskListServiceResult<unknown>> {
    const agencyScope = this.resolveAgencyScope(principal);
    if (!agencyScope.ok) {
      return agencyScope;
    }

    const parsed = insertTaskListSchema.partial().safeParse(payload);
    if (!parsed.success) {
      return { ok: false, status: 400, error: parsed.error.errors[0]?.message ?? "Validation failed" };
    }

    try {
      const updated = await this.storage.updateTaskList(id, parsed.data, agencyScope.data);
      return { ok: true, status: 200, data: updated };
    } catch (error: any) {
      if (error?.message?.includes("not found or access denied")) {
        return { ok: false, status: 404, error: "Task list not found" };
      }
      throw error;
    }
  }

  async deleteTaskList(principal: TaskListPrincipal, id: string): Promise<TaskListServiceResult<undefined>> {
    const agencyScope = this.resolveAgencyScope(principal);
    if (!agencyScope.ok) {
      return agencyScope;
    }

    try {
      await this.storage.deleteTaskList(id, agencyScope.data);
      return { ok: true, status: 204 };
    } catch (error: any) {
      if (error?.message?.includes("not found or access denied")) {
        return { ok: false, status: 404, error: "Task list not found" };
      }
      throw error;
    }
  }

  private resolveAgencyScope(principal: TaskListPrincipal): TaskListServiceResult<string | undefined> {
    if (principal.isSuperAdmin) {
      return { ok: true, status: 200, data: undefined };
    }
    if (!principal.agencyId) {
      return { ok: false, status: 403, error: "Agency association required" };
    }
    return { ok: true, status: 200, data: principal.agencyId };
  }
}
