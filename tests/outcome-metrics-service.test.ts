import { describe, expect, it, vi } from "vitest";
import { OutcomeMetricsService } from "../server/application/analytics/outcome-metrics-service";

describe("OutcomeMetricsService", () => {
  it("returns 403 when a client user requests another client", async () => {
    const storage = {
      getProfileByUserId: vi.fn().mockResolvedValue({ id: "profile-1", role: "Client" }),
      getClientByProfileId: vi.fn().mockResolvedValue({ id: "client-own" }),
    } as any;

    const service = new OutcomeMetricsService(storage, {
      refreshAccessToken: vi.fn(),
      fetchGA4KeyEvents: vi.fn(),
      fetchGSCData: vi.fn(),
    });

    const result = await service.getOutcomeMetrics({
      userId: "user-1",
      clientId: "client-other",
      startDate: "2026-01-10",
      endDate: "2026-01-12",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toBe("Access denied");
  });

  it("returns 404 when client does not exist", async () => {
    const storage = {
      getProfileByUserId: vi.fn().mockResolvedValue({ id: "profile-1", role: "Admin" }),
      getClientById: vi.fn().mockResolvedValue(undefined),
    } as any;

    const service = new OutcomeMetricsService(storage, {
      refreshAccessToken: vi.fn(),
      fetchGA4KeyEvents: vi.fn(),
      fetchGSCData: vi.fn(),
    });

    const result = await service.getOutcomeMetrics({
      userId: "user-1",
      clientId: "client-1",
      startDate: "2026-01-10",
      endDate: "2026-01-12",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe("Client not found");
  });

  it("computes metrics from daily metrics fallback and comparison period", async () => {
    const fetchGA4KeyEvents = vi.fn();
    const fetchGSCData = vi.fn();

    const storage = {
      getProfileByUserId: vi.fn().mockResolvedValue({ id: "profile-1", role: "Admin" }),
      getClientById: vi.fn().mockResolvedValue({
        id: "client-1",
        leadValue: "100",
        leadToOpportunityRate: "0.2",
        opportunityToCloseRate: "0.3",
        averageDealSize: "5000",
      }),
      getMetricsByClientId: vi.fn().mockResolvedValue([
        { date: "2026-01-07", conversions: 1, spend: "5" },
        { date: "2026-01-08", conversions: 1, spend: "5" },
        { date: "2026-01-09", conversions: 0, spend: "10" },
        { date: "2026-01-10", conversions: 2, spend: "10" },
        { date: "2026-01-11", conversions: 3, spend: "20" },
        { date: "2026-01-12", conversions: 1, spend: "0" },
      ]),
      getIntegrationByClientId: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined),
    } as any;

    const service = new OutcomeMetricsService(storage, {
      refreshAccessToken: vi.fn(),
      fetchGA4KeyEvents,
      fetchGSCData,
    });

    const result = await service.getOutcomeMetrics({
      userId: "user-1",
      clientId: "client-1",
      startDate: "2026-01-10",
      endDate: "2026-01-12",
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({
      conversions: 6,
      estimatedPipelineValue: 600,
      cpa: 5,
      organicClicks: 0,
      spend: 30,
      leadValue: 100,
      comparisonPeriodData: {
        conversions: 2,
        estimatedPipelineValue: 200,
        cpa: 10,
        organicClicks: 0,
      },
      pipelineCalculation: {
        leadToOpportunityRate: 0.2,
        opportunityToCloseRate: 0.3,
        averageDealSize: 5000,
      },
    });
    expect(fetchGA4KeyEvents).not.toHaveBeenCalled();
    expect(fetchGSCData).not.toHaveBeenCalled();
  });
});
