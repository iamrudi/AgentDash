import { describe, expect, it, vi } from "vitest";

vi.mock("../server/middleware/request-context", () => ({
  getRequestContext: () => ({
    userId: "user-1",
    agencyId: "agency-a",
  }),
}));

import { GateDecisionService } from "../server/application/gates/gate-decision-service";
import { createGateDecisionHandler } from "../server/routes/opportunities";

describe("Gate decisions route", () => {
  it("calls the service layer", async () => {
    const recordDecision = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      data: { id: "gate-1" },
    });
    const service = { recordDecision } as unknown as GateDecisionService;

    const req = {
      body: {
        gateType: "opportunity",
        decision: "approve",
        targetType: "opportunity_artifact",
        targetId: "9f3e2a1e-1111-4a2d-9f3e-222222222222",
      },
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    const handler = createGateDecisionHandler(service);
    await handler(req, res);

    expect(recordDecision).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("rejects tenant mismatch with 403", async () => {
    const storage = {
      getOpportunityArtifactById: vi.fn().mockResolvedValue({
        id: "artifact-1",
        agencyId: "agency-b",
      }),
      createGateDecision: vi.fn(),
    } as any;
    const service = new GateDecisionService(storage);
    const handler = createGateDecisionHandler(service);

    const req = {
      body: {
        gateType: "opportunity",
        decision: "approve",
        targetType: "opportunity_artifact",
        targetId: "9f3e2a1e-1111-4a2d-9f3e-222222222222",
      },
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("fails closed on invalid payload", async () => {
    const storage = {} as any;
    const service = new GateDecisionService(storage);
    const handler = createGateDecisionHandler(service);

    const req = {
      body: {
        gateType: "invalid",
        decision: "approve",
        targetType: "opportunity_artifact",
        targetId: "9f3e2a1e-1111-4a2d-9f3e-222222222222",
      },
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
