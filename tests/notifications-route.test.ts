import { describe, expect, it, vi } from "vitest";
import { NotificationService } from "../server/application/notifications/notification-service";
import {
  createNotificationsListHandler,
  createNotificationsUnreadCountHandler,
  createNotificationsMarkReadHandler,
  createNotificationsArchiveHandler,
  createNotificationsMarkAllReadHandler,
} from "../server/routes/notifications";

describe("Notifications route", () => {
  it("delegates notifications list to service", async () => {
    const listByUser = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { listByUser } as unknown as NotificationService;
    const handler = createNotificationsListHandler(service);
    const req = {
      user: { id: "user-1" },
      query: { archived: "true" },
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(listByUser).toHaveBeenCalledWith("user-1", "true");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates unread count to service", async () => {
    const unreadCount = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { count: 2 } });
    const service = { unreadCount } as unknown as NotificationService;
    const handler = createNotificationsUnreadCountHandler(service);
    const req = { user: { id: "user-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(unreadCount).toHaveBeenCalledWith("user-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates mark-read to service", async () => {
    const markRead = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    const service = { markRead } as unknown as NotificationService;
    const handler = createNotificationsMarkReadHandler(service);
    const req = { user: { id: "user-1" }, params: { id: "n1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), send: vi.fn() };

    await handler(req, res);

    expect(markRead).toHaveBeenCalledWith("user-1", "n1");
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("delegates archive to service", async () => {
    const archive = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    const service = { archive } as unknown as NotificationService;
    const handler = createNotificationsArchiveHandler(service);
    const req = { user: { id: "user-1" }, params: { id: "n1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), send: vi.fn() };

    await handler(req, res);

    expect(archive).toHaveBeenCalledWith("user-1", "n1");
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("delegates mark-all-read to service", async () => {
    const markAllRead = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    const service = { markAllRead } as unknown as NotificationService;
    const handler = createNotificationsMarkAllReadHandler(service);
    const req = { user: { id: "user-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), send: vi.fn() };

    await handler(req, res);

    expect(markAllRead).toHaveBeenCalledWith("user-1");
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
