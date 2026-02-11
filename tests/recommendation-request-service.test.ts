import { describe, expect, it, vi } from "vitest";
import { RecommendationRequestService } from "../server/application/agency-clients/recommendation-request-service";

describe("RecommendationRequestService", () => {
  it("returns 400 on invalid payload", async () => {
    const service = new RecommendationRequestService({} as any, vi.fn() as any);
    const result = await service.requestRecommendations(
      { agencyId: "agency-1", userId: "user-1" } as any,
      "client-1",
      { preset: "bad-value" }
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it("returns 400 when request context is missing required ids", async () => {
    const service = new RecommendationRequestService({} as any, vi.fn() as any);
    const result = await service.requestRecommendations(
      { agencyId: undefined, userId: "user-1" } as any,
      "client-1",
      { preset: "quick-wins", includeCompetitors: false }
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toBe("Invalid request context");
  });

  it("emits client record signal and returns 202 payload", async () => {
    const emitSignal = vi.fn().mockResolvedValue({
      signalId: "signal-1",
      isDuplicate: false,
      workflowsTriggered: 2,
      executions: [],
    });
    const service = new RecommendationRequestService({} as any, emitSignal);

    const result = await service.requestRecommendations(
      { agencyId: "agency-1", userId: "user-1" } as any,
      "client-1",
      {
        preset: "quick-wins",
        includeCompetitors: true,
        competitorDomains: ["a.com", "b.com"],
      }
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe(202);
    expect(emitSignal).toHaveBeenCalledTimes(1);
    expect(result.data).toEqual(
      expect.objectContaining({
        success: true,
        signalId: "signal-1",
      })
    );
  });
});
