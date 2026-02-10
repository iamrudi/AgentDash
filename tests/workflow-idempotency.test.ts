import { beforeEach, describe, expect, it, vi } from "vitest";
let dbMock: any;
vi.mock("../server/db", () => ({ db: dbMock }));

describe("Workflow idempotency", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns existing execution when input hash matches", async () => {
    const existingExecution = { id: "exec-1" };
    dbMock = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([existingExecution]),
      transaction: vi.fn(async (cb: any) => cb({})),
    };

    const { createWorkflowEngine: createEngine } = await import("../server/workflow/engine");

    const storage = {
      getWorkflowById: vi.fn(),
    } as any;

    const engine = createEngine(storage);
    const workflow = { id: "wf-1", agencyId: "agency-1", enabled: true, triggerType: "manual" } as any;

    const execution = await engine.execute(workflow, { a: 1 });
    expect(execution).toBe(existingExecution);
    expect(dbMock.limit).toHaveBeenCalled();
  });
});
