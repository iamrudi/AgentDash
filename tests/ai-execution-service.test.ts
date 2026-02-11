import { describe, expect, it, vi } from "vitest";
import { AiExecutionService } from "../server/application/ai/ai-execution-service";

describe("AiExecutionService", () => {
  it("returns 404 when execution is missing", async () => {
    const executor = {
      getExecutionById: vi.fn().mockResolvedValue(undefined),
      getExecutionsByWorkflow: vi.fn(),
      getUsageByAgency: vi.fn(),
      getCacheStats: vi.fn(),
      clearCache: vi.fn(),
    } as any;
    const service = new AiExecutionService(executor);

    const result = await service.getExecutionById("exec-1", { agencyId: "agency-1", isSuperAdmin: false });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe("AI execution not found");
  });

  it("denies cross-tenant execution read for non-superadmin", async () => {
    const executor = {
      getExecutionById: vi.fn().mockResolvedValue({ id: "exec-1", agencyId: "agency-2" }),
      getExecutionsByWorkflow: vi.fn(),
      getUsageByAgency: vi.fn(),
      getCacheStats: vi.fn(),
      clearCache: vi.fn(),
    } as any;
    const service = new AiExecutionService(executor);

    const result = await service.getExecutionById("exec-1", { agencyId: "agency-1", isSuperAdmin: false });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toBe("Access denied");
  });

  it("fails usage read when agency missing", async () => {
    const executor = {
      getExecutionById: vi.fn(),
      getExecutionsByWorkflow: vi.fn(),
      getUsageByAgency: vi.fn(),
      getCacheStats: vi.fn(),
      clearCache: vi.fn(),
    } as any;
    const service = new AiExecutionService(executor);

    const result = await service.getUsageByAgency(undefined, {});

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toBe("Agency ID required");
  });

  it("returns cache stats", () => {
    const executor = {
      getExecutionById: vi.fn(),
      getExecutionsByWorkflow: vi.fn(),
      getUsageByAgency: vi.fn(),
      getCacheStats: vi.fn().mockReturnValue({ size: 1, keys: ["k"] }),
      clearCache: vi.fn(),
    } as any;
    const service = new AiExecutionService(executor);

    const result = service.getCacheStats();

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ size: 1, keys: ["k"] });
  });

  it("clears cache", () => {
    const executor = {
      getExecutionById: vi.fn(),
      getExecutionsByWorkflow: vi.fn(),
      getUsageByAgency: vi.fn(),
      getCacheStats: vi.fn(),
      clearCache: vi.fn(),
    } as any;
    const service = new AiExecutionService(executor);

    const result = service.clearCache();

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ message: "AI cache cleared" });
    expect(executor.clearCache).toHaveBeenCalledTimes(1);
  });
});
