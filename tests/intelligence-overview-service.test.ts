import { describe, expect, it, vi } from "vitest";
import { IntelligenceOverviewService } from "../server/application/intelligence/intelligence-overview-service";

describe("IntelligenceOverviewService", () => {
  it("returns 400 when agency context is missing", async () => {
    const service = new IntelligenceOverviewService({} as any);
    const result = await service.getOverview(undefined);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toBe("Agency context required");
  });

  it("returns summarized overview payload", async () => {
    const storage = {
      getIntelligenceSignalsByAgencyId: vi.fn().mockResolvedValue(Array.from({ length: 12 }, (_, i) => ({ id: `s-${i}` }))),
      getOpenIntelligenceInsights: vi.fn().mockResolvedValue(Array.from({ length: 7 }, (_, i) => ({ id: `i-${i}` }))),
      getPendingIntelligencePriorities: vi.fn().mockResolvedValue(Array.from({ length: 9 }, (_, i) => ({ id: `p-${i}` }))),
    } as any;
    const service = new IntelligenceOverviewService(storage);

    const result = await service.getOverview("agency-1");
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({
      unprocessedSignalsCount: 12,
      openInsightsCount: 7,
      pendingPrioritiesCount: 9,
      recentSignals: Array.from({ length: 10 }, (_, i) => ({ id: `s-${i}` })),
      topInsights: Array.from({ length: 5 }, (_, i) => ({ id: `i-${i}` })),
      topPriorities: Array.from({ length: 5 }, (_, i) => ({ id: `p-${i}` })),
    });
  });
});
