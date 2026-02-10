import { describe, expect, it, vi } from "vitest";

const inserted: Array<Record<string, unknown>> = [];

const dbMock = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => []),
      })),
    })),
  })),
  insert: vi.fn(() => ({
    values: vi.fn((values: Record<string, unknown>) => {
      inserted.push(values);
      return {
        returning: vi.fn(async () => [{ id: "exec-1" }]),
      };
    }),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(async () => undefined),
    })),
  })),
};

vi.mock("../server/db", () => ({ db: dbMock }));
vi.mock("../server/ai/provider", () => ({
  getAIProvider: vi.fn(async () => ({
    generateEmbedding: vi.fn(async () => ({
      embedding: [0.1],
      tokenCount: 1,
      model: "text-embedding-3-small",
      provider: "openai",
    })),
    generateText: vi.fn(async () => "ok"),
  })),
}));
vi.mock("../server/governance/quota-service", () => ({
  quotaService: {
    checkAIRequestQuota: vi.fn(async () => ({ allowed: true })),
    checkAITokenQuota: vi.fn(async () => ({ allowed: true })),
    incrementAIUsage: vi.fn(async () => undefined),
    checkEmbeddingRequestQuota: vi.fn(async () => ({ allowed: true })),
    checkEmbeddingTokenQuota: vi.fn(async () => ({ allowed: true })),
    incrementEmbeddingUsage: vi.fn(async () => undefined),
  },
}));

describe("AI usage tracking", () => {
  it("records embedding request type in usage tracking", async () => {
    const { hardenedAIExecutor } = await import("../server/ai/hardened-executor");
    const executor = hardenedAIExecutor as any;

    await executor.updateUsageTracking(
      "agency-1",
      "openai",
      "text-embedding-3-small",
      "embedding",
      true,
      false,
      { prompt: 10, completion: 0, total: 10 }
    );

    expect(inserted.length).toBe(1);
    expect(inserted[0].requestType).toBe("embedding");
    expect(inserted[0].provider).toBe("openai");
    expect(inserted[0].model).toBe("text-embedding-3-small");
  });
});
