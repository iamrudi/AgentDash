import { describe, expect, it, vi } from "vitest";

const executeEmbeddingWithSchema = vi.fn().mockResolvedValue({
  success: true,
  data: {
    embedding: [0.1, 0.2],
    tokenCount: 2,
    model: "text-embedding-3-small",
    provider: "openai",
  },
  cached: false,
  executionId: "exec-4",
  durationMs: 1,
});

vi.mock("../server/ai/hardened-executor", () => ({
  hardenedAIExecutor: { executeEmbeddingWithSchema },
}));

describe("Embedding service", () => {
  it("routes embedding generation through hardened executor", async () => {
    const { EmbeddingService } = await import("../server/vector/embedding-service");
    const service = new EmbeddingService("openai");

    const result = await service.generateEmbedding("hello");

    expect(result.embedding).toEqual([0.1, 0.2]);
    expect(executeEmbeddingWithSchema).toHaveBeenCalledTimes(1);
  });
});
