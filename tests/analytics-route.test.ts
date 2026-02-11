import { describe, expect, it, vi } from "vitest";
import { AnalyticsGa4ReadService } from "../server/application/analytics/analytics-ga4-read-service";
import { AnalyticsGscReadService } from "../server/application/analytics/analytics-gsc-read-service";
import { OutcomeMetricsService } from "../server/application/analytics/outcome-metrics-service";
import {
  createGa4AnalyticsHandler,
  createGa4ChannelsHandler,
  createGa4ConversionsHandler,
  createGscAnalyticsHandler,
  createGscQueriesHandler,
  createOutcomeMetricsHandler,
} from "../server/routes/analytics";

describe("Analytics route", () => {
  it("delegates outcome metrics endpoint to service", async () => {
    const getOutcomeMetrics = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { conversions: 5 },
    });
    const service = { getOutcomeMetrics } as unknown as OutcomeMetricsService;

    const req = {
      user: { id: "user-1" },
      params: { clientId: "client-1" },
      query: { startDate: "2026-01-01", endDate: "2026-01-31" },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    const handler = createOutcomeMetricsHandler(service);
    await handler(req, res);

    expect(getOutcomeMetrics).toHaveBeenCalledWith({
      userId: "user-1",
      clientId: "client-1",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ conversions: 5 });
  });

  it("returns service error status/message", async () => {
    const service = {
      getOutcomeMetrics: vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        error: "Client not found",
      }),
    } as unknown as OutcomeMetricsService;

    const req = {
      user: { id: "user-1" },
      params: { clientId: "client-1" },
      query: {},
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    const handler = createOutcomeMetricsHandler(service);
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Client not found" });
  });

  it("delegates GA4 conversions endpoint to service", async () => {
    const getConversions = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { rows: [] },
    });
    const service = { getConversions } as unknown as AnalyticsGa4ReadService;

    const req = {
      user: { id: "user-1" },
      params: { clientId: "client-1" },
      query: { startDate: "2026-01-01", endDate: "2026-01-31" },
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    const handler = createGa4ConversionsHandler(service);
    await handler(req, res);

    expect(getConversions).toHaveBeenCalledWith({
      userId: "user-1",
      clientId: "client-1",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates GA4 channels endpoint to service", async () => {
    const getChannels = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { rows: [] },
    });
    const service = { getChannels } as unknown as AnalyticsGa4ReadService;

    const req = {
      user: { id: "user-1" },
      params: { clientId: "client-1" },
      query: {},
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    const handler = createGa4ChannelsHandler(service);
    await handler(req, res);

    expect(getChannels).toHaveBeenCalledWith({
      userId: "user-1",
      clientId: "client-1",
      startDate: undefined,
      endDate: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates GA4 analytics endpoint to service", async () => {
    const getAnalytics = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { rows: [] },
    });
    const service = { getAnalytics } as unknown as AnalyticsGa4ReadService;

    const req = {
      params: { clientId: "client-1" },
      query: {},
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    const handler = createGa4AnalyticsHandler(service);
    await handler(req, res);

    expect(getAnalytics).toHaveBeenCalledWith({
      clientId: "client-1",
      startDate: undefined,
      endDate: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates GSC queries endpoint to service", async () => {
    const getQueries = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { rows: [] },
    });
    const service = { getQueries } as unknown as AnalyticsGscReadService;

    const req = {
      user: { id: "user-1" },
      params: { clientId: "client-1" },
      query: {},
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    const handler = createGscQueriesHandler(service);
    await handler(req, res);

    expect(getQueries).toHaveBeenCalledWith({
      userId: "user-1",
      clientId: "client-1",
      startDate: undefined,
      endDate: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates GSC analytics endpoint to service", async () => {
    const getAnalytics = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { rows: [] },
    });
    const service = { getAnalytics } as unknown as AnalyticsGscReadService;

    const req = {
      params: { clientId: "client-1" },
      query: {},
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    const handler = createGscAnalyticsHandler(service);
    await handler(req, res);

    expect(getAnalytics).toHaveBeenCalledWith({
      clientId: "client-1",
      startDate: undefined,
      endDate: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
