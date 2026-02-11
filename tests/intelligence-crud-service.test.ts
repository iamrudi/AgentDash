import { describe, expect, it, vi } from "vitest";
import { IntelligenceCrudService } from "../server/application/intelligence/intelligence-crud-service";

describe("IntelligenceCrudService", () => {
  it("returns 400 when listing signals without agency context", async () => {
    const service = new IntelligenceCrudService({} as any);
    const result = await service.listSignals(undefined, {});
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toBe("Agency context required");
  });

  it("returns 403 when fetching insight from another agency", async () => {
    const storage = {
      getIntelligenceInsightById: vi.fn().mockResolvedValue({ id: "ins-1", agencyId: "agency-other" }),
    } as any;
    const service = new IntelligenceCrudService(storage);

    const result = await service.getInsight("agency-1", "ins-1");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toBe("Access denied");
  });

  it("returns 400 on invalid priority status", async () => {
    const service = new IntelligenceCrudService({} as any);
    const result = await service.updatePriorityStatus("pri-1", "not-valid");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toBe("Invalid status");
  });

  it("returns default priority config when none exists", async () => {
    const storage = {
      getIntelligencePriorityConfig: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new IntelligenceCrudService(storage);

    const result = await service.getPriorityConfig("agency-1");
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({
      agencyId: "agency-1",
      wImpact: "0.4",
      wUrgency: "0.3",
      wConfidence: "0.2",
      wResource: "0.1",
    });
  });
});
