import type { IStorage } from "../../storage";

export interface NotificationResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class NotificationService {
  constructor(private readonly storage: IStorage) {}

  async listByUser(userId: string, archived: unknown): Promise<NotificationResult<unknown>> {
    const isArchived = archived === "true";
    const notifications = await this.storage.getNotificationsByUserId(userId, isArchived);
    return { ok: true, status: 200, data: notifications };
  }

  async unreadCount(userId: string): Promise<NotificationResult<{ count: number }>> {
    const count = await this.storage.getUnreadNotificationCount(userId);
    return { ok: true, status: 200, data: { count } };
  }

  async markRead(userId: string, notificationId: string): Promise<NotificationResult<undefined>> {
    await this.storage.markNotificationAsRead(notificationId, userId);
    return { ok: true, status: 204 };
  }

  async archive(userId: string, notificationId: string): Promise<NotificationResult<undefined>> {
    await this.storage.archiveNotification(notificationId, userId);
    return { ok: true, status: 204 };
  }

  async markAllRead(userId: string): Promise<NotificationResult<undefined>> {
    await this.storage.markAllNotificationsAsRead(userId);
    return { ok: true, status: 204 };
  }
}
