import { describe, expect, it, vi } from "vitest";

const executeWithSchema = vi.fn().mockResolvedValue({
  success: true,
  data: "generated proposal text",
  cached: false,
  executionId: "exec-2",
  durationMs: 1,
});

vi.mock("../server/ai/hardened-executor", () => ({
  hardenedAIExecutor: { executeWithSchema },
}));

vi.mock("../server/storage", () => ({
  storage: {
    getProposalById: vi.fn(async () => ({ id: "proposal-1", agencyId: "agency-1" })),
  },
}));

vi.mock("../server/middleware/supabase-auth", () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

describe("CRM AI proposal generation", () => {
  it("routes proposal generation through hardened executor", async () => {
    const { default: router } = await import("../server/routes/crm");

    const response = await new Promise<{ status: number; body: unknown }>((resolve, reject) => {
      const req = {
        method: "POST",
        url: "/proposals/proposal-1/ai-generate",
        body: {
          action: "generate-summary",
          contentToRefine: "Proposal content",
          dealContext: { clientName: "Acme" },
        },
        user: { agencyId: "agency-1" },
        params: { proposalId: "proposal-1" },
      } as any;

      const res = {
        statusCode: 200,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(payload: unknown) {
          resolve({ status: this.statusCode ?? 200, body: payload });
          return this;
        },
        send(payload: unknown) {
          resolve({ status: this.statusCode ?? 200, body: payload });
          return this;
        },
      } as any;

      router.handle(req, res, (err: unknown) => {
        if (err) {
          reject(err);
        }
      });
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ generatedContent: "generated proposal text" });
    expect(executeWithSchema).toHaveBeenCalledTimes(1);
  });
});
