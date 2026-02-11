import type { IStorage } from "../../storage";

export interface IntelligenceOverviewResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class IntelligenceOverviewService {
  constructor(private readonly storage: IStorage) {}

  async getOverview(agencyId?: string): Promise<IntelligenceOverviewResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 400, error: "Agency context required" };
    }

    const [signals, insights, priorities] = await Promise.all([
      this.storage.getIntelligenceSignalsByAgencyId(agencyId, { limit: 100, processed: false }),
      this.storage.getOpenIntelligenceInsights(agencyId),
      this.storage.getPendingIntelligencePriorities(agencyId),
    ]);

    return {
      ok: true,
      status: 200,
      data: {
        unprocessedSignalsCount: signals.length,
        openInsightsCount: insights.length,
        pendingPrioritiesCount: priorities.length,
        recentSignals: signals.slice(0, 10),
        topInsights: insights.slice(0, 5),
        topPriorities: priorities.slice(0, 5),
      },
    };
  }
}
