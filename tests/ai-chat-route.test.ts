import { describe, expect, it, vi } from "vitest";
import { AiChatService } from "../server/application/ai/ai-chat-service";
import { createAnalyzeDataHandler, createRequestActionHandler } from "../server/routes/ai-chat";

describe("AI chat route", () => {
  it("delegates analyze-data to service", async () => {
    const analyzeData = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { title: "Test" },
    });
    const service = { analyzeData } as unknown as AiChatService;

    const req = { user: { id: "user-1" }, body: { question: "Q", contextData: {} } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    const handler = createAnalyzeDataHandler(service);
    await handler(req, res);

    expect(analyzeData).toHaveBeenCalledWith("user-1", req.body);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("maps analyze-data service errors", async () => {
    const service = {
      analyzeData: vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        error: "Invalid request data",
        errors: [{ message: "bad" }],
      }),
    } as unknown as AiChatService;

    const req = { user: { id: "user-1" }, body: {} } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    const handler = createAnalyzeDataHandler(service);
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid request data", errors: [{ message: "bad" }] });
  });

  it("delegates request-action to service", async () => {
    const requestAction = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      data: { initiativeId: "initiative-1", message: "ok" },
    });
    const service = { requestAction } as unknown as AiChatService;

    const req = { user: { id: "user-1" }, body: { title: "T" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    const handler = createRequestActionHandler(service);
    await handler(req, res);

    expect(requestAction).toHaveBeenCalledWith("user-1", req.body);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
