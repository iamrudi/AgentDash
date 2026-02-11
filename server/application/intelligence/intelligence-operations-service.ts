import type { IStorage } from "../../storage";

export interface IntelligenceOperationsResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

type ResourceOptimizerDeps = {
  getCapacityHeatmap: (agencyId: string, startDate: Date, endDate: Date) => Promise<unknown>;
};

type CommercialImpactDeps = {
  calculateImpactScore: (agencyId: string, payload: any) => Promise<unknown>;
  getTopPrioritizedTasks: (agencyId: string, limit: number) => Promise<unknown>;
  getAgencyFactors: (agencyId: string) => Promise<unknown>;
  updateAgencyFactors: (agencyId: string, payload: any) => Promise<unknown>;
  batchCalculateImpactScores: (agencyId: string, tasks: any[]) => Promise<Map<string, unknown>>;
};

type DurationIntegrationDeps = {
  checkSLARisks: (agencyId: string, tasksWithPredictions: any[]) => Promise<unknown>;
  enrichTasksWithIntelligence: (agencyId: string, tasks: any[]) => Promise<unknown>;
  generateResourcePlanWithIntelligence: (
    agencyId: string,
    tasks: any[],
    startDate: Date,
    endDate: Date
  ) => Promise<unknown>;
  predictAndSignal: (agencyId: string, task: any, params: any) => Promise<unknown>;
};

type OutcomeFeedbackDeps = {
  captureOutcome: (payload: any) => Promise<unknown>;
  updateOutcome: (id: string, payload: any) => Promise<unknown>;
  getQualityDashboard: (
    agencyId: string,
    params: { clientId?: string; periods?: number }
  ) => Promise<unknown>;
};

type IntelligenceOperationsDeps = {
  resourceOptimizerService: ResourceOptimizerDeps;
  commercialImpactService: CommercialImpactDeps;
  durationIntelligenceIntegration: DurationIntegrationDeps;
  outcomeFeedbackService: OutcomeFeedbackDeps;
};

export class IntelligenceOperationsService {
  constructor(
    private readonly storage: IStorage,
    private readonly deps: IntelligenceOperationsDeps
  ) {}

  private requireAgency(agencyId?: string): IntelligenceOperationsResult<never> | null {
    if (!agencyId) {
      return { ok: false, status: 400, error: "Agency context required" };
    }
    return null;
  }

  async listAllocationPlans(
    agencyId: string | undefined,
    query: { status?: string; limit?: string }
  ): Promise<IntelligenceOperationsResult<unknown>> {
    const missing = this.requireAgency(agencyId);
    if (missing) return missing;
    const limit = parseInt(query.limit || "") || 20;
    const plans = await this.storage.getResourceAllocationPlansByAgencyId(agencyId!, {
      status: query.status,
      limit,
    });
    return { ok: true, status: 200, data: plans };
  }

  async getAllocationPlan(id: string): Promise<IntelligenceOperationsResult<unknown>> {
    const plan = await this.storage.getResourceAllocationPlanById(id);
    if (!plan) return { ok: false, status: 404, error: "Allocation plan not found" };
    return { ok: true, status: 200, data: plan };
  }

  async updateAllocationPlanStatus(
    id: string,
    status?: string
  ): Promise<IntelligenceOperationsResult<unknown>> {
    const validStatuses = ["draft", "approved", "active", "completed", "archived"];
    if (!status || !validStatuses.includes(status)) {
      return { ok: false, status: 400, error: "Invalid status" };
    }
    const plan = await this.storage.updateResourceAllocationPlan(id, { status });
    return { ok: true, status: 200, data: plan };
  }

  async getCapacityHeatmap(
    agencyId: string | undefined,
    query: { startDate?: string; endDate?: string }
  ): Promise<IntelligenceOperationsResult<unknown>> {
    const missing = this.requireAgency(agencyId);
    if (missing) return missing;
    const startDate = query.startDate ? new Date(query.startDate) : new Date();
    const endDate = query.endDate
      ? new Date(query.endDate)
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const heatmap = await this.deps.resourceOptimizerService.getCapacityHeatmap(
      agencyId!,
      startDate,
      endDate
    );
    return { ok: true, status: 200, data: heatmap };
  }

  async listCapacityProfiles(
    agencyId: string | undefined,
    activeOnly: boolean
  ): Promise<IntelligenceOperationsResult<unknown>> {
    const missing = this.requireAgency(agencyId);
    if (missing) return missing;
    const profiles = await this.storage.getResourceCapacityProfilesByAgencyId(agencyId!, { activeOnly });
    return { ok: true, status: 200, data: profiles };
  }

  async createCapacityProfile(
    agencyId: string | undefined,
    payload: any
  ): Promise<IntelligenceOperationsResult<unknown>> {
    const missing = this.requireAgency(agencyId);
    if (missing) return missing;
    const profile = await this.storage.createResourceCapacityProfile({ ...payload, agencyId });
    return { ok: true, status: 200, data: profile };
  }

  async updateCapacityProfile(id: string, payload: any): Promise<IntelligenceOperationsResult<unknown>> {
    const profile = await this.storage.updateResourceCapacityProfile(id, payload);
    return { ok: true, status: 200, data: profile };
  }

  async calculateCommercialImpact(
    agencyId: string | undefined,
    payload: any
  ): Promise<IntelligenceOperationsResult<unknown>> {
    const missing = this.requireAgency(agencyId);
    if (missing) return missing;
    const result = await this.deps.commercialImpactService.calculateImpactScore(agencyId!, payload);
    return { ok: true, status: 200, data: result };
  }

  async getCommercialTopPriorities(
    agencyId: string | undefined,
    limitRaw?: string
  ): Promise<IntelligenceOperationsResult<unknown>> {
    const missing = this.requireAgency(agencyId);
    if (missing) return missing;
    const limit = parseInt(limitRaw || "") || 20;
    const priorities = await this.deps.commercialImpactService.getTopPrioritizedTasks(agencyId!, limit);
    return { ok: true, status: 200, data: priorities };
  }

  async getCommercialFactors(agencyId: string | undefined): Promise<IntelligenceOperationsResult<unknown>> {
    const missing = this.requireAgency(agencyId);
    if (missing) return missing;
    const factors = await this.deps.commercialImpactService.getAgencyFactors(agencyId!);
    return { ok: true, status: 200, data: factors };
  }

  async updateCommercialFactors(
    agencyId: string | undefined,
    payload: any
  ): Promise<IntelligenceOperationsResult<unknown>> {
    const missing = this.requireAgency(agencyId);
    if (missing) return missing;
    const factors = await this.deps.commercialImpactService.updateAgencyFactors(agencyId!, payload);
    return { ok: true, status: 200, data: factors };
  }

  async batchCalculateCommercialImpact(
    agencyId: string | undefined,
    tasks: any[]
  ): Promise<IntelligenceOperationsResult<unknown>> {
    const missing = this.requireAgency(agencyId);
    if (missing) return missing;
    const results = await this.deps.commercialImpactService.batchCalculateImpactScores(agencyId!, tasks);
    const resultObj: Record<string, unknown> = {};
    results.forEach((value, key) => {
      resultObj[key] = value;
    });
    return { ok: true, status: 200, data: resultObj };
  }

  async checkSlaRisks(
    agencyId: string | undefined,
    tasksWithPredictions: any[]
  ): Promise<IntelligenceOperationsResult<unknown>> {
    const missing = this.requireAgency(agencyId);
    if (missing) return missing;
    const risks = await this.deps.durationIntelligenceIntegration.checkSLARisks(
      agencyId!,
      tasksWithPredictions
    );
    return { ok: true, status: 200, data: risks };
  }

  async enrichTasks(
    agencyId: string | undefined,
    taskIds: string[]
  ): Promise<IntelligenceOperationsResult<unknown>> {
    const missing = this.requireAgency(agencyId);
    if (missing) return missing;
    const tasks = [];
    for (const taskId of taskIds || []) {
      const task = await this.storage.getTaskById(taskId);
      if (task) tasks.push(task);
    }
    const enrichedTasks = await this.deps.durationIntelligenceIntegration.enrichTasksWithIntelligence(
      agencyId!,
      tasks
    );
    return { ok: true, status: 200, data: enrichedTasks };
  }

  async generateIntelligentPlan(
    agencyId: string | undefined,
    payload: { taskIds: string[]; startDate: string; endDate: string }
  ): Promise<IntelligenceOperationsResult<unknown>> {
    const missing = this.requireAgency(agencyId);
    if (missing) return missing;
    const tasks = [];
    for (const taskId of payload.taskIds || []) {
      const task = await this.storage.getTaskById(taskId);
      if (task) tasks.push(task);
    }
    const result = await this.deps.durationIntelligenceIntegration.generateResourcePlanWithIntelligence(
      agencyId!,
      tasks,
      new Date(payload.startDate),
      new Date(payload.endDate)
    );
    return { ok: true, status: 200, data: result };
  }

  async predictAndSignal(
    agencyId: string | undefined,
    payload: { taskId: string; taskType?: string; complexity?: string; channel?: string }
  ): Promise<IntelligenceOperationsResult<unknown>> {
    const missing = this.requireAgency(agencyId);
    if (missing) return missing;
    const task = await this.storage.getTaskById(payload.taskId);
    if (!task) return { ok: false, status: 404, error: "Task not found" };
    const result = await this.deps.durationIntelligenceIntegration.predictAndSignal(agencyId!, task, {
      taskType: payload.taskType || "general",
      complexity: payload.complexity || "medium",
      channel: payload.channel,
    });
    return { ok: true, status: 200, data: result };
  }

  async captureOutcome(
    agencyId: string | undefined,
    payload: any
  ): Promise<IntelligenceOperationsResult<unknown>> {
    const missing = this.requireAgency(agencyId);
    if (missing) return missing;
    const outcome = await this.deps.outcomeFeedbackService.captureOutcome({
      ...payload,
      agencyId,
    });
    return { ok: true, status: 200, data: outcome };
  }

  async updateOutcome(id: string, payload: any): Promise<IntelligenceOperationsResult<unknown>> {
    const outcome = await this.deps.outcomeFeedbackService.updateOutcome(id, payload);
    if (!outcome) return { ok: false, status: 404, error: "Outcome not found" };
    return { ok: true, status: 200, data: outcome };
  }

  async getQualityDashboard(
    agencyId: string | undefined,
    query: { clientId?: string; periods?: string }
  ): Promise<IntelligenceOperationsResult<unknown>> {
    const missing = this.requireAgency(agencyId);
    if (missing) return missing;
    const dashboard = await this.deps.outcomeFeedbackService.getQualityDashboard(agencyId!, {
      clientId: query.clientId,
      periods: query.periods ? parseInt(query.periods) : undefined,
    });
    return { ok: true, status: 200, data: dashboard };
  }

  async getCalibration(
    agencyId: string | undefined,
    clientId?: string
  ): Promise<IntelligenceOperationsResult<unknown>> {
    const missing = this.requireAgency(agencyId);
    if (missing) return missing;
    const params = await this.storage.getAiCalibrationParameters(agencyId!, clientId);
    return { ok: true, status: 200, data: params };
  }

  async upsertCalibration(
    agencyId: string | undefined,
    payload: any
  ): Promise<IntelligenceOperationsResult<unknown>> {
    const missing = this.requireAgency(agencyId);
    if (missing) return missing;
    const param = await this.storage.upsertAiCalibrationParameter({
      ...payload,
      agencyId,
    });
    return { ok: true, status: 200, data: param };
  }
}
