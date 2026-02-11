import { AnalyticsGa4ReadService } from "../analytics/analytics-ga4-read-service";
import { AnalyticsGscReadService } from "../analytics/analytics-gsc-read-service";
import { OutcomeMetricsService } from "../analytics/outcome-metrics-service";

type CacheLike = {
  get: (key: string) => any;
  set: (key: string, value: any, ttl?: number) => void;
};

export interface DashboardSummaryResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

function resolveDateRange(startDate?: string, endDate?: string): { start: string; end: string } {
  const end = endDate || new Date().toISOString().split("T")[0];
  const start =
    startDate ||
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  return { start, end };
}

export class DashboardSummaryService {
  constructor(
    private readonly ga4ReadService: AnalyticsGa4ReadService,
    private readonly gscReadService: AnalyticsGscReadService,
    private readonly outcomeMetricsService: OutcomeMetricsService,
    private readonly cache: CacheLike,
    private readonly ttlOneHour: number
  ) {}

  async getDashboardSummary(params: {
    userId: string;
    clientId: string;
    startDate?: string;
    endDate?: string;
  }): Promise<DashboardSummaryResult<unknown>> {
    const { start, end } = resolveDateRange(params.startDate, params.endDate);
    const cacheKey = `dashboard-summary:${params.clientId}:${start}:${end}`;
    const cachedData = this.cache.get(cacheKey);

    if (cachedData) {
      return { ok: true, status: 200, data: { ...cachedData, cached: true } };
    }

    const [ga4Result, gscResult, gscQueriesResult, outcomeMetricsResult] = await Promise.allSettled([
      this.ga4ReadService.getAnalytics({
        clientId: params.clientId,
        startDate: start,
        endDate: end,
      }),
      this.gscReadService.getAnalytics({
        clientId: params.clientId,
        startDate: start,
        endDate: end,
      }),
      this.gscReadService.getQueries({
        userId: params.userId,
        clientId: params.clientId,
        startDate: start,
        endDate: end,
      }),
      this.outcomeMetricsService.getOutcomeMetrics({
        userId: params.userId,
        clientId: params.clientId,
        startDate: start,
        endDate: end,
      }),
    ]);

    const aggregatedData = {
      ga4:
        ga4Result.status === "fulfilled" && ga4Result.value.ok
          ? ga4Result.value.data
          : { rows: [], rowCount: 0, totals: [] },
      gsc:
        gscResult.status === "fulfilled" && gscResult.value.ok
          ? gscResult.value.data
          : { rows: [] },
      gscQueries:
        gscQueriesResult.status === "fulfilled" && gscQueriesResult.value.ok
          ? gscQueriesResult.value.data
          : { rows: [] },
      outcomeMetrics:
        outcomeMetricsResult.status === "fulfilled" && outcomeMetricsResult.value.ok
          ? outcomeMetricsResult.value.data
          : {
              conversions: 0,
              estimatedPipelineValue: 0,
              cpa: 0,
              organicClicks: 0,
              spend: 0,
            },
    };

    this.cache.set(cacheKey, aggregatedData, this.ttlOneHour);
    return { ok: true, status: 200, data: { ...aggregatedData, cached: false } };
  }
}
