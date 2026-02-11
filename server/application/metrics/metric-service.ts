import type { IStorage } from "../../storage";

export interface MetricResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class MetricService {
  constructor(private readonly storage: IStorage) {}

  async createMetric(payload: unknown): Promise<MetricResult<unknown>> {
    const metric = await this.storage.createMetric(payload as any);
    return { ok: true, status: 201, data: metric };
  }
}
