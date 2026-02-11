import { describe, expect, it, vi } from "vitest";
import { IntelligenceDurationService } from "../server/application/intelligence/intelligence-duration-service";

describe("IntelligenceDurationService", () => {
  it("returns 400 when agency context is missing", async () => {
    const service = new IntelligenceDurationService({} as any, {
      predictDuration: vi.fn(),
      getModelStats: vi.fn(),
      recordTaskCompletion: vi.fn(),
    });

    const result = await service.getStats(undefined);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it("returns prediction payload", async () => {
    const predictDuration = vi.fn().mockResolvedValue({ hours: 3.5 });
    const service = new IntelligenceDurationService({} as any, {
      predictDuration,
      getModelStats: vi.fn(),
      recordTaskCompletion: vi.fn(),
    });

    const result = await service.predict("agency-1", {
      taskType: "seo",
      complexity: "medium",
      assigneeId: "staff-1",
      clientId: "client-1",
      contextSize: 12,
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ hours: 3.5 });
    expect(predictDuration).toHaveBeenCalledWith(
      "agency-1",
      "seo",
      "medium",
      "staff-1",
      "client-1",
      12
    );
  });

  it("uses default history limit and returns history", async () => {
    const storage = {
      getTaskExecutionHistoryByAgencyId: vi.fn().mockResolvedValue([{ id: "h-1" }]),
    } as any;
    const service = new IntelligenceDurationService(storage, {
      predictDuration: vi.fn(),
      getModelStats: vi.fn(),
      recordTaskCompletion: vi.fn(),
    });

    const result = await service.getHistory("agency-1", {});
    expect(result.ok).toBe(true);
    expect(storage.getTaskExecutionHistoryByAgencyId).toHaveBeenCalledWith("agency-1", {
      limit: 50,
      taskType: undefined,
      clientId: undefined,
    });
  });
});
