import { describe, expect, it, vi } from "vitest";

vi.mock("../server/middleware/request-context", () => ({
  getRequestContext: () => ({
    userId: "user-1",
    email: "admin@example.com",
    role: "Admin",
    agencyId: "agency-1",
  }),
}));

import { DashboardSummaryService } from "../server/application/agency-clients/dashboard-summary-service";
import { ClientConnectionStatusService } from "../server/application/agency-clients/client-connection-status-service";
import { RecommendationRequestService } from "../server/application/agency-clients/recommendation-request-service";
import { SyncMetricsService } from "../server/application/agency-clients/sync-metrics-service";
import { StrategyCardService } from "../server/application/agency-clients/strategy-card-service";
import {
  createClientConnectionStatusHandler,
  createRecommendationRequestHandler,
  createDashboardSummaryHandler,
  createSyncMetricsHandler,
  createStrategyCardHandler,
} from "../server/routes/agency-clients";

describe("Agency clients route", () => {
  it("delegates sync-metrics endpoint to service", async () => {
    const syncClientMetrics = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { success: true, message: "done", metricsCreated: 3 },
    });
    const service = { syncClientMetrics } as unknown as SyncMetricsService;

    const req = {
      params: { clientId: "client-1" },
      body: { daysToFetch: 14 },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    const handler = createSyncMetricsHandler(service);
    await handler(req, res);

    expect(syncClientMetrics).toHaveBeenCalledWith("client-1", 14);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: "done", metricsCreated: 3 });
  });

  it("maps service error responses", async () => {
    const service = {
      syncClientMetrics: vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        error: "No analytics integrations connected",
      }),
    } as unknown as SyncMetricsService;

    const req = {
      params: { clientId: "client-1" },
      body: {},
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    const handler = createSyncMetricsHandler(service);
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "No analytics integrations connected" });
  });

  it("delegates strategy-card endpoint to service", async () => {
    const getStrategyCard = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { summaryKpis: { totalSessions: 10 } },
    });
    const service = { getStrategyCard } as unknown as StrategyCardService;

    const req = {
      params: { clientId: "client-1" },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    const handler = createStrategyCardHandler(service);
    await handler(req, res);

    expect(getStrategyCard).toHaveBeenCalledWith("client-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("maps strategy-card service errors", async () => {
    const service = {
      getStrategyCard: vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        error: "Client not found",
      }),
    } as unknown as StrategyCardService;

    const req = {
      params: { clientId: "client-1" },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    const handler = createStrategyCardHandler(service);
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Client not found" });
  });

  it("delegates dashboard-summary endpoint to service", async () => {
    const getDashboardSummary = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { ga4: { rows: [] }, cached: false },
    });
    const service = { getDashboardSummary } as unknown as DashboardSummaryService;

    const req = {
      user: { id: "user-1" },
      params: { clientId: "client-1" },
      query: { startDate: "2026-01-01", endDate: "2026-01-31" },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    const handler = createDashboardSummaryHandler(service);
    await handler(req, res);

    expect(getDashboardSummary).toHaveBeenCalledWith({
      userId: "user-1",
      clientId: "client-1",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("maps dashboard-summary service errors", async () => {
    const service = {
      getDashboardSummary: vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        error: "Access denied",
      }),
    } as unknown as DashboardSummaryService;

    const req = {
      user: { id: "user-1" },
      params: { clientId: "client-1" },
      query: {},
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    const handler = createDashboardSummaryHandler(service);
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Access denied" });
  });

  it("delegates generate-recommendations endpoint to service", async () => {
    const requestRecommendations = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      data: { success: true, signalId: "signal-1" },
    });
    const service = { requestRecommendations } as unknown as RecommendationRequestService;

    const req = {
      params: { clientId: "client-1" },
      body: { preset: "quick-wins" },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    const handler = createRecommendationRequestHandler(service);
    await handler(req, res);

    expect(requestRecommendations).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(202);
  });

  it("maps generate-recommendations service errors", async () => {
    const service = {
      requestRecommendations: vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        error: "Invalid payload",
      }),
    } as unknown as RecommendationRequestService;

    const req = {
      params: { clientId: "client-1" },
      body: {},
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    const handler = createRecommendationRequestHandler(service);
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid payload" });
  });

  it("delegates connection-status endpoint to service", async () => {
    const getConnectionStatus = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { ga4: { connected: false } },
    });
    const service = { getConnectionStatus } as unknown as ClientConnectionStatusService;

    const req = {
      params: { clientId: "client-1" },
      user: { agencyId: "agency-1" },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    const handler = createClientConnectionStatusHandler(service);
    await handler(req, res);

    expect(getConnectionStatus).toHaveBeenCalledWith({
      clientId: "client-1",
      agencyId: "agency-1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("maps connection-status service errors", async () => {
    const service = {
      getConnectionStatus: vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        error: "storage failure",
      }),
    } as unknown as ClientConnectionStatusService;

    const req = {
      params: { clientId: "client-1" },
      user: { agencyId: "agency-1" },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    const handler = createClientConnectionStatusHandler(service);
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "storage failure" });
  });
});
