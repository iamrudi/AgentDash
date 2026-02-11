import { describe, expect, it, vi } from "vitest";
import { AiChatService } from "../server/application/ai/ai-chat-service";

describe("AiChatService", () => {
  it("returns 400 for invalid analyze-data payload", async () => {
    const service = new AiChatService({} as any, { executeWithSchema: vi.fn() } as any);

    const result = await service.analyzeData("user-1", { question: "" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it("returns 500 when hardened executor fails", async () => {
    const executeWithSchema = vi.fn().mockResolvedValue({ success: false, error: "quota exceeded" });
    const storage = {
      getProfileByUserId: vi.fn().mockResolvedValue({ id: "profile-1", role: "Admin" }),
      getClientById: vi.fn().mockResolvedValue({ id: "client-1", agencyId: "agency-1", companyName: "Acme" }),
    } as any;
    const service = new AiChatService(storage, { executeWithSchema } as any);

    const result = await service.analyzeData("user-1", {
      contextData: { clientId: "client-1" },
      question: "What changed?",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
    expect(result.error).toBe("quota exceeded");
  });

  it("creates initiative with draft status for admin request-action", async () => {
    const storage = {
      getProfileByUserId: vi.fn().mockResolvedValue({ id: "profile-1", role: "Admin" }),
      getClientById: vi.fn().mockResolvedValue({ id: "client-1" }),
      createInitiative: vi.fn().mockResolvedValue({ id: "initiative-1" }),
    } as any;

    const service = new AiChatService(storage, { executeWithSchema: vi.fn() } as any);

    const result = await service.requestAction("user-1", {
      title: "Improve paid search",
      observation: "High CPC",
      proposedAction: "Refine keywords",
      impact: "Medium",
      estimatedCost: 500,
      triggerMetric: "CPC",
      baselineValue: 12,
      clientId: "client-1",
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(201);
    expect(storage.createInitiative).toHaveBeenCalledWith(
      expect.objectContaining({ status: "Draft", sentToClient: "false" })
    );
  });
});
