import type { IStorage } from "../../storage";

export interface SuperadminReadResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class SuperadminReadService {
  constructor(private storage: IStorage) {}

  async listUsers(): Promise<SuperadminReadResult<unknown>> {
    const users = await this.storage.getAllUsersForSuperAdmin();
    return { ok: true, status: 200, data: users };
  }

  async listAgencies(): Promise<SuperadminReadResult<unknown>> {
    const agencies = await this.storage.getAllAgenciesForSuperAdmin();
    return { ok: true, status: 200, data: agencies };
  }

  async listClients(): Promise<SuperadminReadResult<unknown>> {
    const clients = await this.storage.getAllClientsForSuperAdmin();
    return { ok: true, status: 200, data: clients };
  }

  async listRecommendations(): Promise<SuperadminReadResult<unknown>> {
    const allInitiatives = await this.storage.getAllInitiatives();
    const allAgencies = await this.storage.getAllAgenciesForSuperAdmin();
    const agencyNameById = new Map(allAgencies.map((agency: any) => [agency.id, agency.name]));

    const initiativesWithClients = await Promise.all(
      allInitiatives.map(async (init: any) => {
        const client = await this.storage.getClientById(init.clientId);
        const agencyName = client?.agencyId ? agencyNameById.get(client.agencyId) : undefined;
        return { ...init, client, agencyName };
      })
    );

    return { ok: true, status: 200, data: initiativesWithClients };
  }

  async listAuditLogs(limit: unknown, offset: unknown): Promise<SuperadminReadResult<unknown>> {
    const parsedLimit = this.parseIntegerParam(limit, 100);
    const parsedOffset = this.parseIntegerParam(offset, 0);
    if (parsedLimit === null || parsedOffset === null) {
      return { ok: false, status: 400, error: "limit and offset must be integers" };
    }

    const auditLogs = await this.storage.getAuditLogs(parsedLimit, parsedOffset);
    return { ok: true, status: 200, data: auditLogs };
  }

  private parseIntegerParam(value: unknown, fallback: number): number | null {
    if (value === undefined || value === null || value === "") {
      return fallback;
    }

    const candidate = Array.isArray(value) ? value[0] : value;
    const parsed = Number.parseInt(String(candidate), 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
}
