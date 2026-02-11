import type { IStorage } from "../../storage";

export interface ClientReadResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class ClientReadService {
  constructor(private readonly storage: IStorage) {}

  async profile(userId: string): Promise<ClientReadResult<unknown>> {
    const profile = await this.storage.getProfileByUserId(userId);
    const client = profile ? await this.storage.getClientByProfileId(profile.id) : undefined;
    if (!client) {
      return { ok: false, status: 404, error: "Client record not found" };
    }

    return {
      ok: true,
      status: 200,
      data: {
        id: client.id,
        companyName: client.companyName,
      },
    };
  }

  async notificationCounts(userId: string): Promise<ClientReadResult<{ unreadMessages: number; newRecommendations: number }>> {
    const profile = await this.storage.getProfileByUserId(userId);
    const client = profile ? await this.storage.getClientByProfileId(profile.id) : undefined;
    if (!client) {
      return { ok: true, status: 200, data: { unreadMessages: 0, newRecommendations: 0 } };
    }

    const counts = await this.storage.getClientNotificationCounts(client.id);
    return { ok: true, status: 200, data: counts };
  }
}
