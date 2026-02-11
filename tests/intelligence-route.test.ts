import { describe, expect, it, vi } from "vitest";
import { IntelligenceOperationsService } from "../server/application/intelligence/intelligence-operations-service";
import {
  createAllocationPlansListHandler,
  createAllocationPlanStatusHandler,
  createCommercialBatchHandler,
  createIntegrationPredictAndSignalHandler,
  createOutcomeUpdateHandler,
} from "../server/routes/intelligence";

describe("Intelligence route", () => {
  it("delegates allocation plans list handler", async () => {
    const listAllocationPlans = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: [],
    });
    const service = { listAllocationPlans } as unknown as IntelligenceOperationsService;
    const req = { user: { agencyId: "agency-1" }, query: { limit: "10" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await createAllocationPlansListHandler(service)(req, res);

    expect(listAllocationPlans).toHaveBeenCalledWith("agency-1", {
      status: undefined,
      limit: "10",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("maps invalid status errors for allocation plan status handler", async () => {
    const service = {
      updateAllocationPlanStatus: vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        error: "Invalid status",
      }),
    } as unknown as IntelligenceOperationsService;
    const req = { params: { id: "plan-1" }, body: { status: "bad" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await createAllocationPlanStatusHandler(service)(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid status" });
  });

  it("delegates commercial batch handler", async () => {
    const batchCalculateCommercialImpact = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { t1: { score: 10 } },
    });
    const service = { batchCalculateCommercialImpact } as unknown as IntelligenceOperationsService;
    const req = { user: { agencyId: "agency-1" }, body: { tasks: [] } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await createCommercialBatchHandler(service)(req, res);

    expect(batchCalculateCommercialImpact).toHaveBeenCalledWith("agency-1", []);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("maps task not found from predict-and-signal handler", async () => {
    const service = {
      predictAndSignal: vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        error: "Task not found",
      }),
    } as unknown as IntelligenceOperationsService;
    const req = { user: { agencyId: "agency-1" }, body: { taskId: "task-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await createIntegrationPredictAndSignalHandler(service)(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Task not found" });
  });

  it("maps outcome not found from outcome update handler", async () => {
    const service = {
      updateOutcome: vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        error: "Outcome not found",
      }),
    } as unknown as IntelligenceOperationsService;
    const req = { params: { id: "outcome-1" }, body: {} } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await createOutcomeUpdateHandler(service)(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Outcome not found" });
  });
});
