import { describe, expect, it, vi } from "vitest";
import { IntelligenceOperationsService } from "../server/application/intelligence/intelligence-operations-service";

function buildService(storage: any = {}) {
  return new IntelligenceOperationsService(storage as any, {
    resourceOptimizerService: {
      getCapacityHeatmap: vi.fn(),
    },
    commercialImpactService: {
      calculateImpactScore: vi.fn(),
      getTopPrioritizedTasks: vi.fn(),
      getAgencyFactors: vi.fn(),
      updateAgencyFactors: vi.fn(),
      batchCalculateImpactScores: vi.fn(),
    },
    durationIntelligenceIntegration: {
      checkSLARisks: vi.fn(),
      enrichTasksWithIntelligence: vi.fn(),
      generateResourcePlanWithIntelligence: vi.fn(),
      predictAndSignal: vi.fn(),
    },
    outcomeFeedbackService: {
      captureOutcome: vi.fn(),
      updateOutcome: vi.fn(),
      getQualityDashboard: vi.fn(),
    },
  });
}

describe("IntelligenceOperationsService", () => {
  it("returns 400 without agency for listAllocationPlans", async () => {
    const service = buildService();
    const result = await service.listAllocationPlans(undefined, {});
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it("returns 400 for invalid allocation plan status", async () => {
    const service = buildService();
    const result = await service.updateAllocationPlanStatus("plan-1", "bad-status");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toBe("Invalid status");
  });

  it("converts commercial batch map into object", async () => {
    const service = buildService();
    (service as any).deps.commercialImpactService.batchCalculateImpactScores.mockResolvedValue(
      new Map([
        ["task-1", { score: 10 }],
        ["task-2", { score: 20 }],
      ])
    );

    const result = await service.batchCalculateCommercialImpact("agency-1", []);
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({
      "task-1": { score: 10 },
      "task-2": { score: 20 },
    });
  });

  it("returns 404 when predict-and-signal task is missing", async () => {
    const service = buildService({ getTaskById: vi.fn().mockResolvedValue(undefined) });
    const result = await service.predictAndSignal("agency-1", { taskId: "task-1" } as any);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe("Task not found");
  });

  it("returns 404 when outcome update is missing", async () => {
    const service = buildService();
    (service as any).deps.outcomeFeedbackService.updateOutcome.mockResolvedValue(undefined);

    const result = await service.updateOutcome("outcome-1", {});
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe("Outcome not found");
  });
});
