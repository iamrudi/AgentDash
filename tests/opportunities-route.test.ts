import { describe, expect, it, vi } from "vitest";

vi.mock("../server/middleware/request-context", () => ({
  getRequestContext: () => ({
    userId: "user-1",
    agencyId: "agency-1",
  }),
}));

vi.mock("../server/clients/client-record-signal", () => ({
  emitClientRecordUpdatedSignal: vi.fn().mockResolvedValue({
    signalId: "signal-1",
    isDuplicate: false,
    workflowsTriggered: [],
    executions: [],
  }),
}));

vi.mock("../server/middleware/supabase-auth", async () => {
  const actual = await vi.importActual("../server/middleware/supabase-auth");
  return {
    ...actual,
    verifyClientAccess: vi.fn().mockResolvedValue(true),
  };
});

import { createOpportunityHandler, createOpportunityListByClientHandler } from "../server/routes/opportunities";
import { OpportunityRecommendationRequestService } from "../server/application/opportunities/opportunity-recommendation-request-service";
import { OpportunityReadService } from "../server/application/opportunities/opportunity-read-service";

describe("Opportunities route", () => {
  it("uses the opportunity service to persist artifacts", async () => {
    const persistOpportunityArtifact = vi.fn().mockResolvedValue({
      ok: true,
      data: { id: "artifact-1" },
    });
    const service = {
      generateOpportunityArtifactFromAI: vi.fn(),
      persistOpportunityArtifact,
    } as any;

    const req = {
      body: {
        clientId: "9f3e2a1e-1111-4a2d-9f3e-222222222222",
        opportunityStatement: "Increase conversion rate",
      },
      user: { id: "user-1", role: "Admin", agencyId: "agency-1" },
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    const handler = createOpportunityHandler(service);
    await handler(req, res);

    expect(persistOpportunityArtifact).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("routes ai_generate to the workflow engine", async () => {
    const service = {
      generateOpportunityArtifactFromAI: vi.fn(),
      persistOpportunityArtifact: vi.fn(),
    } as any;
    const recommendationService = {
      requestRecommendations: vi.fn().mockResolvedValue({
        ok: true,
        status: 202,
        data: { success: true, signalId: "signal-1" },
      }),
    } as unknown as OpportunityRecommendationRequestService;

    const req = {
      body: {
        mode: "ai_generate",
        clientId: "9f3e2a1e-1111-4a2d-9f3e-222222222222",
      },
      user: { id: "user-1", role: "Admin", agencyId: "agency-1" },
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    const handler = createOpportunityHandler(service, recommendationService);
    await handler(req, res);

    expect(service.generateOpportunityArtifactFromAI).not.toHaveBeenCalled();
    expect(recommendationService.requestRecommendations).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(202);
  });

  it("delegates client artifact listing to read service", async () => {
    const listByClientId = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: [{ id: "artifact-1" }],
    });
    const service = { listByClientId } as unknown as OpportunityReadService;
    const handler = createOpportunityListByClientHandler(service);
    const req = {
      params: { clientId: "client-1" },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await handler(req, res);

    expect(listByClientId).toHaveBeenCalledWith("client-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
