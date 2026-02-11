import { describe, expect, it, vi } from "vitest";
import { ResourceOptimizationService } from "../server/application/intelligence/resource-optimization-service";

describe("ResourceOptimizationService", () => {
  it("returns 400 when agency context is missing", async () => {
    const service = new ResourceOptimizationService({
      generateAllocationPlan: vi.fn(),
      saveAllocationPlan: vi.fn(),
    });

    const result = await service.generatePlan(undefined, {
      tasks: [],
      startDate: "2026-01-01",
      endDate: "2026-01-10",
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it("delegates generate-plan", async () => {
    const generateAllocationPlan = vi.fn().mockResolvedValue({ plan: [] });
    const service = new ResourceOptimizationService({
      generateAllocationPlan,
      saveAllocationPlan: vi.fn(),
    });

    const result = await service.generatePlan("agency-1", {
      tasks: [{ id: "t1" }],
      startDate: "2026-01-01",
      endDate: "2026-01-10",
    });
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ plan: [] });
    expect(generateAllocationPlan).toHaveBeenCalledTimes(1);
  });

  it("delegates save-plan with nullable user id", async () => {
    const saveAllocationPlan = vi.fn().mockResolvedValue({ id: "plan-1" });
    const service = new ResourceOptimizationService({
      generateAllocationPlan: vi.fn(),
      saveAllocationPlan,
    });

    const result = await service.savePlan("agency-1", undefined, {
      name: "Q1",
      startDate: "2026-01-01",
      endDate: "2026-01-10",
      assignments: [],
      objective: "balance",
    });
    expect(result.ok).toBe(true);
    expect(saveAllocationPlan).toHaveBeenCalledWith(
      "agency-1",
      "Q1",
      expect.any(Date),
      expect.any(Date),
      [],
      "balance",
      null
    );
  });
});
