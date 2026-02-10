import { describe, expect, it, vi } from "vitest";

const executeWithSchema = vi.fn().mockResolvedValue({
  success: true,
  data: { painPoints: [], recentWins: [], activeQuestions: [] },
  cached: false,
  executionId: "test-exec",
  durationMs: 1,
});

vi.mock("../server/ai/hardened-executor", () => ({
  hardenedAIExecutor: { executeWithSchema },
}));

vi.mock("../server/lib/retry", () => ({
  retry: vi.fn(async (fn: () => Promise<unknown>) => fn()),
  isRetryableError: vi.fn(() => false),
}));

describe("Gemini legacy adapter", () => {
  it("routes chat analysis through hardened executor", async () => {
    const { analyzeChatHistory } = await import("../server/gemini");

    const result = await analyzeChatHistory("hello");

    expect(result).toEqual({ painPoints: [], recentWins: [], activeQuestions: [] });
    expect(executeWithSchema).toHaveBeenCalledTimes(1);
    const [context] = executeWithSchema.mock.calls[0];
    expect(context).toMatchObject({
      agencyId: "legacy",
      operation: "analyzeChatHistory",
      provider: "gemini",
    });
  });
});
