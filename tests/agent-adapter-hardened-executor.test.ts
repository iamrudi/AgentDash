import { describe, expect, it, vi } from "vitest";

const executeWithSchema = vi.fn().mockResolvedValue({
  success: true,
  data: "adapter response",
  cached: false,
  executionId: "exec-3",
  durationMs: 1,
});

vi.mock("../server/ai/hardened-executor", () => ({
  hardenedAIExecutor: { executeWithSchema },
}));

describe("Agent AI provider adapter", () => {
  it("routes generateText through hardened executor", async () => {
    process.env.AI_PROVIDER = "gemini";
    const { createAIProvider } = await import("../server/agents/ai-provider-adapter");

    const provider = createAIProvider();
    const result = await provider.generateText("Hello", "System");

    expect(result).toBe("adapter response");
    expect(executeWithSchema).toHaveBeenCalledTimes(1);
    const [context] = executeWithSchema.mock.calls[0];
    expect(context).toMatchObject({
      agencyId: "legacy",
      operation: "agentGenerateText",
      provider: "gemini",
    });
  });
});
