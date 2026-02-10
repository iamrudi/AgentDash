import type { IStorage } from "../../storage";

export class ExecutionOutputService {
  constructor(private readonly storage: IStorage) {}

  async createOutput(
    initiativeId: string,
    data: { output?: Record<string, unknown>; metadata?: Record<string, unknown> }
  ): Promise<{ ok: boolean; status: number; data?: unknown; error?: string }> {
    const sku = await this.storage.getSkuCompositionByInitiativeId(initiativeId);
    if (!sku?.frozenAt) {
      return {
        ok: false,
        status: 400,
        error: "SKU composition must be frozen before execution",
      };
    }

    const record = await this.storage.createExecutionOutput({
      initiativeId,
      output: data.output,
      metadata: data.metadata,
    } as any);

    return { ok: true, status: 201, data: record };
  }
}
