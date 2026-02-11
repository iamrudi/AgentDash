import type { IStorage } from "../../storage";

export interface OpportunityReadResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class OpportunityReadService {
  constructor(private readonly storage: IStorage) {}

  async listByClientId(clientId: string): Promise<OpportunityReadResult<unknown>> {
    const records = await this.storage.getOpportunityArtifactsByClientId(clientId);
    return {
      ok: true,
      status: 200,
      data: records,
    };
  }
}
