import { describe, expect, it, vi } from "vitest";
import { SuperadminRecommendationService } from "../server/application/superadmin/superadmin-recommendation-service";

describe("SuperadminRecommendationService", () => {
  it("returns 400 on invalid payload", async () => {
    const service = new SuperadminRecommendationService({} as any, vi.fn() as any);
    const result = await service.requestRecommendations({ userId: "super-1" } as any, "client-1", {
      preset: "bad-preset",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it("returns 404 when client is missing", async () => {
    const storage = {
      getClientById: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new SuperadminRecommendationService(storage, vi.fn() as any);
    const result = await service.requestRecommendations(
      { userId: "super-1" } as any,
      "client-1",
      { preset: "quick-wins", includeCompetitors: false }
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe("Client not found");
  });

  it("emits signal and returns audit payload", async () => {
    const storage = {
      getClientById: vi.fn().mockResolvedValue({
        id: "client-1",
        agencyId: "agency-1",
        companyName: "Client One",
      }),
    } as any;
    const emitSignal = vi.fn().mockResolvedValue({
      signalId: "signal-1",
      isDuplicate: false,
      workflowsTriggered: ["wf-1", "wf-2"],
      executions: ["exec-1"],
    });
    const service = new SuperadminRecommendationService(storage, emitSignal);

    const result = await service.requestRecommendations(
      { userId: "super-1" } as any,
      "client-1",
      { preset: "full-audit", includeCompetitors: true, competitorDomains: ["a.com"] }
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe(202);
    expect(emitSignal).toHaveBeenCalledTimes(1);
    expect(result.auditEvent?.action).toBe("recommendations.generate");
    expect(result.data).toEqual(expect.objectContaining({ success: true, signalId: "signal-1" }));
  });
});
