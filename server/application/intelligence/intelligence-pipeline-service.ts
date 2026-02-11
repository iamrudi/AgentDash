export interface IntelligencePipelineResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

type PipelineDeps = {
  processSignals: (agencyId: string) => Promise<{ processed: number; insightsCreated: number }>;
  processInsights: (agencyId: string) => Promise<{ prioritiesCreated: number }>;
};

export class IntelligencePipelineService {
  constructor(private readonly deps: PipelineDeps) {}

  async processSignals(agencyId?: string): Promise<IntelligencePipelineResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 400, error: "Agency context required" };
    }

    const result = await this.deps.processSignals(agencyId);
    return {
      ok: true,
      status: 200,
      data: {
        message: "Signal processing completed",
        ...result,
      },
    };
  }

  async computePriorities(agencyId?: string): Promise<IntelligencePipelineResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 400, error: "Agency context required" };
    }

    const result = await this.deps.processInsights(agencyId);
    return {
      ok: true,
      status: 200,
      data: {
        message: "Priority computation completed",
        ...result,
      },
    };
  }

  async runPipeline(agencyId?: string): Promise<IntelligencePipelineResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 400, error: "Agency context required" };
    }

    const signalResult = await this.deps.processSignals(agencyId);
    const priorityResult = await this.deps.processInsights(agencyId);

    return {
      ok: true,
      status: 200,
      data: {
        message: "Intelligence pipeline completed",
        signalsProcessed: signalResult.processed,
        insightsCreated: signalResult.insightsCreated,
        prioritiesCreated: priorityResult.prioritiesCreated,
      },
    };
  }
}
