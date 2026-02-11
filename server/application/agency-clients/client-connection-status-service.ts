import type { IStorage } from "../../storage";

type DataForSeoSource = "client" | "agency" | undefined;

export interface ClientConnectionStatusResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class ClientConnectionStatusService {
  constructor(private readonly storage: IStorage) {}

  private async safeGetIntegrationByClientId(clientId: string, serviceName: string) {
    try {
      return await this.storage.getIntegrationByClientId(clientId, serviceName);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Decryption failed")) {
        console.error(`${serviceName} integration decryption failed - likely encryption key mismatch:`, error.message);
        return undefined;
      }
      throw error;
    }
  }

  private async safeGetAllIntegrationsByClientId(clientId: string) {
    try {
      return await this.storage.getAllIntegrationsByClientId(clientId);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Decryption failed")) {
        console.error(
          "Client integrations decryption failed - likely encryption key mismatch:",
          error.message
        );
        return [];
      }
      throw error;
    }
  }

  async getConnectionStatus(params: {
    clientId: string;
    agencyId?: string;
  }): Promise<ClientConnectionStatusResult<unknown>> {
    const ga4Integration = await this.safeGetIntegrationByClientId(params.clientId, "GA4");
    const gscIntegration = await this.safeGetIntegrationByClientId(params.clientId, "GSC");
    const clientIntegrations = await this.safeGetAllIntegrationsByClientId(params.clientId);

    const dataForSeoClientIntegration = clientIntegrations.find(
      (i: any) => i.serviceName === "DataForSEO"
    );

    let dataForSeoConnected = false;
    let dataForSeoSource: DataForSeoSource;

    if (dataForSeoClientIntegration) {
      dataForSeoConnected = true;
      dataForSeoSource = "client";
    } else if (params.agencyId) {
      const agencyIntegration = await this.storage.getAgencyIntegration(params.agencyId, "DataForSEO");
      if (agencyIntegration) {
        const hasAccess = await this.storage.hasClientAccess(agencyIntegration.id, params.clientId);
        if (hasAccess) {
          dataForSeoConnected = true;
          dataForSeoSource = "agency";
        }
      }
    }

    return {
      ok: true,
      status: 200,
      data: {
        ga4: {
          connected: !!ga4Integration?.accessToken,
          lastSync: ga4Integration?.updatedAt
            ? new Date(ga4Integration.updatedAt).toLocaleString()
            : undefined,
        },
        gsc: {
          connected: !!gscIntegration?.accessToken,
          lastSync: gscIntegration?.updatedAt
            ? new Date(gscIntegration.updatedAt).toLocaleString()
            : undefined,
        },
        dataForSEO: {
          connected: dataForSeoConnected,
          source: dataForSeoSource,
        },
      },
    };
  }
}
