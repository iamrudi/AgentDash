import type { IStorage } from "../../storage";

export interface IntelligenceCrudResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class IntelligenceCrudService {
  constructor(private readonly storage: IStorage) {}

  async listSignals(
    agencyId: string | undefined,
    query: { limit?: string; sourceSystem?: string; category?: string; processed?: string }
  ): Promise<IntelligenceCrudResult<unknown>> {
    if (!agencyId) return { ok: false, status: 400, error: "Agency context required" };

    const signals = await this.storage.getIntelligenceSignalsByAgencyId(agencyId, {
      limit: query.limit ? parseInt(query.limit) : undefined,
      sourceSystem: query.sourceSystem,
      category: query.category,
      processed: query.processed ? query.processed === "true" : undefined,
    });
    return { ok: true, status: 200, data: signals };
  }

  async getSignal(agencyId: string | undefined, id: string): Promise<IntelligenceCrudResult<unknown>> {
    const signal = await this.storage.getIntelligenceSignalById(id);
    if (!signal) return { ok: false, status: 404, error: "Signal not found" };
    if (agencyId && signal.agencyId !== agencyId) return { ok: false, status: 403, error: "Access denied" };
    return { ok: true, status: 200, data: signal };
  }

  async createSignal(
    agencyId: string | undefined,
    payload: Record<string, unknown>
  ): Promise<IntelligenceCrudResult<unknown>> {
    if (!agencyId) return { ok: false, status: 400, error: "Agency context required" };
    const signal = await this.storage.createIntelligenceSignal({
      ...payload,
      agencyId,
      occurredAt: new Date((payload as any).occurredAt || Date.now()),
    } as any);
    return { ok: true, status: 201, data: signal };
  }

  async discardSignal(id: string, reason?: string): Promise<IntelligenceCrudResult<unknown>> {
    if (!reason) return { ok: false, status: 400, error: "Discard reason is required" };
    const signal = await this.storage.discardSignal(id, reason);
    return { ok: true, status: 200, data: signal };
  }

  async listInsights(
    agencyId: string | undefined,
    query: { limit?: string; status?: string; severity?: string; clientId?: string }
  ): Promise<IntelligenceCrudResult<unknown>> {
    if (!agencyId) return { ok: false, status: 400, error: "Agency context required" };
    const insights = await this.storage.getIntelligenceInsightsByAgencyId(agencyId, {
      limit: query.limit ? parseInt(query.limit) : undefined,
      status: query.status,
      severity: query.severity,
      clientId: query.clientId,
    });
    return { ok: true, status: 200, data: insights };
  }

  async getInsight(agencyId: string | undefined, id: string): Promise<IntelligenceCrudResult<unknown>> {
    const insight = await this.storage.getIntelligenceInsightById(id);
    if (!insight) return { ok: false, status: 404, error: "Insight not found" };
    if (agencyId && insight.agencyId !== agencyId) return { ok: false, status: 403, error: "Access denied" };
    return { ok: true, status: 200, data: insight };
  }

  async createInsight(
    agencyId: string | undefined,
    payload: Record<string, unknown>
  ): Promise<IntelligenceCrudResult<unknown>> {
    if (!agencyId) return { ok: false, status: 400, error: "Agency context required" };
    const insight = await this.storage.createIntelligenceInsight({
      ...payload,
      agencyId,
    } as any);
    return { ok: true, status: 201, data: insight };
  }

  async updateInsightStatus(id: string, status?: string): Promise<IntelligenceCrudResult<unknown>> {
    if (!status) return { ok: false, status: 400, error: "Status is required" };
    const validStatuses = ["open", "prioritised", "actioned", "ignored", "invalid"];
    if (!validStatuses.includes(status)) return { ok: false, status: 400, error: "Invalid status" };
    const insight = await this.storage.updateIntelligenceInsightStatus(id, status);
    return { ok: true, status: 200, data: insight };
  }

  async getPriorityConfig(agencyId: string | undefined): Promise<IntelligenceCrudResult<unknown>> {
    if (!agencyId) return { ok: false, status: 400, error: "Agency context required" };
    const config = await this.storage.getIntelligencePriorityConfig(agencyId);
    if (!config) {
      return {
        ok: true,
        status: 200,
        data: {
          agencyId,
          wImpact: "0.4",
          wUrgency: "0.3",
          wConfidence: "0.2",
          wResource: "0.1",
        },
      };
    }
    return { ok: true, status: 200, data: config };
  }

  async updatePriorityConfig(
    agencyId: string | undefined,
    payload: { wImpact?: string; wUrgency?: string; wConfidence?: string; wResource?: string }
  ): Promise<IntelligenceCrudResult<unknown>> {
    if (!agencyId) return { ok: false, status: 400, error: "Agency context required" };
    const config = await this.storage.upsertIntelligencePriorityConfig({
      agencyId,
      wImpact: payload.wImpact || "0.4",
      wUrgency: payload.wUrgency || "0.3",
      wConfidence: payload.wConfidence || "0.2",
      wResource: payload.wResource || "0.1",
    });
    return { ok: true, status: 200, data: config };
  }

  async listPriorities(
    agencyId: string | undefined,
    query: { limit?: string; status?: string; bucket?: string }
  ): Promise<IntelligenceCrudResult<unknown>> {
    if (!agencyId) return { ok: false, status: 400, error: "Agency context required" };
    const priorities = await this.storage.getIntelligencePrioritiesByAgencyId(agencyId, {
      limit: query.limit ? parseInt(query.limit) : undefined,
      status: query.status,
      bucket: query.bucket,
    });
    return { ok: true, status: 200, data: priorities };
  }

  async getPriority(agencyId: string | undefined, id: string): Promise<IntelligenceCrudResult<unknown>> {
    const priority = await this.storage.getIntelligencePriorityById(id);
    if (!priority) return { ok: false, status: 404, error: "Priority not found" };
    if (agencyId && priority.agencyId !== agencyId) return { ok: false, status: 403, error: "Access denied" };
    return { ok: true, status: 200, data: priority };
  }

  async createPriority(
    agencyId: string | undefined,
    payload: Record<string, unknown>
  ): Promise<IntelligenceCrudResult<unknown>> {
    if (!agencyId) return { ok: false, status: 400, error: "Agency context required" };
    const priority = await this.storage.createIntelligencePriority({
      ...payload,
      agencyId,
    } as any);
    return { ok: true, status: 201, data: priority };
  }

  async updatePriorityStatus(id: string, status?: string): Promise<IntelligenceCrudResult<unknown>> {
    if (!status) return { ok: false, status: 400, error: "Status is required" };
    const validStatuses = ["pending", "in_progress", "done", "dismissed"];
    if (!validStatuses.includes(status)) return { ok: false, status: 400, error: "Invalid status" };
    const priority = await this.storage.updateIntelligencePriorityStatus(id, status);
    return { ok: true, status: 200, data: priority };
  }

  async listFeedback(
    agencyId: string | undefined,
    query: { limit?: string; insightId?: string }
  ): Promise<IntelligenceCrudResult<unknown>> {
    if (!agencyId) return { ok: false, status: 400, error: "Agency context required" };
    const feedback = await this.storage.getIntelligenceFeedbackByAgencyId(agencyId, {
      limit: query.limit ? parseInt(query.limit) : undefined,
      insightId: query.insightId,
    });
    return { ok: true, status: 200, data: feedback };
  }

  async getFeedback(agencyId: string | undefined, id: string): Promise<IntelligenceCrudResult<unknown>> {
    const feedback = await this.storage.getIntelligenceFeedbackById(id);
    if (!feedback) return { ok: false, status: 404, error: "Feedback not found" };
    if (agencyId && feedback.agencyId !== agencyId) return { ok: false, status: 403, error: "Access denied" };
    return { ok: true, status: 200, data: feedback };
  }

  async createFeedback(
    agencyId: string | undefined,
    userId: string | undefined,
    payload: Record<string, unknown>
  ): Promise<IntelligenceCrudResult<unknown>> {
    if (!agencyId) return { ok: false, status: 400, error: "Agency context required" };
    const feedback = await this.storage.createIntelligenceFeedback({
      ...payload,
      agencyId,
      createdByUserId: userId,
    } as any);
    return { ok: true, status: 201, data: feedback };
  }
}
