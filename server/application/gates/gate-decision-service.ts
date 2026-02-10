import type { IStorage } from "../../storage";
import type { RequestContext } from "../../middleware/request-context";
import {
  GateDecisionRequestSchema,
  type GateDecisionRequest,
} from "../../domain/gates/schemas";

export interface GateDecisionResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  errors?: unknown;
}

export class GateDecisionService {
  constructor(private storage: IStorage) {}

  async recordDecision(
    ctx: RequestContext,
    payload: GateDecisionRequest
  ): Promise<GateDecisionResult<unknown>> {
    if (!ctx.agencyId) {
      return { ok: false, status: 403, error: "Agency context required" };
    }

    const parsed = GateDecisionRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        status: 400,
        error: "Invalid payload",
        errors: parsed.error.errors,
      };
    }

    const data = parsed.data;

    const tenantOk = await this.verifyTenant(ctx.agencyId, data.targetType, data.targetId);
    if (!tenantOk) {
      return { ok: false, status: 403, error: "Access denied" };
    }

    const record = await this.storage.createGateDecision({
      agencyId: ctx.agencyId,
      gateType: data.gateType,
      decision: data.decision,
      rationale: data.rationale,
      targetType: data.targetType,
      targetId: data.targetId,
      actorId: ctx.userId,
    } as any);

    if (this.storage.createAuditLog) {
      try {
        await this.storage.createAuditLog({
          userId: ctx.userId,
          action: "gate_decision.create",
          resourceType: "gate_decision",
          resourceId: record.id,
          details: {
            gateType: data.gateType,
            decision: data.decision,
            targetType: data.targetType,
            targetId: data.targetId,
            metadata: data.metadata,
          },
          ipAddress: ctx.ip,
          userAgent: ctx.userAgent,
        });
      } catch {
        // non-blocking audit
      }
    }

    return { ok: true, status: 201, data: record };
  }

  private async verifyTenant(
    agencyId: string,
    targetType: GateDecisionRequest["targetType"],
    targetId: string
  ): Promise<boolean> {
    switch (targetType) {
      case "opportunity_artifact": {
        const artifact = await this.storage.getOpportunityArtifactById(targetId);
        return Boolean(artifact && artifact.agencyId === agencyId);
      }
      case "initiative": {
        const initiative = await this.storage.getInitiativeById(targetId);
        if (!initiative) return false;
        const client = await this.storage.getClientById(initiative.clientId);
        return Boolean(client && client.agencyId === agencyId);
      }
      case "execution_output": {
        const output = await this.storage.getExecutionOutputById?.(targetId);
        if (!output) return false;
        const initiative = await this.storage.getInitiativeById(output.initiativeId);
        if (!initiative) return false;
        const client = await this.storage.getClientById(initiative.clientId);
        return Boolean(client && client.agencyId === agencyId);
      }
      case "outcome_review": {
        const review = await this.storage.getOutcomeReviewById?.(targetId);
        if (!review) return false;
        const initiative = await this.storage.getInitiativeById(review.initiativeId);
        if (!initiative) return false;
        const client = await this.storage.getClientById(initiative.clientId);
        return Boolean(client && client.agencyId === agencyId);
      }
      case "learning_artifact": {
        const learning = await this.storage.getLearningArtifactById?.(targetId);
        if (!learning) return false;
        const initiative = await this.storage.getInitiativeById(learning.initiativeId);
        if (!initiative) return false;
        const client = await this.storage.getClientById(initiative.clientId);
        return Boolean(client && client.agencyId === agencyId);
      }
      default:
        return false;
    }
  }
}
