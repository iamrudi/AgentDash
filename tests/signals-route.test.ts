import { describe, expect, it, vi } from "vitest";
import { SignalService } from "../server/application/signals/signal-service";
import {
  createSignalIngestHandler,
  createSignalSourcesHandler,
  createSignalPendingHandler,
  createSignalFailedHandler,
  createSignalRetryHandler,
  createSignalGetHandler,
  createSignalRoutesListHandler,
  createSignalRouteGetHandler,
  createSignalRouteCreateHandler,
  createSignalRouteUpdateHandler,
  createSignalRouteDeleteHandler,
} from "../server/routes/signals";

describe("Signals route handlers", () => {
  it("delegates ingest", async () => {
    const ingest = vi.fn().mockResolvedValue({ ok: true, status: 201, data: { signal: { id: "s1" } } });
    const service = { ingest } as unknown as SignalService;
    const handler = createSignalIngestHandler(service);
    const req = { user: { agencyId: "agency-1" }, params: { source: "manual" }, body: { data: {}, clientId: "client-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() };

    await handler(req, res);

    expect(ingest).toHaveBeenCalledWith({ agencyId: "agency-1", source: "manual", data: {}, clientId: "client-1" });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("delegates supported sources", async () => {
    const supportedSources = vi.fn().mockReturnValue({ ok: true, status: 200, data: { sources: ["manual"] } });
    const service = { supportedSources } as unknown as SignalService;
    const handler = createSignalSourcesHandler(service);
    const req = {} as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(supportedSources).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates pending signals", async () => {
    const pendingSignals = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { pendingSignals } as unknown as SignalService;
    const handler = createSignalPendingHandler(service);
    const req = { user: { agencyId: "agency-1" }, query: { limit: "10" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(pendingSignals).toHaveBeenCalledWith("agency-1", "10");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates failed signals", async () => {
    const failedSignals = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { failedSignals } as unknown as SignalService;
    const handler = createSignalFailedHandler(service);
    const req = { user: { agencyId: "agency-1" }, query: { limit: "10" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(failedSignals).toHaveBeenCalledWith("agency-1", "10");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates signal retry", async () => {
    const retrySignal = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { id: "s1" } });
    const service = { retrySignal } as unknown as SignalService;
    const handler = createSignalRetryHandler(service);
    const req = { params: { id: "s1" }, user: { agencyId: "agency-1", isSuperAdmin: false } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(retrySignal).toHaveBeenCalledWith("s1", { agencyId: "agency-1", isSuperAdmin: false });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates signal get", async () => {
    const getSignal = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { id: "s1" } });
    const service = { getSignal } as unknown as SignalService;
    const handler = createSignalGetHandler(service);
    const req = { params: { id: "s1" }, user: { agencyId: "agency-1", isSuperAdmin: false } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(getSignal).toHaveBeenCalledWith("s1", { agencyId: "agency-1", isSuperAdmin: false });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates routes list", async () => {
    const listRoutes = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { listRoutes } as unknown as SignalService;
    const handler = createSignalRoutesListHandler(service);
    const req = { user: { agencyId: "agency-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(listRoutes).toHaveBeenCalledWith("agency-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates route get", async () => {
    const getRoute = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { id: "r1" } });
    const service = { getRoute } as unknown as SignalService;
    const handler = createSignalRouteGetHandler(service);
    const req = { params: { id: "r1" }, user: { agencyId: "agency-1", isSuperAdmin: false } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(getRoute).toHaveBeenCalledWith("r1", { agencyId: "agency-1", isSuperAdmin: false });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates route create", async () => {
    const createRoute = vi.fn().mockResolvedValue({ ok: true, status: 201, data: { id: "r1" } });
    const service = { createRoute } as unknown as SignalService;
    const handler = createSignalRouteCreateHandler(service);
    const req = { user: { agencyId: "agency-1" }, body: { signalType: "x" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(createRoute).toHaveBeenCalledWith("agency-1", { signalType: "x" });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("delegates route update", async () => {
    const updateRoute = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { id: "r1" } });
    const service = { updateRoute } as unknown as SignalService;
    const handler = createSignalRouteUpdateHandler(service);
    const req = { params: { id: "r1" }, user: { agencyId: "agency-1", isSuperAdmin: false }, body: { isActive: true } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(updateRoute).toHaveBeenCalledWith("r1", { agencyId: "agency-1", isSuperAdmin: false }, { isActive: true });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates route delete", async () => {
    const deleteRoute = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    const service = { deleteRoute } as unknown as SignalService;
    const handler = createSignalRouteDeleteHandler(service);
    const req = { params: { id: "r1" }, user: { agencyId: "agency-1", isSuperAdmin: false } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() };

    await handler(req, res);

    expect(deleteRoute).toHaveBeenCalledWith("r1", { agencyId: "agency-1", isSuperAdmin: false });
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
