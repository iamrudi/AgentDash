import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../server/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ embeddingMaxTokens: 8192 }]),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(async () => [{ id: "exec-1" }]),
      })),
    })),
  },
}));

vi.mock("../server/ai/provider", () => ({
  getAIProvider: vi.fn(async () => ({
    generateEmbedding: vi.fn(async () => ({
      embedding: [0.1],
      tokenCount: 10,
      model: "text-embedding-3-small",
      provider: "openai",
    })),
  })),
}));

const quotaMock = {
  checkEmbeddingRequestQuota: vi.fn(),
  checkEmbeddingTokenQuota: vi.fn(),
  incrementEmbeddingUsage: vi.fn(async () => undefined),
};

vi.mock("../server/governance/quota-service", () => ({
  quotaService: quotaMock,
}));

describe("Embedding quota checks", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("fails when embedding request quota is exceeded", async () => {
    quotaMock.checkEmbeddingRequestQuota.mockResolvedValue({
      allowed: false,
      message: "Embedding request quota exceeded",
    });
    quotaMock.checkEmbeddingTokenQuota.mockResolvedValue({ allowed: true });

    const { hardenedAIExecutor } = await import("../server/ai/hardened-executor");

    const result = await hardenedAIExecutor.executeEmbeddingWithSchema(
      { agencyId: "agency-1", operation: "embed", provider: "openai" },
      { input: "hello", model: "text-embedding-3-small" },
      {
        safeParse: (value: unknown) => ({ success: true, data: value }),
      } as any
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("embedding_quota_requests_exceeded");
  });

  it("fails when embedding token quota is exceeded", async () => {
    quotaMock.checkEmbeddingRequestQuota.mockResolvedValue({ allowed: true });
    quotaMock.checkEmbeddingTokenQuota.mockResolvedValue({
      allowed: false,
      message: "Embedding token quota exceeded",
    });

    const { hardenedAIExecutor } = await import("../server/ai/hardened-executor");

    const result = await hardenedAIExecutor.executeEmbeddingWithSchema(
      { agencyId: "agency-1", operation: "embed", provider: "openai" },
      { input: "hello", model: "text-embedding-3-small" },
      {
        safeParse: (value: unknown) => ({ success: true, data: value }),
      } as any
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("embedding_quota_tokens_exceeded");
  });
});
