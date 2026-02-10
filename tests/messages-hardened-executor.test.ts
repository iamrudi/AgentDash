import { describe, expect, it, vi } from "vitest";

const executeWithSchema = vi.fn().mockResolvedValue({
  success: true,
  data: "analysis text",
  cached: false,
  executionId: "exec-1",
  durationMs: 1,
});

vi.mock("../server/ai/hardened-executor", () => ({
  hardenedAIExecutor: { executeWithSchema },
}));

vi.mock("../server/storage", () => ({
  storage: {
    getClientById: vi.fn(async () => ({ id: "client-1", agencyId: "agency-1", companyName: "Acme" })),
    getMessagesByClientId: vi.fn(async () => [
      { senderRole: "Client", message: "Hello" },
      { senderRole: "Admin", message: "Hi" },
    ]),
    markMessageAsRead: vi.fn(async () => undefined),
    createMessage: vi.fn(async () => ({ id: "msg-1" })),
  },
}));

vi.mock("../server/middleware/supabase-auth", () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next(),
  requireClientAccess: () => (_req: any, _res: any, next: any) => next(),
}));

describe("Messages analysis route", () => {
  it("uses hardened executor for analysis", async () => {
    const { default: router } = await import("../server/routes/messages");
    const response = await new Promise<{ status: number; body: unknown }>((resolve, reject) => {
      const req = {
        method: "POST",
        url: "/analyze/client-1",
        body: {},
        headers: {},
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
        setHeader() {
          return undefined;
        },
      } as any;

      router.handle(req, res, (err: unknown) => {
        if (err) {
          reject(err);
        }
      });
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ analysis: "analysis text", suggestions: [] });
    expect(executeWithSchema).toHaveBeenCalledTimes(1);
  });
});
