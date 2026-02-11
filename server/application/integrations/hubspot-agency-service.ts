import { db } from "../../db";
import { agencySettings } from "@shared/schema";
import { eq } from "drizzle-orm";
import { encrypt } from "../../lib/encryption";
import { fetchHubSpotCRMData, getHubSpotStatus } from "../../lib/hubspot";

export interface HubspotAgencyResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class HubspotAgencyService {
  async getStatus(agencyId?: string): Promise<HubspotAgencyResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 400, data: { connected: false, error: "Agency ID not found" } };
    }
    try {
      const status = await getHubSpotStatus(agencyId);
      return { ok: true, status: 200, data: status };
    } catch (error: any) {
      return {
        ok: false,
        status: 500,
        data: { connected: false, error: error.message || "Failed to check HubSpot status" },
      };
    }
  }

  async connect(agencyId: string | undefined, accessToken: unknown): Promise<HubspotAgencyResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 400, data: { error: "Agency ID not found" } };
    }
    if (!accessToken || typeof accessToken !== "string") {
      return { ok: false, status: 400, data: { error: "Access token is required" } };
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
            hubspotAccessToken: encrypted,
            hubspotAccessTokenIv: iv,
            hubspotAccessTokenAuthTag: authTag,
            hubspotConnectedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(agencySettings.agencyId, agencyId));
      } else {
        await db
          .insert(agencySettings)
          .values({
            agencyId,
            hubspotAccessToken: encrypted,
            hubspotAccessTokenIv: iv,
            hubspotAccessTokenAuthTag: authTag,
            hubspotConnectedAt: new Date(),
          });
      }

      return { ok: true, status: 200, data: { success: true, message: "HubSpot connected successfully" } };
    } catch (error: any) {
      return { ok: false, status: 500, data: { error: error.message || "Failed to connect HubSpot" } };
    }
  }

  async disconnect(agencyId?: string): Promise<HubspotAgencyResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 400, data: { error: "Agency ID not found" } };
    }
    try {
      await db
        .update(agencySettings)
        .set({
          hubspotAccessToken: null,
          hubspotAccessTokenIv: null,
          hubspotAccessTokenAuthTag: null,
          hubspotConnectedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(agencySettings.agencyId, agencyId));

      return { ok: true, status: 200, data: { success: true, message: "HubSpot disconnected successfully" } };
    } catch (error: any) {
      return { ok: false, status: 500, data: { error: error.message || "Failed to disconnect HubSpot" } };
    }
  }

  async fetchData(agencyId?: string): Promise<HubspotAgencyResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 400, data: { error: "Agency ID not found" } };
    }
    try {
      const data = await fetchHubSpotCRMData(agencyId);
      return { ok: true, status: 200, data };
    } catch (error: any) {
      return { ok: false, status: 500, data: { message: error.message || "Failed to fetch HubSpot data" } };
    }
  }
}
