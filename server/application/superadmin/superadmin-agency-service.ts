import { updateAgencySettingSchema } from "@shared/schema";
import { agencySettings } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import type { IStorage } from "../../storage";

interface AgencySettingsRow {
  agencyId: string;
  aiProvider: string;
  updatedAt?: Date | string | null;
}

interface SuperadminAgencyDeps {
  getAgencySettings: (agencyId: string) => Promise<AgencySettingsRow | undefined>;
  insertAgencySettings: (agencyId: string, aiProvider: string) => Promise<AgencySettingsRow>;
  updateAgencySettings: (agencyId: string, aiProvider: string) => Promise<AgencySettingsRow>;
  invalidateAIProviderCache: (agencyId: string) => Promise<void>;
}

const defaultDeps: SuperadminAgencyDeps = {
  getAgencySettings: async (agencyId) => {
    const { db } = await import("../../db");
    const settings = await db
      .select()
      .from(agencySettings)
      .where(eq(agencySettings.agencyId, agencyId))
      .limit(1);
    return settings[0] as AgencySettingsRow | undefined;
  },
  insertAgencySettings: async (agencyId, aiProvider) => {
    const { db } = await import("../../db");
    const [result] = await db
      .insert(agencySettings)
      .values({ agencyId, aiProvider })
      .returning();
    return result as AgencySettingsRow;
  },
  updateAgencySettings: async (agencyId, aiProvider) => {
    const { db } = await import("../../db");
    const [result] = await db
      .update(agencySettings)
      .set({
        aiProvider,
        updatedAt: sql`now()`,
      })
      .where(eq(agencySettings.agencyId, agencyId))
      .returning();
    return result as AgencySettingsRow;
  },
  invalidateAIProviderCache: async (agencyId) => {
    const { invalidateAIProviderCache } = await import("../../ai/provider");
    invalidateAIProviderCache(agencyId);
  },
};

interface AuditEvent {
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: Record<string, unknown>;
}

export interface SuperadminAgencyResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  errors?: unknown;
  auditEvent?: AuditEvent;
}

export class SuperadminAgencyService {
  constructor(private storage: IStorage, private deps: SuperadminAgencyDeps = defaultDeps) {}

  async deleteAgency(agencyId: string): Promise<SuperadminAgencyResult<{ message: string }>> {
    const agency = await this.storage.getAgencyById(agencyId);
    if (!agency) {
      return { ok: false, status: 404, error: "Agency not found" };
    }

    await this.storage.deleteAgency(agencyId);

    return {
      ok: true,
      status: 200,
      data: { message: "Agency deleted successfully" },
      auditEvent: {
        action: "agency.delete",
        resourceType: "agency",
        resourceId: agencyId,
        details: { deletedAgency: agency },
      },
    };
  }

  async deleteClient(clientId: string): Promise<SuperadminAgencyResult<{ message: string }>> {
    const allClients = await this.storage.getAllClientsForSuperAdmin();
    const client = allClients.find((entry) => entry.id === clientId);
    if (!client) {
      return { ok: false, status: 404, error: "Client not found" };
    }

    await this.storage.deleteClient(clientId);

    return {
      ok: true,
      status: 200,
      data: { message: "Client deleted successfully" },
      auditEvent: {
        action: "client.delete",
        resourceType: "client",
        resourceId: clientId,
        details: { deletedClient: client },
      },
    };
  }

  async getAgencySettings(
    agencyId: string
  ): Promise<SuperadminAgencyResult<{ agencyId: string; agencyName: string; aiProvider: string; isDefault: boolean }>> {
    const agencies = await this.storage.getAllAgenciesForSuperAdmin();
    const agency = agencies.find((entry) => entry.id === agencyId);
    if (!agency) {
      return { ok: false, status: 404, error: "Agency not found" };
    }

    const settings = await this.deps.getAgencySettings(agencyId);
    if (!settings) {
      return {
        ok: true,
        status: 200,
        data: {
          agencyId,
          agencyName: agency.name,
          aiProvider: (process.env.AI_PROVIDER?.toLowerCase() || "gemini"),
          isDefault: true,
        },
      };
    }

    return {
      ok: true,
      status: 200,
      data: {
        agencyId,
        agencyName: agency.name,
        aiProvider: settings.aiProvider.toLowerCase(),
        isDefault: false,
      },
    };
  }

  async updateAgencySettings(
    agencyId: string,
    payload: unknown
  ): Promise<SuperadminAgencyResult<Record<string, unknown>>> {
    const validation = updateAgencySettingSchema.safeParse(payload);
    if (!validation.success) {
      return {
        ok: false,
        status: 400,
        error: "Invalid settings data",
        errors: validation.error.errors,
      };
    }

    const agencies = await this.storage.getAllAgenciesForSuperAdmin();
    const agency = agencies.find((entry) => entry.id === agencyId);
    if (!agency) {
      return { ok: false, status: 404, error: "Agency not found" };
    }

    const existing = await this.deps.getAgencySettings(agencyId);
    const result = existing
      ? await this.deps.updateAgencySettings(agencyId, validation.data.aiProvider)
      : await this.deps.insertAgencySettings(agencyId, validation.data.aiProvider);

    await this.deps.invalidateAIProviderCache(agencyId);

    return {
      ok: true,
      status: 200,
      data: {
        ...result,
        agencyName: agency.name,
      },
      auditEvent: {
        action: "agency.settings.update",
        resourceType: "agency",
        resourceId: agencyId,
        details: {
          aiProvider: validation.data.aiProvider,
          agencyName: agency.name,
        },
      },
    };
  }
}
