import type { IStorage } from "../../storage";

interface ClientUserContext {
  userId: string;
  role: string;
  agencyId?: string | null;
}

export interface ClientPortfolioResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class ClientPortfolioService {
  constructor(private readonly storage: IStorage) {}

  async listProjects(ctx: ClientUserContext): Promise<ClientPortfolioResult<unknown>> {
    if (ctx.role === "Admin") {
      if (!ctx.agencyId) {
        return { ok: false, status: 403, error: "Agency association required" };
      }
      const allProjects = await this.storage.getAllProjects(ctx.agencyId);
      const projectsWithClients = await Promise.all(
        allProjects.map(async (project) => {
          const client = await this.storage.getClientById(project.clientId);
          return { ...project, client };
        })
      );
      return { ok: true, status: 200, data: projectsWithClients };
    }

    const profile = await this.storage.getProfileById(ctx.userId);
    const client = await this.storage.getClientByProfileId(profile!.id);
    if (!client) {
      return { ok: true, status: 200, data: [] };
    }

    const projects = await this.storage.getProjectsByClientId(client.id);
    return { ok: true, status: 200, data: projects.map((entry) => ({ ...entry, client })) };
  }

  async listInvoices(ctx: ClientUserContext): Promise<ClientPortfolioResult<unknown>> {
    if (ctx.role === "Admin") {
      if (!ctx.agencyId) {
        return { ok: false, status: 403, error: "Agency association required" };
      }
      const allInvoices = await this.storage.getAllInvoices(ctx.agencyId);
      const invoicesWithClients = await Promise.all(
        allInvoices.map(async (invoice) => {
          const client = await this.storage.getClientById(invoice.clientId);
          return { ...invoice, client };
        })
      );
      return { ok: true, status: 200, data: invoicesWithClients };
    }

    const profile = await this.storage.getProfileById(ctx.userId);
    const client = await this.storage.getClientByProfileId(profile!.id);
    if (!client) {
      return { ok: true, status: 200, data: [] };
    }

    const invoices = await this.storage.getInvoicesByClientId(client.id);
    return { ok: true, status: 200, data: invoices.map((entry) => ({ ...entry, client })) };
  }

  async listInitiatives(ctx: ClientUserContext): Promise<ClientPortfolioResult<unknown>> {
    if (ctx.role === "Admin") {
      if (!ctx.agencyId) {
        return { ok: false, status: 403, error: "Agency association required" };
      }
      const allInitiatives = await this.storage.getAllInitiatives(ctx.agencyId);
      const initiativesWithClients = await Promise.all(
        allInitiatives.map(async (initiative) => {
          const client = await this.storage.getClientById(initiative.clientId);
          return { ...initiative, client };
        })
      );
      return { ok: true, status: 200, data: initiativesWithClients };
    }

    const profile = await this.storage.getProfileById(ctx.userId);
    const client = await this.storage.getClientByProfileId(profile!.id);
    if (!client) {
      return { ok: true, status: 200, data: [] };
    }

    const initiatives = await this.storage.getInitiativesByClientId(client.id);
    return { ok: true, status: 200, data: initiatives.map((entry) => ({ ...entry, client })) };
  }
}
