import type { IStorage } from "../../storage";

export interface AgencyReadResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class AgencyReadService {
  constructor(private readonly storage: IStorage) {}

  async metrics(agencyId: string | undefined): Promise<AgencyReadResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 403, error: "Agency association required" };
    }
    const metrics = await this.storage.getAllMetrics(90, agencyId);
    return { ok: true, status: 200, data: metrics };
  }

  async initiatives(agencyId: string | undefined): Promise<AgencyReadResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 403, error: "Agency association required" };
    }
    const initiatives = await this.storage.getAllInitiatives(agencyId);
    return { ok: true, status: 200, data: initiatives };
  }

  async integrations(agencyId: string | undefined): Promise<AgencyReadResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 403, error: "Agency association required" };
    }
    const integrations = await this.storage.getAllIntegrations(agencyId);
    const safeIntegrations = integrations.map(
      ({
        accessToken,
        refreshToken,
        accessTokenIv,
        refreshTokenIv,
        accessTokenAuthTag,
        refreshTokenAuthTag,
        ...safe
      }) => safe
    );
    return { ok: true, status: 200, data: safeIntegrations };
  }

  async staff(params: { isSuperAdmin?: boolean; agencyId?: string | null }): Promise<AgencyReadResult<unknown>> {
    if (params.isSuperAdmin) {
      const staff = await this.storage.getAllStaff();
      return { ok: true, status: 200, data: staff.map((entry) => ({ id: entry.id, name: entry.fullName })) };
    }

    if (!params.agencyId) {
      return { ok: false, status: 403, error: "Agency association required" };
    }

    const staff = await this.storage.getAllStaff(params.agencyId);
    return { ok: true, status: 200, data: staff.map((entry) => ({ id: entry.id, name: entry.fullName })) };
  }

  async messages(agencyId: string | undefined): Promise<AgencyReadResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 403, error: "Agency association required" };
    }
    const messages = await this.storage.getAllMessages(agencyId);
    return { ok: true, status: 200, data: messages };
  }

  async notificationCounts(agencyId: string | undefined): Promise<AgencyReadResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 403, error: "Agency association required" };
    }
    const counts = await this.storage.getNotificationCounts(agencyId);
    return { ok: true, status: 200, data: counts };
  }
}
