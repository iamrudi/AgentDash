import type { IStorage } from "../../storage";

export interface AgencyInitiativeResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class AgencyInitiativeService {
  constructor(private readonly storage: IStorage) {}

  async markResponsesViewed(): Promise<AgencyInitiativeResult<undefined>> {
    await this.storage.markInitiativeResponsesViewed();
    return { ok: true, status: 204 };
  }
}
