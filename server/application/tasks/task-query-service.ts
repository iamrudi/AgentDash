import type { IStorage } from "../../storage";

export interface TaskQueryServiceResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

interface TaskQueryPrincipal {
  agencyId?: string;
  isSuperAdmin?: boolean;
}

export class TaskQueryService {
  constructor(private storage: IStorage) {}

  async listTasksWithProject(
    principal: TaskQueryPrincipal
  ): Promise<TaskQueryServiceResult<unknown>> {
    const agencyScope = this.resolveAgencyScope(principal);
    if (!agencyScope.ok) {
      return agencyScope;
    }

    const tasks = await this.storage.getAllTasks(agencyScope.data);
    const tasksWithProject = await Promise.all(
      tasks.map(async (task: any) => {
        const project = task.projectId ? await this.storage.getProjectById(task.projectId) : null;
        return { ...task, project };
      })
    );

    return { ok: true, status: 200, data: tasksWithProject };
  }

  async listStaffAssignments(
    principal: TaskQueryPrincipal
  ): Promise<TaskQueryServiceResult<unknown>> {
    const agencyScope = this.resolveAgencyScope(principal);
    if (!agencyScope.ok) {
      return agencyScope;
    }

    const assignments = await this.storage.getAllTaskAssignments(agencyScope.data);
    return { ok: true, status: 200, data: assignments };
  }

  private resolveAgencyScope(principal: TaskQueryPrincipal): TaskQueryServiceResult<string | undefined> {
    if (principal.isSuperAdmin) {
      return { ok: true, status: 200, data: undefined };
    }
    if (!principal.agencyId) {
      return { ok: false, status: 403, error: "Agency association required" };
    }
    return { ok: true, status: 200, data: principal.agencyId };
  }
}
