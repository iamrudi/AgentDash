import path from "path";
import fs from "fs";
import { agencySettings, updateAgencySettingSchema } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import type { IStorage } from "../../storage";

const LOGO_TYPES = ["agencyLogo", "clientLogo", "staffLogo"] as const;
type LogoType = (typeof LOGO_TYPES)[number];

interface AgencySettingsRow {
  agencyId: string;
  aiProvider: string;
  agencyLogo?: string | null;
  clientLogo?: string | null;
  staffLogo?: string | null;
  updatedAt?: Date | string | null;
}

interface AgencySettingsDeps {
  getSettings: (agencyId: string) => Promise<AgencySettingsRow | undefined>;
  insertSettings: (values: Record<string, unknown>) => Promise<AgencySettingsRow>;
  updateSettings: (agencyId: string, values: Record<string, unknown>) => Promise<AgencySettingsRow>;
  invalidateAIProviderCache: (agencyId: string) => Promise<void>;
  fileExists: (targetPath: string) => boolean;
  removeFile: (targetPath: string) => void;
  getCwd: () => string;
}

const defaultDeps: AgencySettingsDeps = {
  getSettings: async (agencyId) => {
    const { db } = await import("../../db");
    const settings = await db.select().from(agencySettings).where(eq(agencySettings.agencyId, agencyId)).limit(1);
    return settings[0] as AgencySettingsRow | undefined;
  },
  insertSettings: async (values) => {
    const { db } = await import("../../db");
    const [result] = await db.insert(agencySettings).values(values as any).returning();
    return result as AgencySettingsRow;
  },
  updateSettings: async (agencyId, values) => {
    const { db } = await import("../../db");
    const [result] = await db
      .update(agencySettings)
      .set(values as any)
      .where(eq(agencySettings.agencyId, agencyId))
      .returning();
    return result as AgencySettingsRow;
  },
  invalidateAIProviderCache: async (agencyId) => {
    const { invalidateAIProviderCache } = await import("../../ai/provider");
    invalidateAIProviderCache(agencyId);
  },
  fileExists: (targetPath) => fs.existsSync(targetPath),
  removeFile: (targetPath) => fs.unlinkSync(targetPath),
  getCwd: () => process.cwd(),
};

export interface AgencySettingsResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  errors?: unknown;
}

export class AgencySettingsService {
  constructor(private readonly storage: IStorage, private readonly deps: AgencySettingsDeps = defaultDeps) {}

  async getSettings(user: { isSuperAdmin?: boolean; agencyId?: string | null }): Promise<AgencySettingsResult<unknown>> {
    if (user.isSuperAdmin && !user.agencyId) {
      return {
        ok: true,
        status: 200,
        data: {
          aiProvider: process.env.AI_PROVIDER?.toLowerCase() || "gemini",
          isDefault: true,
          isSuperAdminGlobal: true,
        },
      };
    }

    if (!user.agencyId) {
      return { ok: false, status: 403, error: "Agency association required" };
    }

    const settings = await this.deps.getSettings(user.agencyId);
    if (!settings) {
      return {
        ok: true,
        status: 200,
        data: {
          aiProvider: process.env.AI_PROVIDER?.toLowerCase() || "gemini",
          isDefault: true,
        },
      };
    }

    return {
      ok: true,
      status: 200,
      data: {
        aiProvider: settings.aiProvider.toLowerCase(),
        isDefault: false,
      },
    };
  }

  async updateSettings(
    user: { isSuperAdmin?: boolean; agencyId?: string | null },
    payload: unknown
  ): Promise<AgencySettingsResult<unknown>> {
    const validation = updateAgencySettingSchema.safeParse(payload);
    if (!validation.success) {
      return {
        ok: false,
        status: 400,
        error: "Invalid settings data",
        errors: validation.error.errors,
      };
    }

    const { aiProvider } = validation.data;

    if (user.isSuperAdmin && !user.agencyId) {
      return {
        ok: true,
        status: 200,
        data: {
          aiProvider,
          isDefault: true,
          isSuperAdminGlobal: true,
          message:
            "SuperAdmins can view AI provider preferences, but changing the global default requires updating the AI_PROVIDER environment variable. To change settings for a specific agency, please log in as an Admin of that agency.",
        },
      };
    }

    if (!user.agencyId) {
      return { ok: false, status: 403, error: "Agency association required" };
    }

    const existing = await this.deps.getSettings(user.agencyId);
    const result = existing
      ? await this.deps.updateSettings(user.agencyId, { aiProvider, updatedAt: sql`now()` })
      : await this.deps.insertSettings({ agencyId: user.agencyId, aiProvider });

    await this.deps.invalidateAIProviderCache(user.agencyId);
    return { ok: true, status: 200, data: result };
  }

  async uploadLogo(
    user: { agencyId?: string | null },
    file: { path: string; filename: string } | undefined,
    type: unknown
  ): Promise<AgencySettingsResult<unknown>> {
    if (!user.agencyId) {
      return { ok: false, status: 403, error: "Agency association required" };
    }

    if (!file) {
      return { ok: false, status: 400, error: "No file uploaded" };
    }

    if (typeof type !== "string" || !LOGO_TYPES.includes(type as LogoType)) {
      if (this.deps.fileExists(file.path)) {
        this.deps.removeFile(file.path);
      }
      return {
        ok: false,
        status: 400,
        error: "Invalid logo type. Must be agencyLogo, clientLogo, or staffLogo",
      };
    }

    try {
      const logoType = type as LogoType;
      const logoUrl = `/uploads/logos/${file.filename}`;
      const existing = await this.deps.getSettings(user.agencyId);

      if (!existing) {
        const created = await this.deps.insertSettings({
          agencyId: user.agencyId,
          aiProvider: "gemini",
          [logoType]: logoUrl,
        });
        return {
          ok: true,
          status: 200,
          data: {
            message: "Logo uploaded successfully",
            logoUrl,
            settings: created,
          },
        };
      }

      const oldLogoUrl = existing[logoType] as string | null | undefined;
      if (oldLogoUrl) {
        const oldLogoPath = path.join(this.deps.getCwd(), oldLogoUrl.replace(/^\/+/, ""));
        if (this.deps.fileExists(oldLogoPath)) {
          this.deps.removeFile(oldLogoPath);
        }
      }

      const updated = await this.deps.updateSettings(user.agencyId, {
        [logoType]: logoUrl,
        updatedAt: sql`now()`,
      });

      return {
        ok: true,
        status: 200,
        data: {
          message: "Logo uploaded successfully",
          logoUrl,
          settings: updated,
        },
      };
    } catch (error: any) {
      if (this.deps.fileExists(file.path)) {
        this.deps.removeFile(file.path);
      }
      return { ok: false, status: 500, error: error?.message || "Failed to upload logo" };
    }
  }

  async deleteLogo(
    user: { agencyId?: string | null },
    type: unknown
  ): Promise<AgencySettingsResult<unknown>> {
    if (!user.agencyId) {
      return { ok: false, status: 403, error: "Agency association required" };
    }

    if (typeof type !== "string" || !LOGO_TYPES.includes(type as LogoType)) {
      return {
        ok: false,
        status: 400,
        error: "Invalid logo type. Must be agencyLogo, clientLogo, or staffLogo",
      };
    }

    const logoType = type as LogoType;
    const existing = await this.deps.getSettings(user.agencyId);
    if (!existing) {
      return { ok: false, status: 404, error: "Agency settings not found" };
    }

    const logoUrl = existing[logoType] as string | null | undefined;
    if (logoUrl) {
      const logoPath = path.join(this.deps.getCwd(), logoUrl.replace(/^\/+/, ""));
      if (this.deps.fileExists(logoPath)) {
        this.deps.removeFile(logoPath);
      }
    }

    const updated = await this.deps.updateSettings(user.agencyId, {
      [logoType]: null,
      updatedAt: sql`now()`,
    });

    return {
      ok: true,
      status: 200,
      data: {
        message: "Logo removed successfully",
        settings: updated,
      },
    };
  }

  async getBranding(user: { agencyId?: string | null; clientId?: string | null }): Promise<AgencySettingsResult<unknown>> {
    let agencyId = user.agencyId;

    if (!agencyId && user.clientId) {
      const client = await this.storage.getClientById(user.clientId);
      agencyId = client?.agencyId;
    }

    if (!agencyId) {
      return {
        ok: true,
        status: 200,
        data: {
          agencyLogo: null,
          clientLogo: null,
          staffLogo: null,
        },
      };
    }

    const settings = await this.deps.getSettings(agencyId);
    if (!settings) {
      return {
        ok: true,
        status: 200,
        data: {
          agencyLogo: null,
          clientLogo: null,
          staffLogo: null,
        },
      };
    }

    return {
      ok: true,
      status: 200,
      data: {
        agencyLogo: settings.agencyLogo ?? null,
        clientLogo: settings.clientLogo ?? null,
        staffLogo: settings.staffLogo ?? null,
      },
    };
  }
}
