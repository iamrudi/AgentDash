import { describe, expect, it, vi } from "vitest";
import { OpportunityRecommendationRequestService } from "../server/application/opportunities/opportunity-recommendation-request-service";

describe("OpportunityRecommendationRequestService", () => {
  it("returns 400 when request context is missing required ids", async () => {
    const service = new OpportunityRecommendationRequestService({} as any, vi.fn() as any);
    const result = await service.requestRecommendations(
      { agencyId: undefined, userId: "user-1" } as any,
      "client-1"
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toBe("Invalid request context");
  });

  it("emits signal and returns 202 payload", async () => {
    const emitSignal = vi.fn().mockResolvedValue({
      signalId: "signal-1",
      isDuplicate: false,
      workflowsTriggered: ["wf-1"],
      executions: ["exec-1"],
    });
    const service = new OpportunityRecommendationRequestService({} as any, emitSignal);

    const result = await service.requestRecommendations(
      { agencyId: "agency-1", userId: "user-1" } as any,
      "client-1"
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe(202);
    expect(emitSignal).toHaveBeenCalledTimes(1);
    expect(result.data).toEqual(expect.objectContaining({ success: true, signalId: "signal-1" }));
  });
});
