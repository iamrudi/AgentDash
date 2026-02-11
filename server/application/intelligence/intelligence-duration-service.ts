import type { IStorage } from "../../storage";

export interface IntelligenceDurationResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

type DurationDeps = {
  predictDuration: (
    agencyId: string,
    taskType: string,
    complexity: string,
    assigneeId: string | null,
    clientId: string | null,
    contextSize: number | null
  ) => Promise<unknown>;
  getModelStats: (agencyId: string) => Promise<unknown>;
  recordTaskCompletion: (
    agencyId: string,
    taskId: string,
    taskType: string,
    complexity: string,
    channel: string | null,
    clientId: string | null,
    projectId: string | null,
    assigneeId: string | null,
    estimatedHours: number | null,
    actualHours: number,
    aiInvolved: boolean,
    contextSize: number | null,
    urgencyTier: string | null,
    startedAt: Date | null,
    completedAt: Date
  ) => Promise<void>;
};

export class IntelligenceDurationService {
  constructor(
    private readonly storage: IStorage,
    private readonly deps: DurationDeps
  ) {}

  async predict(
    agencyId: string | undefined,
    payload: {
      taskType: string;
      complexity: string;
      assigneeId?: string;
      clientId?: string;
      contextSize?: number;
    }
  ): Promise<IntelligenceDurationResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 400, error: "Agency context required" };
    }

    const prediction = await this.deps.predictDuration(
      agencyId,
      payload.taskType,
      payload.complexity,
      payload.assigneeId || null,
      payload.clientId || null,
      payload.contextSize || null
    );

    return { ok: true, status: 200, data: prediction };
  }

  async getStats(agencyId: string | undefined): Promise<IntelligenceDurationResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 400, error: "Agency context required" };
    }
    const stats = await this.deps.getModelStats(agencyId);
    return { ok: true, status: 200, data: stats };
  }

  async getHistory(
    agencyId: string | undefined,
    query: { limit?: string; taskType?: string; clientId?: string }
  ): Promise<IntelligenceDurationResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 400, error: "Agency context required" };
    }

    const limit = parseInt(query.limit || "") || 50;
    const history = await this.storage.getTaskExecutionHistoryByAgencyId(agencyId, {
      limit,
      taskType: query.taskType,
      clientId: query.clientId,
    });
    return { ok: true, status: 200, data: history };
  }

  async recordCompletion(
    agencyId: string | undefined,
    payload: {
      taskId: string;
      taskType: string;
      complexity: string;
      channel?: string;
      clientId?: string;
      projectId?: string;
      assigneeId?: string;
      estimatedHours?: number;
      actualHours: number;
      aiInvolved?: boolean;
      contextSize?: number;
      urgencyTier?: string;
      startedAt?: string;
      completedAt?: string;
    }
  ): Promise<IntelligenceDurationResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 400, error: "Agency context required" };
    }

    await this.deps.recordTaskCompletion(
      agencyId,
      payload.taskId,
      payload.taskType,
      payload.complexity,
      payload.channel || null,
      payload.clientId || null,
      payload.projectId || null,
      payload.assigneeId || null,
      payload.estimatedHours || null,
      payload.actualHours,
      payload.aiInvolved || false,
      payload.contextSize || null,
      payload.urgencyTier || null,
      payload.startedAt ? new Date(payload.startedAt) : null,
      payload.completedAt ? new Date(payload.completedAt) : new Date()
    );

    return {
      ok: true,
      status: 200,
      data: { success: true, message: "Completion recorded successfully" },
    };
  }
}
