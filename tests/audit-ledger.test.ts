import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../server/db";

describe("Audit/event ledger writes", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("logs workflow events with agency context", async () => {
    const insertSpy = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    });

    (db as any).insert = insertSpy;

    const { createWorkflowEngine } = await import("../server/workflow/engine");
    const engine = createWorkflowEngine({} as any) as any;
    engine.currentAgencyId = "agency-1";

    await engine.logEvent("exec-1", {
      stepId: "step-1",
      stepType: "ai",
      eventType: "started",
      input: { prompt: "test" },
    });

    expect(insertSpy).toHaveBeenCalled();
  });

  it("logs AI executions to audit ledger", async () => {
    const insertSpy = vi.fn().mockReturnValue({
      values: () => ({
        returning: async () => [{ id: "exec-1" }],
      }),
    });

    (db as any).insert = insertSpy;

    const { hardenedAIExecutor } = await import("../server/ai/hardened-executor");
    const logExecution = (hardenedAIExecutor as any).logExecution.bind(hardenedAIExecutor);

    const executionId = await logExecution({
      agencyId: "agency-1",
      provider: "gemini",
      model: "test-model",
      operation: "test",
      inputHash: "hash",
      prompt: "prompt",
    });

    expect(executionId).toBe("exec-1");
    expect(insertSpy).toHaveBeenCalled();
  });
});
