import { z } from "zod";
import type { IStorage } from "../../storage";
import type { RequestContext } from "../../middleware/request-context";
import type { ClientRecordSignalResult } from "../../clients/client-record-signal";

const generateRecommendationsSchema = z.object({
  preset: z.enum(["quick-wins", "strategic-growth", "full-audit"]),
  includeCompetitors: z.boolean().default(false),
  competitorDomains: z.array(z.string()).max(5).optional(),
});

type EmitSignal = (
  storage: IStorage,
  payload: {
    agencyId: string;
    clientId: string;
    updates: Record<string, never>;
    actorId: string;
    origin: string;
    reason: string;
    preset: "quick-wins" | "strategic-growth" | "full-audit";
    includeCompetitors: boolean;
    competitorDomains?: string[];
  }
) => Promise<ClientRecordSignalResult>;

interface AuditEvent {
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: Record<string, unknown>;
}

export interface SuperadminRecommendationResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  errors?: unknown;
  auditEvent?: AuditEvent;
}

export class SuperadminRecommendationService {
  constructor(private readonly storage: IStorage, private readonly emitSignal: EmitSignal) {}

  async requestRecommendations(
    ctx: RequestContext,
    clientId: string,
    payload: unknown
  ): Promise<SuperadminRecommendationResult<unknown>> {
    const parsed = generateRecommendationsSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        status: 400,
        error: parsed.error.errors[0]?.message || "Invalid payload",
      };
    }

    if (!ctx.userId) {
      return { ok: false, status: 400, error: "Invalid request context" };
    }

    const client = await this.storage.getClientById(clientId);
    if (!client) {
      return { ok: false, status: 404, error: "Client not found" };
    }

    const signalResult = await this.emitSignal(this.storage, {
      agencyId: client.agencyId,
      clientId,
      updates: {},
      actorId: ctx.userId,
      origin: "superadmin.recommendations.request",
      reason: "manual_recommendations",
      preset: parsed.data.preset,
      includeCompetitors: parsed.data.includeCompetitors,
      competitorDomains: parsed.data.competitorDomains,
    });

    return {
      ok: true,
      status: 202,
      data: {
        success: true,
        message: "Recommendation request routed to workflow engine",
        signalId: signalResult.signalId,
        isDuplicate: signalResult.isDuplicate,
        workflowsTriggered: signalResult.workflowsTriggered,
        executions: signalResult.executions,
      },
      auditEvent: {
        action: "recommendations.generate",
        resourceType: "client",
        resourceId: clientId,
        details: {
          preset: parsed.data.preset,
          clientName: client.companyName,
          signalId: signalResult.signalId,
          workflowsTriggered: signalResult.workflowsTriggered.length,
        },
      },
    };
  }
}
