import { z } from "zod";
import { insertProjectSchema } from "@shared/schema";
import type { IStorage } from "../../storage";

export interface AgencyProjectResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  errors?: unknown;
}

export interface AgencyProjectUserContext {
  agencyId?: string | null;
  isSuperAdmin?: boolean;
}

export class AgencyProjectService {
  constructor(private readonly storage: IStorage) {}

  async listProjects(user: AgencyProjectUserContext): Promise<AgencyProjectResult<unknown>> {
    if (user.isSuperAdmin) {
      const allProjects = await this.storage.getAllProjects();
      return { ok: true, status: 200, data: allProjects };
    }

    if (!user.agencyId) {
      return { ok: false, status: 403, error: "Agency association required" };
    }

    const projects = await this.storage.getAllProjects(user.agencyId);
    return { ok: true, status: 200, data: projects };
  }

  async createProject(
    user: AgencyProjectUserContext,
    payload: Record<string, unknown>
  ): Promise<AgencyProjectResult<unknown>> {
    if (!user.agencyId && !user.isSuperAdmin) {
      return { ok: false, status: 403, error: "Agency association required" };
    }

    const agencyId = user.isSuperAdmin ? payload.agencyId : user.agencyId;

    if (payload.clientId) {
      const client = await this.storage.getClientById(String(payload.clientId));
      if (!client) {
        return { ok: false, status: 404, error: "Client not found" };
      }
      if (client.agencyId !== agencyId) {
        return { ok: false, status: 403, error: "Client does not belong to your agency" };
      }
    }

    try {
      const projectData = insertProjectSchema.parse({
        ...payload,
        agencyId,
      });
      const project = await this.storage.createProject(projectData);
      return { ok: true, status: 201, data: project };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { ok: false, status: 400, error: error.errors[0]?.message ?? "Invalid project payload" };
      }
      throw error;
    }
  }

  async getProject(projectId: string): Promise<AgencyProjectResult<unknown>> {
    const project = await this.storage.getProjectWithTasks(projectId);
    if (!project) {
      return { ok: false, status: 404, error: "Project not found" };
    }
    return { ok: true, status: 200, data: project };
  }

  async updateProject(projectId: string, updates: Record<string, unknown>): Promise<AgencyProjectResult<unknown>> {
    const updated = await this.storage.updateProject(projectId, updates);
    return { ok: true, status: 200, data: updated };
  }

  async listTaskLists(projectId: string): Promise<AgencyProjectResult<unknown>> {
    const lists = await this.storage.getTaskListsByProjectId(projectId);
    return { ok: true, status: 200, data: lists };
  }
}
