import { describe, expect, it, vi } from "vitest";
import { IntelligenceCrudService } from "../server/application/intelligence/intelligence-crud-service";
import { IntelligenceDurationService } from "../server/application/intelligence/intelligence-duration-service";
import { IntelligenceOverviewService } from "../server/application/intelligence/intelligence-overview-service";
import { IntelligencePipelineService } from "../server/application/intelligence/intelligence-pipeline-service";
import { ResourceOptimizationService } from "../server/application/intelligence/resource-optimization-service";
import {
  createFeedbackCreateHandler,
  createFeedbackListHandler,
  createInsightStatusHandler,
  createPriorityConfigGetHandler,
  createSignalsListHandler,
  createSignalDiscardHandler,
  createDurationHistoryHandler,
  createDurationPredictHandler,
  createDurationRecordCompletionHandler,
  createDurationStatsHandler,
  createComputePrioritiesHandler,
  createIntelligenceOverviewHandler,
  createProcessSignalsHandler,
  createResourceGeneratePlanHandler,
  createResourceSavePlanHandler,
  createRunPipelineHandler,
} from "../server/routes/intelligence-extended";

describe("Intelligence extended route", () => {
  it("delegates overview endpoint to service", async () => {
    const getOverview = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { unprocessedSignalsCount: 2 },
    });
    const service = { getOverview } as unknown as IntelligenceOverviewService;

    const req = { user: { agencyId: "agency-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    const handler = createIntelligenceOverviewHandler(service);
    await handler(req, res);

    expect(getOverview).toHaveBeenCalledWith("agency-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates process-signals endpoint to service", async () => {
    const processSignals = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { message: "Signal processing completed" },
    });
    const service = { processSignals } as unknown as IntelligencePipelineService;

    const req = { user: { agencyId: "agency-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    const handler = createProcessSignalsHandler(service);
    await handler(req, res);

    expect(processSignals).toHaveBeenCalledWith("agency-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates compute-priorities endpoint to service", async () => {
    const computePriorities = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { message: "Priority computation completed" },
    });
    const service = { computePriorities } as unknown as IntelligencePipelineService;

    const req = { user: { agencyId: "agency-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    const handler = createComputePrioritiesHandler(service);
    await handler(req, res);

    expect(computePriorities).toHaveBeenCalledWith("agency-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates run-pipeline endpoint to service", async () => {
    const runPipeline = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { message: "Intelligence pipeline completed" },
    });
    const service = { runPipeline } as unknown as IntelligencePipelineService;

    const req = { user: { agencyId: "agency-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    const handler = createRunPipelineHandler(service);
    await handler(req, res);

    expect(runPipeline).toHaveBeenCalledWith("agency-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates duration predict endpoint to service", async () => {
    const predict = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { hours: 2 },
    });
    const service = { predict } as unknown as IntelligenceDurationService;
    const req = { user: { agencyId: "agency-1" }, body: { taskType: "seo" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await createDurationPredictHandler(service)(req, res);

    expect(predict).toHaveBeenCalledWith("agency-1", { taskType: "seo" });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates duration stats endpoint to service", async () => {
    const getStats = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { total: 1 },
    });
    const service = { getStats } as unknown as IntelligenceDurationService;
    const req = { user: { agencyId: "agency-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await createDurationStatsHandler(service)(req, res);

    expect(getStats).toHaveBeenCalledWith("agency-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates duration history endpoint to service", async () => {
    const getHistory = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: [],
    });
    const service = { getHistory } as unknown as IntelligenceDurationService;
    const req = { user: { agencyId: "agency-1" }, query: { limit: "5" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await createDurationHistoryHandler(service)(req, res);

    expect(getHistory).toHaveBeenCalledWith("agency-1", {
      limit: "5",
      taskType: undefined,
      clientId: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates duration record-completion endpoint to service", async () => {
    const recordCompletion = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { success: true },
    });
    const service = { recordCompletion } as unknown as IntelligenceDurationService;
    const req = { user: { agencyId: "agency-1" }, body: { taskId: "t1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await createDurationRecordCompletionHandler(service)(req, res);

    expect(recordCompletion).toHaveBeenCalledWith("agency-1", { taskId: "t1" });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates resource generate-plan endpoint to service", async () => {
    const generatePlan = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { plan: [] },
    });
    const service = { generatePlan } as unknown as ResourceOptimizationService;
    const req = { user: { agencyId: "agency-1" }, body: { tasks: [] } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await createResourceGeneratePlanHandler(service)(req, res);

    expect(generatePlan).toHaveBeenCalledWith("agency-1", { tasks: [] });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates resource save-plan endpoint to service", async () => {
    const savePlan = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { id: "plan-1" },
    });
    const service = { savePlan } as unknown as ResourceOptimizationService;
    const req = { user: { agencyId: "agency-1", id: "user-1" }, body: { name: "Q1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await createResourceSavePlanHandler(service)(req, res);

    expect(savePlan).toHaveBeenCalledWith("agency-1", "user-1", { name: "Q1" });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates signals list endpoint to CRUD service", async () => {
    const listSignals = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { listSignals } as unknown as IntelligenceCrudService;
    const req = { user: { agencyId: "agency-1" }, query: { processed: "true" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await createSignalsListHandler(service)(req, res);

    expect(listSignals).toHaveBeenCalledWith("agency-1", {
      limit: undefined,
      sourceSystem: undefined,
      category: undefined,
      processed: "true",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("maps signal discard validation error from CRUD service", async () => {
    const service = {
      discardSignal: vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        error: "Discard reason is required",
      }),
    } as unknown as IntelligenceCrudService;
    const req = { params: { id: "sig-1" }, body: {} } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await createSignalDiscardHandler(service)(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Discard reason is required" });
  });

  it("delegates insight status endpoint to CRUD service", async () => {
    const updateInsightStatus = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { id: "ins-1", status: "open" },
    });
    const service = { updateInsightStatus } as unknown as IntelligenceCrudService;
    const req = { params: { id: "ins-1" }, body: { status: "open" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await createInsightStatusHandler(service)(req, res);
    expect(updateInsightStatus).toHaveBeenCalledWith("ins-1", "open");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates priority-config get endpoint to CRUD service", async () => {
    const getPriorityConfig = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { wImpact: "0.4" },
    });
    const service = { getPriorityConfig } as unknown as IntelligenceCrudService;
    const req = { user: { agencyId: "agency-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await createPriorityConfigGetHandler(service)(req, res);
    expect(getPriorityConfig).toHaveBeenCalledWith("agency-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates feedback list endpoint to CRUD service", async () => {
    const listFeedback = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { listFeedback } as unknown as IntelligenceCrudService;
    const req = { user: { agencyId: "agency-1" }, query: { limit: "20" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await createFeedbackListHandler(service)(req, res);
    expect(listFeedback).toHaveBeenCalledWith("agency-1", {
      limit: "20",
      insightId: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates feedback create endpoint to CRUD service", async () => {
    const createFeedback = vi.fn().mockResolvedValue({ ok: true, status: 201, data: { id: "f-1" } });
    const service = { createFeedback } as unknown as IntelligenceCrudService;
    const req = { user: { agencyId: "agency-1", id: "user-1" }, body: { insightId: "ins-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await createFeedbackCreateHandler(service)(req, res);
    expect(createFeedback).toHaveBeenCalledWith("agency-1", "user-1", { insightId: "ins-1" });
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
