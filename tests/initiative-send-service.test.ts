import { describe, expect, it, vi } from "vitest";
import { InitiativeSendService } from "../server/application/initiatives/initiative-send-service";

describe("InitiativeSendService", () => {
  it("continues when notification and audit writes fail", async () => {
    const storage = {
      sendInitiativeToClient: vi.fn().mockResolvedValue({
        id: "initiative-1",
        clientId: "client-1",
        title: "New Initiative",
      }),
      getClientById: vi.fn().mockResolvedValue({ id: "client-1", profileId: "profile-1" }),
      getProfileById: vi.fn().mockResolvedValue({ id: "profile-1" }),
      createNotification: vi.fn().mockRejectedValue(new Error("notification down")),
      createAuditLog: vi.fn().mockRejectedValue(new Error("audit down")),
    } as any;

    const service = new InitiativeSendService(storage);
    const result = await service.sendInitiative(
      {
        userId: "user-1",
        email: "admin@example.com",
        role: "Admin",
        agencyId: "agency-1",
      },
      "initiative-1"
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(storage.sendInitiativeToClient).toHaveBeenCalledWith("initiative-1");
    expect(storage.createNotification).toHaveBeenCalledTimes(1);
    expect(storage.createAuditLog).toHaveBeenCalledTimes(1);
  });
});
