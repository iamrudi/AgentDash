import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "events";
import { MessageService } from "../server/application/messages/message-service";
import { MessageStreamService } from "../server/application/messages/message-stream-service";
import {
  createMessageStreamHandler,
  createMessageMarkReadHandler,
  createMessageCreateHandler,
  createMessageCreateForClientHandler,
  createMessageMarkReadPostHandler,
  createMessageMarkAllReadHandler,
  createMessageAnalyzeHandler,
} from "../server/routes/messages";

describe("Messages route handlers", () => {
  it("delegates stream authentication and sets SSE headers", async () => {
    const authenticateStream = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { agencyId: "agency-1" } });
    const service = { authenticateStream } as unknown as MessageStreamService;
    const emitter = new EventEmitter();
    const clearInterval = vi.fn();
    const setInterval = vi.fn().mockReturnValue(1 as any);
    const handler = createMessageStreamHandler(service, emitter, { setInterval: setInterval as any, clearInterval: clearInterval as any });
    let onClose: (() => void) | undefined;
    const req = {
      query: { token: "token-1" },
      on: vi.fn((event: string, cb: () => void) => {
        if (event === "close") onClose = cb;
      }),
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), setHeader: vi.fn(), write: vi.fn() };

    await handler(req, res);
    onClose?.();

    expect(authenticateStream).toHaveBeenCalledWith("token-1");
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream");
    expect(setInterval).toHaveBeenCalledTimes(1);
    expect(clearInterval).toHaveBeenCalledTimes(1);
  });

  it("returns authentication error for stream handler", async () => {
    const authenticateStream = vi.fn().mockResolvedValue({ ok: false, status: 401, error: "Authentication token required" });
    const service = { authenticateStream } as unknown as MessageStreamService;
    const handler = createMessageStreamHandler(service, new EventEmitter());
    const req = { query: {}, on: vi.fn() } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), setHeader: vi.fn(), write: vi.fn() };

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Authentication token required" });
  });

  it("delegates patch mark-read", async () => {
    const markRead = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    const service = { markRead } as unknown as MessageService;
    const handler = createMessageMarkReadHandler(service);
    const req = { params: { id: "msg-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() };

    await handler(req, res);

    expect(markRead).toHaveBeenCalledWith("msg-1");
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("delegates create", async () => {
    const createMessage = vi.fn().mockResolvedValue({ ok: true, status: 201, data: { message: { id: "msg-1" }, agencyId: "agency-1" } });
    const service = { createMessage } as unknown as MessageService;
    const handler = createMessageCreateHandler(service);
    const req = { body: { clientId: "client-1", message: "Hello", senderRole: "Admin" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() };

    await handler(req, res);

    expect(createMessage).toHaveBeenCalledWith({ clientId: "client-1", message: "Hello", senderRole: "Admin" });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("delegates create for client", async () => {
    const createMessage = vi.fn().mockResolvedValue({ ok: true, status: 201, data: { message: { id: "msg-1" }, agencyId: "agency-1" } });
    const service = { createMessage } as unknown as MessageService;
    const handler = createMessageCreateForClientHandler(service);
    const req = { params: { clientId: "client-1" }, body: { message: "Hello" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() };

    await handler(req, res);

    expect(createMessage).toHaveBeenCalledWith({ clientId: "client-1", message: "Hello", senderRole: "Admin" });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("delegates post mark-read", async () => {
    const markRead = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    const service = { markRead } as unknown as MessageService;
    const handler = createMessageMarkReadPostHandler(service);
    const req = { params: { messageId: "msg-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() };

    await handler(req, res);

    expect(markRead).toHaveBeenCalledWith("msg-1");
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("delegates mark-all-read", async () => {
    const markAllReadForClient = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    const service = { markAllReadForClient } as unknown as MessageService;
    const handler = createMessageMarkAllReadHandler(service);
    const req = { params: { clientId: "client-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() };

    await handler(req, res);

    expect(markAllReadForClient).toHaveBeenCalledWith("client-1");
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("delegates analyze", async () => {
    const analyzeConversation = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { analysis: "A", suggestions: [] } });
    const service = { analyzeConversation } as unknown as MessageService;
    const handler = createMessageAnalyzeHandler(service);
    const req = { params: { clientId: "client-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() };

    await handler(req, res);

    expect(analyzeConversation).toHaveBeenCalledWith("client-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
