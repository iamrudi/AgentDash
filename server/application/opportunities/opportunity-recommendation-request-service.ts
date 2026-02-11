import type { IStorage } from "../../storage";
import type { RequestContext } from "../../middleware/request-context";
import type { ClientRecordSignalResult } from "../../clients/client-record-signal";

type EmitSignal = (
  storage: IStorage,
  payload: {
    agencyId: string;
    clientId: string;
    updates: Record<string, never>;
    actorId: string;
    origin: string;
    reason: string;
  }
) => Promise<ClientRecordSignalResult>;

export interface OpportunityRecommendationRequestResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class OpportunityRecommendationRequestService {
  constructor(private readonly storage: IStorage, private readonly emitSignal: EmitSignal) {}

  async requestRecommendations(
    ctx: RequestContext,
    clientId: string
  ): Promise<OpportunityRecommendationRequestResult<unknown>> {
    if (!ctx.agencyId || !ctx.userId) {
      return { ok: false, status: 400, error: "Invalid request context" };
    }

    const signalResult = await this.emitSignal(this.storage, {
      agencyId: ctx.agencyId,
      clientId,
      updates: {},
      actorId: ctx.userId,
      origin: "opportunities.ai_generate",
      reason: "manual_recommendations",
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
    };
  }
}
