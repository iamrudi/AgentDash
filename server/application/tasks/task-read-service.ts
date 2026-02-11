import type { IStorage } from "../../storage";

export interface TaskReadServiceResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class TaskReadService {
  constructor(private storage: IStorage) {}

  async listTasksByListId(listId: string): Promise<TaskReadServiceResult<unknown>> {
    const tasks = await this.storage.getTasksByListId(listId);
    return { ok: true, status: 200, data: tasks };
  }

  async listSubtasks(taskId: string): Promise<TaskReadServiceResult<unknown>> {
    const subtasks = await this.storage.getSubtasksByParentId(taskId);
    return { ok: true, status: 200, data: subtasks };
  }

  async listTaskActivities(taskId: string): Promise<TaskReadServiceResult<unknown>> {
    const activities = await this.storage.getTaskActivities(taskId);
    return { ok: true, status: 200, data: activities };
  }
}
