import { describe, expect, it, vi } from "vitest";
import { AiExecutionService } from "../server/application/ai/ai-execution-service";
import {
  createAiExecutionGetHandler,
  createAiExecutionsByWorkflowHandler,
  createAiUsageHandler,
  createAiCacheStatsHandler,
  createAiCacheClearHandler,
} from "../server/routes/ai-execution";

describe("AI execution route handlers", () => {
  it("delegates execution read", async () => {
    const getExecutionById = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { id: "exec-1" } });
    const service = { getExecutionById } as unknown as AiExecutionService;
    const handler = createAiExecutionGetHandler(service);
    const req = { params: { id: "exec-1" }, user: { agencyId: "agency-1", isSuperAdmin: false } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(getExecutionById).toHaveBeenCalledWith("exec-1", { agencyId: "agency-1", isSuperAdmin: false });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates workflow execution reads", async () => {
    const getExecutionsByWorkflow = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { getExecutionsByWorkflow } as unknown as AiExecutionService;
    const handler = createAiExecutionsByWorkflowHandler(service);
    const req = { params: { id: "wf-1" }, user: { agencyId: "agency-1", isSuperAdmin: false } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(getExecutionsByWorkflow).toHaveBeenCalledWith("wf-1", { agencyId: "agency-1", isSuperAdmin: false });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates usage reads", async () => {
    const getUsageByAgency = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { getUsageByAgency } as unknown as AiExecutionService;
    const handler = createAiUsageHandler(service);
    const req = { user: { agencyId: "agency-1" }, query: { periodStart: "2026-01-01", periodEnd: "2026-02-01" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(getUsageByAgency).toHaveBeenCalledWith("agency-1", { periodStart: "2026-01-01", periodEnd: "2026-02-01" });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates cache stats reads", async () => {
    const getCacheStats = vi.fn().mockReturnValue({ ok: true, status: 200, data: { size: 0, keys: [] } });
    const service = { getCacheStats } as unknown as AiExecutionService;
    const handler = createAiCacheStatsHandler(service);
    const req = {} as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(getCacheStats).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates cache clear", async () => {
    const clearCache = vi.fn().mockReturnValue({ ok: true, status: 200, data: { message: "AI cache cleared" } });
    const service = { clearCache } as unknown as AiExecutionService;
    const handler = createAiCacheClearHandler(service);
    const req = {} as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(clearCache).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
