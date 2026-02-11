import { describe, expect, it, vi } from "vitest";
import { WorkflowExecutionsService } from "../server/application/workflows/workflow-executions-service";

describe("WorkflowExecutionsService", () => {
  it("returns 404 when execution is missing for events", async () => {
    const storage = {
      getWorkflowExecutionById: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new WorkflowExecutionsService(storage);

    const result = await service.getExecutionEvents("exec-1", { agencyId: "agency-1", isSuperAdmin: false });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe("Execution not found");
  });

  it("returns 403 when execution belongs to another agency for lineage", async () => {
    const storage = {
      getWorkflowExecutionById: vi.fn().mockResolvedValue({ id: "exec-1", agencyId: "agency-b", workflowId: "wf-1" }),
    } as any;
    const service = new WorkflowExecutionsService(storage);

    const result = await service.getExecutionLineage("exec-1", { agencyId: "agency-a", isSuperAdmin: false });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toBe("Access denied - execution belongs to different agency");
  });
});

