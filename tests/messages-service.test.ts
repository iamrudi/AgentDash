import { describe, expect, it, vi } from "vitest";

const { executeWithSchema } = vi.hoisted(() => ({
  executeWithSchema: vi.fn(),
}));
vi.mock("../server/ai/hardened-executor", () => ({
  hardenedAIExecutor: { executeWithSchema },
}));

import { MessageService } from "../server/application/messages/message-service";

describe("MessageService", () => {
  it("fails create when message is empty", async () => {
    const service = new MessageService({} as any);
    const result = await service.createMessage({ clientId: "client-1", message: "   " });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toBe("Message is required");
  });

  it("creates message and returns agencyId for emit", async () => {
    const storage = {
      createMessage: vi.fn().mockResolvedValue({ id: "msg-1", message: "Hello" }),
      getClientById: vi.fn().mockResolvedValue({ id: "client-1", agencyId: "agency-1" }),
    } as any;
    const service = new MessageService(storage);

    const result = await service.createMessage({ clientId: "client-1", message: " Hello ", senderRole: "Admin" });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(201);
    expect(storage.createMessage).toHaveBeenCalledWith({ clientId: "client-1", message: "Hello", senderRole: "Admin" });
    expect(result.data?.agencyId).toBe("agency-1");
  });

  it("marks only unread client messages when marking all read", async () => {
    const storage = {
      getMessagesByClientId: vi.fn().mockResolvedValue([
        { id: "m1", isRead: "false", senderRole: "Client" },
        { id: "m2", isRead: "true", senderRole: "Client" },
        { id: "m3", isRead: "false", senderRole: "Admin" },
      ]),
      markMessageAsRead: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new MessageService(storage);

    const result = await service.markAllReadForClient("client-1");

    expect(result.ok).toBe(true);
    expect(result.status).toBe(204);
    expect(storage.markMessageAsRead).toHaveBeenCalledTimes(1);
    expect(storage.markMessageAsRead).toHaveBeenCalledWith("m1");
  });

  it("fails closed on analyze when client is missing", async () => {
    const storage = {
      getClientById: vi.fn().mockResolvedValue(undefined),
      getMessagesByClientId: vi.fn().mockResolvedValue([]),
    } as any;
    const service = new MessageService(storage);

    const result = await service.analyzeConversation("client-1");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe("Client not found");
  });

  it("uses hardened executor during analyze", async () => {
    executeWithSchema.mockResolvedValueOnce({ success: true, data: "analysis" });
    const storage = {
      getClientById: vi.fn().mockResolvedValue({ id: "client-1", agencyId: "agency-1", companyName: "Acme" }),
      getMessagesByClientId: vi.fn().mockResolvedValue([{ senderRole: "Client", message: "Hello" }]),
    } as any;
    const service = new MessageService(storage);

    const result = await service.analyzeConversation("client-1");

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ analysis: "analysis", suggestions: [] });
    expect(executeWithSchema).toHaveBeenCalledTimes(1);
  });
});
