import type { IStorage } from "../../storage";

export interface ClientWorkspaceResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class ClientWorkspaceService {
  constructor(private readonly storage: IStorage) {}

  private async resolveClient(userId: string) {
    const profile = await this.storage.getProfileByUserId(userId);
    if (!profile) {
      return undefined;
    }
    return this.storage.getClientByProfileId(profile.id);
  }

  async recentTasks(userId: string): Promise<ClientWorkspaceResult<unknown>> {
    const client = await this.resolveClient(userId);
    if (!client) {
      return { ok: true, status: 200, data: [] };
    }

    const projects = await this.storage.getProjectsByClientId(client.id);
    if (projects.length === 0) {
      return { ok: true, status: 200, data: [] };
    }

    const allTasks = await Promise.all(
      projects.map(async (project) => {
        const projectWithTasks = await this.storage.getProjectWithTasks(project.id);
        return (projectWithTasks?.tasks || []).map((task) => ({
          ...task,
          project: {
            id: project.id,
            name: project.name,
          },
        }));
      })
    );

    const tasks = allTasks.flat().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return { ok: true, status: 200, data: tasks.slice(0, 5) };
  }

  async projectsWithTasks(userId: string): Promise<ClientWorkspaceResult<unknown>> {
    const client = await this.resolveClient(userId);
    if (!client) {
      return { ok: true, status: 200, data: [] };
    }

    const projects = await this.storage.getProjectsByClientId(client.id);
    const projectsWithTasks = await Promise.all(
      projects.map(async (project) => {
        const projectData = await this.storage.getProjectWithTasks(project.id);
        const tasks = projectData?.tasks || [];
        return {
          ...project,
          tasks,
          taskStats: {
            total: tasks.length,
            completed: tasks.filter((t) => t.status === "Completed").length,
            inProgress: tasks.filter((t) => t.status === "In Progress").length,
            pending: tasks.filter((t) => t.status === "Pending").length,
          },
        };
      })
    );

    return { ok: true, status: 200, data: projectsWithTasks };
  }

  async objectives(userId: string): Promise<ClientWorkspaceResult<unknown>> {
    const client = await this.resolveClient(userId);
    if (!client) {
      return { ok: true, status: 200, data: [] };
    }

    const objectives = await this.storage.getActiveObjectivesByClientId(client.id);
    return { ok: true, status: 200, data: objectives };
  }

  async messages(userId: string): Promise<ClientWorkspaceResult<unknown>> {
    const client = await this.resolveClient(userId);
    if (!client) {
      return { ok: true, status: 200, data: [] };
    }

    const messages = await this.storage.getMessagesByClientId(client.id);
    return { ok: true, status: 200, data: messages };
  }
}
