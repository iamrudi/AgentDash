import type { IStorage } from "../../storage";
import type { RequestContext } from "../../middleware/request-context";
import {
  SkuCompositionRequestSchema,
  type SkuCompositionRequest,
} from "../../domain/sku/schemas";

export interface SkuCompositionResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  errors?: unknown;
}

export class SkuCompositionService {
  constructor(private storage: IStorage) {}

  async getComposition(
    ctx: RequestContext,
    initiativeId: string
  ): Promise<SkuCompositionResult<unknown>> {
    if (!ctx.agencyId) {
      return { ok: false, status: 403, error: "Agency context required" };
    }

    const record = await this.storage.getSkuCompositionByInitiativeId(initiativeId);
    if (!record) {
      return { ok: false, status: 404, error: "SKU composition not found" };
    }

    return { ok: true, status: 200, data: record };
  }

  async createComposition(
    ctx: RequestContext,
    initiativeId: string,
    payload: SkuCompositionRequest
  ): Promise<SkuCompositionResult<unknown>> {
    if (!ctx.agencyId) {
      return { ok: false, status: 403, error: "Agency context required" };
    }

    const parsed = SkuCompositionRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        status: 400,
        error: "Invalid payload",
        errors: parsed.error.errors,
      };
    }

    const existing = await this.storage.getSkuCompositionByInitiativeId(initiativeId);
    if (existing) {
      return { ok: false, status: 409, error: "SKU composition already exists for this initiative" };
    }

    const record = await this.storage.createSkuComposition({
      initiativeId,
      productSku: parsed.data.productSku,
      executionSkus: parsed.data.executionSkus,
    } as any);

    if (this.storage.createAuditLog) {
      try {
        await this.storage.createAuditLog({
          userId: ctx.userId,
          action: "sku_composition.create",
          resourceType: "sku_composition",
          resourceId: record.id,
          details: { initiativeId },
          ipAddress: ctx.ip,
          userAgent: ctx.userAgent,
        });
      } catch {
        // non-blocking audit
      }
    }

    return { ok: true, status: 201, data: record };
  }

  async freezeComposition(
    ctx: RequestContext,
    initiativeId: string
  ): Promise<SkuCompositionResult<unknown>> {
    if (!ctx.agencyId) {
      return { ok: false, status: 403, error: "Agency context required" };
    }

    const existing = await this.storage.getSkuCompositionByInitiativeId(initiativeId);
    if (!existing) {
      return { ok: false, status: 404, error: "SKU composition not found" };
    }

    if (existing.frozenAt) {
      return { ok: false, status: 409, error: "SKU composition is already frozen" };
    }

    const record = await this.storage.freezeSkuComposition(initiativeId);
    if (!record) {
      return { ok: false, status: 500, error: "Failed to freeze SKU composition" };
    }

    if (this.storage.createAuditLog) {
      try {
        await this.storage.createAuditLog({
          userId: ctx.userId,
          action: "sku_composition.freeze",
          resourceType: "sku_composition",
          resourceId: record.id,
          details: { initiativeId },
          ipAddress: ctx.ip,
          userAgent: ctx.userAgent,
        });
      } catch {
        // non-blocking audit
      }
    }

    return { ok: true, status: 200, data: record };
  }
}
