import { describe, expect, it, vi } from "vitest";
import { WorkflowExecutionsService } from "../server/application/workflows/workflow-executions-service";
import { createExecutionEventsHandler, createExecutionLineageHandler } from "../server/routes/workflow-executions";

describe("Workflow executions route handlers", () => {
  it("delegates execution events lookup to service", async () => {
    const getExecutionEvents = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { getExecutionEvents } as unknown as WorkflowExecutionsService;
    const handler = createExecutionEventsHandler(service);
    const req = { params: { id: "exec-1" }, user: { agencyId: "agency-1", isSuperAdmin: false } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(getExecutionEvents).toHaveBeenCalledWith("exec-1", { agencyId: "agency-1", isSuperAdmin: false });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates execution lineage lookup to service", async () => {
    const getExecutionLineage = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { execution: { id: "exec-1" } } });
    const service = { getExecutionLineage } as unknown as WorkflowExecutionsService;
    const handler = createExecutionLineageHandler(service);
    const req = { params: { id: "exec-1" }, user: { agencyId: "agency-1", isSuperAdmin: false } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(getExecutionLineage).toHaveBeenCalledWith("exec-1", { agencyId: "agency-1", isSuperAdmin: false });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

