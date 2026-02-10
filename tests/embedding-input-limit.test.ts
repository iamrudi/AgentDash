import { describe, expect, it, vi } from "vitest";

vi.mock("../server/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ embeddingMaxTokens: 2 }]),
        })),
      })),
    })),
  },
}));

vi.mock("../server/governance/quota-service", () => ({
  quotaService: {
    checkEmbeddingRequestQuota: vi.fn(async () => ({ allowed: true })),
    checkEmbeddingTokenQuota: vi.fn(async () => ({ allowed: true })),
    incrementEmbeddingUsage: vi.fn(async () => undefined),
    checkAIRequestQuota: vi.fn(async () => ({ allowed: true })),
    checkAITokenQuota: vi.fn(async () => ({ allowed: true })),
    incrementAIUsage: vi.fn(async () => undefined),
  },
}));

vi.mock("../server/ai/provider", () => ({
  getAIProvider: vi.fn(async () => ({
    generateEmbedding: vi.fn(async () => ({
      embedding: [0.1],
      tokenCount: 1,
      model: "text-embedding-3-small",
      provider: "openai",
    })),
  })),
}));

describe("Embedding input limits", () => {
  it("fails when input exceeds per-tenant max tokens", async () => {
    const { hardenedAIExecutor } = await import("../server/ai/hardened-executor");

    const result = await hardenedAIExecutor.executeEmbeddingWithSchema(
      { agencyId: "agency-1", operation: "embed", provider: "openai" },
      { input: "x".repeat(20), model: "text-embedding-3-small" },
      {
        safeParse: (value: unknown) => ({ success: true, data: value }),
      } as any
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Embedding input exceeds max token limit");
    expect(result.errorCode).toBe("embedding_input_too_large");
  });
});
