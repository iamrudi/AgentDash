import { describe, expect, it, vi } from "vitest";
import { ClientMessageService } from "../server/application/client/client-message-service";

describe("ClientMessageService", () => {
  it("returns 400 when subject/content are missing", async () => {
    const storage = {
      getProfileByUserId: vi.fn().mockResolvedValue({ id: "profile-1" }),
      getClientByProfileId: vi.fn().mockResolvedValue({ id: "client-1" }),
    } as any;
    const logger = { error: vi.fn() };
    const service = new ClientMessageService(storage, logger);

    const result = await service.createMessage("user-1", { subject: "", content: "" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toBe("Subject and content are required");
  });

  it("creates message and keeps success when notification fanout fails", async () => {
    const storage = {
      getProfileByUserId: vi.fn().mockResolvedValue({ id: "profile-1", fullName: "Client User" }),
      getClientByProfileId: vi.fn().mockResolvedValue({
        id: "client-1",
        companyName: "Acme",
        agencyId: "agency-1",
      }),
      createMessage: vi.fn().mockResolvedValue({ id: "msg-1" }),
      getAllUsersWithProfiles: vi.fn().mockResolvedValue([{ id: "admin-1", profile: { role: "Admin" } }]),
      createNotification: vi.fn().mockRejectedValue(new Error("notify fail")),
    } as any;
    const logger = { error: vi.fn() };
    const service = new ClientMessageService(storage, logger);

    const result = await service.createMessage("user-1", {
      subject: "Need update",
      content: "Please share status",
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(201);
    expect(storage.createMessage).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("sends notification only to assigned account manager when configured", async () => {
    const storage = {
      getProfileByUserId: vi.fn().mockResolvedValue({ id: "profile-1", fullName: "Client User" }),
      getClientByProfileId: vi.fn().mockResolvedValue({
        id: "client-1",
        companyName: "Acme",
        agencyId: "agency-1",
        accountManagerProfileId: "admin-profile-2",
      }),
      createMessage: vi.fn().mockResolvedValue({ id: "msg-1" }),
      getAllUsersWithProfiles: vi.fn().mockResolvedValue([
        { id: "admin-user-1", profile: { id: "admin-profile-1", role: "Admin" } },
        { id: "admin-user-2", profile: { id: "admin-profile-2", role: "Admin" } },
      ]),
      createNotification: vi.fn().mockResolvedValue({ id: "notif-1" }),
    } as any;
    const logger = { error: vi.fn() };
    const service = new ClientMessageService(storage, logger);

    const result = await service.createMessage("user-1", {
      subject: "Need update",
      content: "Please share status",
    });

    expect(result.ok).toBe(true);
    expect(storage.createNotification).toHaveBeenCalledTimes(1);
    expect(storage.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-user-2",
      })
    );
  });
});
