import { describe, expect, it, vi } from "vitest";

vi.mock("../server/workflow/signal-router", () => ({
  signalRouter: {
    ingestSignal: vi.fn(),
  },
}));

vi.mock("../server/workflow/engine", () => ({
  createWorkflowEngine: vi.fn(),
}));

import { emitClientRecordUpdatedSignal } from "../server/clients/client-record-signal";
import { signalRouter } from "../server/workflow/signal-router";
import { createWorkflowEngine } from "../server/workflow/engine";

describe("Client record signal emission", () => {
  it("processes workflows when routes match", async () => {
    const storage = {
      getMatchingSignalRoutes: vi.fn().mockResolvedValue([{}]),
    } as any;
    const processSignal = vi.fn().mockResolvedValue({
      signalId: "signal-1",
      executions: [{ id: "exec-1" }],
    });

    (signalRouter.ingestSignal as any).mockResolvedValue({
      signal: { id: "signal-1", payload: { foo: "bar" } },
      isDuplicate: false,
      workflowsTriggered: ["workflow-1"],
    });
    (createWorkflowEngine as any).mockReturnValue({ processSignal });

    const result = await emitClientRecordUpdatedSignal(storage, {
      agencyId: "agency-1",
      clientId: "client-1",
      updates: { businessContext: "test" },
      actorId: "user-1",
      origin: "test",
    });

    expect(result.signalId).toBe("signal-1");
    expect(result.executions).toEqual(["exec-1"]);
    expect(processSignal).toHaveBeenCalledWith(
      "signal-1",
      { foo: "bar" },
      ["workflow-1"]
    );
  });

  it("skips processing when signal is duplicate", async () => {
    const storage = {
      getMatchingSignalRoutes: vi.fn().mockResolvedValue([{}]),
    } as any;
    (signalRouter.ingestSignal as any).mockResolvedValue({
      signal: { id: "signal-2", payload: { foo: "bar" } },
      isDuplicate: true,
      workflowsTriggered: ["workflow-1"],
    });
    (createWorkflowEngine as any).mockReturnValue({ processSignal: vi.fn() });

    const result = await emitClientRecordUpdatedSignal(storage, {
      agencyId: "agency-1",
      clientId: "client-1",
      updates: {},
      actorId: "user-1",
      origin: "test",
    });

    expect(result.isDuplicate).toBe(true);
    expect(result.executions).toHaveLength(0);
  });

  it("creates default workflow and route when none exist", async () => {
    const storage = {
      getMatchingSignalRoutes: vi.fn().mockResolvedValue([]),
      createWorkflow: vi.fn().mockResolvedValue({ id: "workflow-1" }),
      createSignalRoute: vi.fn().mockResolvedValue({ id: "route-1" }),
    } as any;
    (signalRouter.ingestSignal as any).mockResolvedValue({
      signal: { id: "signal-3", payload: { foo: "bar" } },
      isDuplicate: true,
      workflowsTriggered: [],
    });
    (createWorkflowEngine as any).mockReturnValue({ processSignal: vi.fn() });

    await emitClientRecordUpdatedSignal(storage, {
      agencyId: "agency-1",
      clientId: "client-1",
      updates: {},
      actorId: "user-1",
      origin: "test",
    });

    expect(storage.createWorkflow).toHaveBeenCalledTimes(1);
    expect(storage.createSignalRoute).toHaveBeenCalledTimes(1);
  });
});
