import { describe, expect, it, vi } from "vitest";
import { NotificationService } from "../server/application/notifications/notification-service";

describe("NotificationService", () => {
  it("lists notifications with archived filter", async () => {
    const storage = {
      getNotificationsByUserId: vi.fn().mockResolvedValue([{ id: "n1" }]),
    } as any;
    const service = new NotificationService(storage);

    const result = await service.listByUser("user-1", "true");

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(storage.getNotificationsByUserId).toHaveBeenCalledWith("user-1", true);
  });

  it("returns unread count", async () => {
    const storage = {
      getUnreadNotificationCount: vi.fn().mockResolvedValue(5),
    } as any;
    const service = new NotificationService(storage);

    const result = await service.unreadCount("user-1");

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ count: 5 });
  });
});
