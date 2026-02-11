import type { IStorage } from "../../storage";
import type { RequestContext } from "../../middleware/request-context";
import {
  InitiativeIntentRequestSchema,
  type InitiativeIntentRequest,
} from "../../domain/initiatives/schemas";

export interface InitiativeIntentResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  errors?: unknown;
}

export class InitiativeIntentService {
  constructor(private storage: IStorage) {}

  async createIntent(
    ctx: RequestContext,
    initiativeId: string,
    payload: InitiativeIntentRequest
  ): Promise<InitiativeIntentResult<unknown>> {
    if (!ctx.agencyId) {
      return { ok: false, status: 403, error: "Agency context required" };
    }

    const parsed = InitiativeIntentRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        status: 400,
        error: "Invalid payload",
        errors: parsed.error.errors,
      };
    }

    const record = await this.storage.createInitiativeIntent({
      initiativeId,
      intentStatement: parsed.data.intentStatement,
      constraints: parsed.data.constraints,
      successCriteria: parsed.data.successCriteria,
      boundaryConditions: parsed.data.boundaryConditions,
      evaluationHorizon: parsed.data.evaluationHorizon,
    } as any);

    if (this.storage.createAuditLog) {
      try {
        await this.storage.createAuditLog({
          userId: ctx.userId,
          action: "initiative_intent.create",
          resourceType: "initiative_intent",
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

  async getIntentByInitiativeId(
    initiativeId: string
  ): Promise<InitiativeIntentResult<unknown>> {
    const record = await this.storage.getInitiativeIntentByInitiativeId(initiativeId);
    if (!record) {
      return { ok: false, status: 404, error: "Intent not found" };
    }
    return { ok: true, status: 200, data: record };
  }
}
