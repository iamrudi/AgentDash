import { describe, expect, it, vi } from "vitest";
import { IntelligencePipelineService } from "../server/application/intelligence/intelligence-pipeline-service";

describe("IntelligencePipelineService", () => {
  it("returns 400 when agency context is missing", async () => {
    const service = new IntelligencePipelineService({
      processSignals: vi.fn(),
      processInsights: vi.fn(),
    });

    const result = await service.processSignals(undefined);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toBe("Agency context required");
  });

  it("returns process-signals completion payload", async () => {
    const processSignals = vi.fn().mockResolvedValue({ processed: 11, insightsCreated: 3 });
    const service = new IntelligencePipelineService({
      processSignals,
      processInsights: vi.fn(),
    });

    const result = await service.processSignals("agency-1");
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({
      message: "Signal processing completed",
      processed: 11,
      insightsCreated: 3,
    });
  });

  it("returns run-pipeline completion payload", async () => {
    const processSignals = vi.fn().mockResolvedValue({ processed: 9, insightsCreated: 2 });
    const processInsights = vi.fn().mockResolvedValue({ prioritiesCreated: 4 });
    const service = new IntelligencePipelineService({
      processSignals,
      processInsights,
    });

    const result = await service.runPipeline("agency-1");
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({
      message: "Intelligence pipeline completed",
      signalsProcessed: 9,
      insightsCreated: 2,
      prioritiesCreated: 4,
    });
  });
});
