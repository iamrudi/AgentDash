export interface ResourceOptimizationResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

type ResourceOptimizationDeps = {
  generateAllocationPlan: (
    agencyId: string,
    tasks: unknown[],
    startDate: Date,
    endDate: Date
  ) => Promise<unknown>;
  saveAllocationPlan: (
    agencyId: string,
    name: string,
    startDate: Date,
    endDate: Date,
    assignments: unknown[],
    objective: string,
    createdByUserId: string | null
  ) => Promise<unknown>;
};

export class ResourceOptimizationService {
  constructor(private readonly deps: ResourceOptimizationDeps) {}

  async generatePlan(
    agencyId: string | undefined,
    payload: { tasks: unknown[]; startDate: string; endDate: string }
  ): Promise<ResourceOptimizationResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 400, error: "Agency context required" };
    }

    const result = await this.deps.generateAllocationPlan(
      agencyId,
      payload.tasks,
      new Date(payload.startDate),
      new Date(payload.endDate)
    );
    return { ok: true, status: 200, data: result };
  }

  async savePlan(
    agencyId: string | undefined,
    userId: string | undefined,
    payload: {
      name: string;
      startDate: string;
      endDate: string;
      assignments: unknown[];
      objective: string;
    }
  ): Promise<ResourceOptimizationResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 400, error: "Agency context required" };
    }

    const plan = await this.deps.saveAllocationPlan(
      agencyId,
      payload.name,
      new Date(payload.startDate),
      new Date(payload.endDate),
      payload.assignments,
      payload.objective,
      userId || null
    );
    return { ok: true, status: 200, data: plan };
  }
}
