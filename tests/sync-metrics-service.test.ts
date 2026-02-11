import { describe, expect, it, vi } from "vitest";
import { SyncMetricsService } from "../server/application/agency-clients/sync-metrics-service";

describe("SyncMetricsService", () => {
  it("returns 404 when client does not exist", async () => {
    const storage = {
      getClientById: vi.fn().mockResolvedValue(undefined),
    } as any;

    const service = new SyncMetricsService(storage, {
      fetchGA4Data: vi.fn(),
      fetchGA4KeyEvents: vi.fn(),
      fetchGSCData: vi.fn(),
    });

    const result = await service.syncClientMetrics("client-1", 30);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe("Client not found");
  });

  it("returns 400 when no analytics integrations are connected", async () => {
    const storage = {
      getClientById: vi.fn().mockResolvedValue({ id: "client-1" }),
      getIntegrationByClientId: vi.fn().mockResolvedValue(undefined),
    } as any;

    const service = new SyncMetricsService(storage, {
      fetchGA4Data: vi.fn(),
      fetchGA4KeyEvents: vi.fn(),
      fetchGSCData: vi.fn(),
    });

    const result = await service.syncClientMetrics("client-1", 30);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toBe("No analytics integrations connected");
  });

  it("syncs GA4 and GSC metrics and returns created count", async () => {
    const fetchGA4Data = vi.fn().mockResolvedValue({
      rows: [
        { dimensionValues: [{ value: "2026-01-10" }], metricValues: [{ value: "10" }] },
      ],
    });
    const fetchGA4KeyEvents = vi.fn().mockResolvedValue({
      rows: [
        { dimensionValues: [{ value: "2026-01-10" }], metricValues: [{ value: "2" }] },
      ],
    });
    const fetchGSCData = vi.fn().mockResolvedValue({
      rows: [
        { keys: ["2026-01-10"], clicks: 5, impressions: 100, position: 3.1 },
      ],
    });

    const storage = {
      getClientById: vi.fn().mockResolvedValue({ id: "client-1", leadEvents: ["signup"] }),
      getIntegrationByClientId: vi
        .fn()
        .mockResolvedValueOnce({ id: "ga4-1", ga4PropertyId: "prop-1", accessToken: "ga4-token" })
        .mockResolvedValueOnce({ id: "gsc-1", gscSiteUrl: "https://example.com", accessToken: "gsc-token" }),
      deleteMetricsByClientIdAndDateRange: vi.fn().mockResolvedValue(undefined),
      createMetric: vi.fn().mockResolvedValue(undefined),
    } as any;

    const service = new SyncMetricsService(storage, {
      fetchGA4Data,
      fetchGA4KeyEvents,
      fetchGSCData,
    });

    const result = await service.syncClientMetrics("client-1", 7);

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data?.metricsCreated).toBe(2);
    expect(storage.deleteMetricsByClientIdAndDateRange).toHaveBeenCalledTimes(1);
    expect(storage.createMetric).toHaveBeenCalledTimes(2);
    expect(storage.createMetric).toHaveBeenCalledWith(
      expect.objectContaining({ source: "GA4", conversions: 2, sessions: 10 })
    );
    expect(storage.createMetric).toHaveBeenCalledWith(
      expect.objectContaining({ source: "GSC", organicClicks: 5, organicImpressions: 100, avgPosition: "3.1" })
    );
  });
});
