import { describe, expect, it, vi } from "vitest";
import { DashboardSummaryService } from "../server/application/agency-clients/dashboard-summary-service";
import { AnalyticsGa4ReadService } from "../server/application/analytics/analytics-ga4-read-service";
import { AnalyticsGscReadService } from "../server/application/analytics/analytics-gsc-read-service";
import { OutcomeMetricsService } from "../server/application/analytics/outcome-metrics-service";

describe("DashboardSummaryService", () => {
  it("returns cached summary when cache key exists", async () => {
    const ga4ReadService = { getAnalytics: vi.fn() } as unknown as AnalyticsGa4ReadService;
    const gscReadService = { getAnalytics: vi.fn(), getQueries: vi.fn() } as unknown as AnalyticsGscReadService;
    const outcomeMetricsService = { getOutcomeMetrics: vi.fn() } as unknown as OutcomeMetricsService;
    const cache = {
      get: vi.fn().mockReturnValue({ ga4: { rows: [1] }, gsc: { rows: [] } }),
      set: vi.fn(),
    };

    const service = new DashboardSummaryService(
      ga4ReadService,
      gscReadService,
      outcomeMetricsService,
      cache,
      3600
    );

    const result = await service.getDashboardSummary({
      userId: "user-1",
      clientId: "client-1",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({
      ga4: { rows: [1] },
      gsc: { rows: [] },
      cached: true,
    });
    expect(cache.set).not.toHaveBeenCalled();
    expect((ga4ReadService as any).getAnalytics).not.toHaveBeenCalled();
  });

  it("aggregates service results with fallbacks and caches response", async () => {
    const ga4ReadService = {
      getAnalytics: vi.fn().mockResolvedValue({ ok: false, status: 404, error: "not configured" }),
    } as unknown as AnalyticsGa4ReadService;
    const gscReadService = {
      getAnalytics: vi.fn().mockResolvedValue({ ok: true, status: 200, data: { rows: [{ clicks: 3 }] } }),
      getQueries: vi.fn().mockRejectedValue(new Error("queries failed")),
    } as unknown as AnalyticsGscReadService;
    const outcomeMetricsService = {
      getOutcomeMetrics: vi.fn().mockResolvedValue({ ok: true, status: 200, data: { conversions: 7 } }),
    } as unknown as OutcomeMetricsService;
    const cache = {
      get: vi.fn().mockReturnValue(undefined),
      set: vi.fn(),
    };

    const service = new DashboardSummaryService(
      ga4ReadService,
      gscReadService,
      outcomeMetricsService,
      cache,
      3600
    );

    const result = await service.getDashboardSummary({
      userId: "user-1",
      clientId: "client-1",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({
      ga4: { rows: [], rowCount: 0, totals: [] },
      gsc: { rows: [{ clicks: 3 }] },
      gscQueries: { rows: [] },
      outcomeMetrics: { conversions: 7 },
      cached: false,
    });
    expect(cache.set).toHaveBeenCalledTimes(1);
  });
});
