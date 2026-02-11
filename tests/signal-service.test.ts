import { describe, expect, it, vi } from "vitest";

const { ingestSignal, getPendingSignals, getFailedSignals, retrySignal } = vi.hoisted(() => ({
  ingestSignal: vi.fn(),
  getPendingSignals: vi.fn(),
  getFailedSignals: vi.fn(),
  retrySignal: vi.fn(),
}));

vi.mock("../server/workflow/signal-router", () => ({
  signalRouter: {
    ingestSignal,
    getPendingSignals,
    getFailedSignals,
    retrySignal,
  },
}));

vi.mock("../server/workflow/signal-adapters", () => ({
  SignalAdapterFactory: {
    hasAdapter: vi.fn((source: string) => source === "manual"),
    getSupportedSources: vi.fn(() => ["manual", "ga4"]),
  },
}));

import { SignalService } from "../server/application/signals/signal-service";

describe("SignalService", () => {
  it("fails closed on ingest without agency", async () => {
    const service = new SignalService({} as any);
    const result = await service.ingest({ source: "manual", data: {}, agencyId: undefined });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toBe("Agency ID required");
  });

  it("returns supported sources", () => {
    const service = new SignalService({} as any);
    const result = service.supportedSources();

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ sources: ["manual", "ga4"] });
  });

  it("prevents cross-tenant retry for non-superadmin", async () => {
    const storage = {
      getWorkflowSignalById: vi.fn().mockResolvedValue({ id: "signal-1", agencyId: "agency-2" }),
    } as any;
    const service = new SignalService(storage);

    const result = await service.retrySignal("signal-1", { agencyId: "agency-1", isSuperAdmin: false });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toBe("Access denied");
  });

  it("fails closed on invalid create route payload", async () => {
    const service = new SignalService({} as any);
    const result = await service.createRoute("agency-1", { source: "manual" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toBe("Validation failed");
  });

  it("returns 404 when deleting missing signal route", async () => {
    const storage = {
      getSignalRouteById: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new SignalService(storage);

    const result = await service.deleteRoute("route-1", { agencyId: "agency-1", isSuperAdmin: false });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe("Signal route not found");
  });
});
