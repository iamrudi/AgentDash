import { db } from "../../db";
import { agencySettings } from "@shared/schema";
import { eq } from "drizzle-orm";
import { encrypt } from "../../lib/encryption";
import { fetchLinkedInData, getLinkedInStatus } from "../../lib/linkedin";

export interface LinkedinAgencyResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class LinkedinAgencyService {
  async getStatus(agencyId?: string): Promise<LinkedinAgencyResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 400, data: { connected: false, error: "Agency ID not found" } };
    }
    try {
      const status = await getLinkedInStatus(agencyId);
      return { ok: true, status: 200, data: status };
    } catch (error: any) {
      return {
        ok: false,
        status: 500,
        data: { connected: false, error: error.message || "Failed to check LinkedIn status" },
      };
    }
  }

  async connect(
    agencyId: string | undefined,
    accessToken: unknown,
    organizationId: unknown
  ): Promise<LinkedinAgencyResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 400, data: { error: "Agency ID not found" } };
    }
    if (!accessToken || !organizationId || typeof accessToken !== "string" || typeof organizationId !== "string") {
      return { ok: false, status: 400, data: { error: "Access token and organization ID are required" } };
    }

    try {
      const { encrypted, iv, authTag } = encrypt(accessToken);

      const existing = await db
        .select()
        .from(agencySettings)
        .where(eq(agencySettings.agencyId, agencyId))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(agencySettings)
          .set({
            linkedinAccessToken: encrypted,
            linkedinAccessTokenIv: iv,
            linkedinAccessTokenAuthTag: authTag,
            linkedinOrganizationId: organizationId,
            linkedinConnectedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(agencySettings.agencyId, agencyId));
      } else {
        await db
          .insert(agencySettings)
          .values({
            agencyId,
            linkedinAccessToken: encrypted,
            linkedinAccessTokenIv: iv,
            linkedinAccessTokenAuthTag: authTag,
            linkedinOrganizationId: organizationId,
            linkedinConnectedAt: new Date(),
          });
      }

      return { ok: true, status: 200, data: { success: true, message: "LinkedIn connected successfully" } };
    } catch (error: any) {
      return { ok: false, status: 500, data: { error: error.message || "Failed to connect LinkedIn" } };
    }
  }

  async disconnect(agencyId?: string): Promise<LinkedinAgencyResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 400, data: { error: "Agency ID not found" } };
    }
    try {
      await db
        .update(agencySettings)
        .set({
          linkedinAccessToken: null,
          linkedinAccessTokenIv: null,
          linkedinAccessTokenAuthTag: null,
          linkedinOrganizationId: null,
          linkedinConnectedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(agencySettings.agencyId, agencyId));

      return { ok: true, status: 200, data: { success: true, message: "LinkedIn disconnected successfully" } };
    } catch (error: any) {
      return { ok: false, status: 500, data: { error: error.message || "Failed to disconnect LinkedIn" } };
    }
  }

  async fetchData(agencyId?: string): Promise<LinkedinAgencyResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 400, data: { error: "Agency ID not found" } };
    }
    try {
      const data = await fetchLinkedInData(agencyId);
      return { ok: true, status: 200, data };
    } catch (error: any) {
      return { ok: false, status: 500, data: { message: error.message || "Failed to fetch LinkedIn data" } };
    }
  }
}
