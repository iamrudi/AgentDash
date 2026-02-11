interface AiExecutionRecord {
  agencyId: string;
  [key: string]: unknown;
}

type AiExecutor = {
  getExecutionById: (id: string) => Promise<AiExecutionRecord | undefined>;
  getExecutionsByWorkflow: (workflowExecutionId: string) => Promise<AiExecutionRecord[]>;
  getUsageByAgency: (agencyId: string, periodStart?: Date, periodEnd?: Date) => Promise<unknown>;
  getCacheStats: () => { size: number; keys: string[] };
  clearCache: () => void;
};

export interface AiExecutionResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class AiExecutionService {
  constructor(private readonly executor: AiExecutor) {}

  async getExecutionById(
    executionId: string,
    user: { agencyId?: string; isSuperAdmin?: boolean }
  ): Promise<AiExecutionResult<unknown>> {
    const execution = await this.executor.getExecutionById(executionId);
    if (!execution) {
      return { ok: false, status: 404, error: "AI execution not found" };
    }

    if (execution.agencyId !== user.agencyId && !user.isSuperAdmin) {
      return { ok: false, status: 403, error: "Access denied" };
    }

    return { ok: true, status: 200, data: execution };
  }

  async getExecutionsByWorkflow(
    workflowExecutionId: string,
    user: { agencyId?: string; isSuperAdmin?: boolean }
  ): Promise<AiExecutionResult<unknown>> {
    const executions = await this.executor.getExecutionsByWorkflow(workflowExecutionId);
    const filtered = executions.filter((entry) => entry.agencyId === user.agencyId || user.isSuperAdmin);

    if (executions.length > 0 && filtered.length === 0 && !user.isSuperAdmin) {
      return { ok: false, status: 403, error: "Access denied" };
    }

    return { ok: true, status: 200, data: filtered };
  }

  async getUsageByAgency(
    agencyId: string | undefined,
    params: { periodStart?: string; periodEnd?: string }
  ): Promise<AiExecutionResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 403, error: "Agency ID required" };
    }

    const usage = await this.executor.getUsageByAgency(
      agencyId,
      params.periodStart ? new Date(params.periodStart) : undefined,
      params.periodEnd ? new Date(params.periodEnd) : undefined
    );

    return { ok: true, status: 200, data: usage };
  }

  getCacheStats(): AiExecutionResult<{ size: number; keys: string[] }> {
    return { ok: true, status: 200, data: this.executor.getCacheStats() };
  }

  clearCache(): AiExecutionResult<{ message: string }> {
    this.executor.clearCache();
    return { ok: true, status: 200, data: { message: "AI cache cleared" } };
  }
}
