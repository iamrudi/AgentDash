import { describe, expect, it, vi } from "vitest";
import { ClientReadService } from "../server/application/client/client-read-service";

describe("ClientReadService", () => {
  it("returns 404 when client profile is missing", async () => {
    const storage = {
      getProfileByUserId: vi.fn().mockResolvedValue({ id: "profile-1" }),
      getClientByProfileId: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new ClientReadService(storage);

    const result = await service.profile("user-1");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe("Client record not found");
  });

  it("returns default notification counts when client is missing", async () => {
    const storage = {
      getProfileByUserId: vi.fn().mockResolvedValue({ id: "profile-1" }),
      getClientByProfileId: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new ClientReadService(storage);

    const result = await service.notificationCounts("user-1");

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ unreadMessages: 0, newRecommendations: 0 });
  });
});
