import { z } from "zod";
import type { IStorage } from "../../storage";
import type { RequestContext } from "../../middleware/request-context";

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
) => Promise<{
  signalId: string;
  isDuplicate: boolean;
  workflowsTriggered: number;
  executions: unknown[];
}>;

export interface RecommendationRequestResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class RecommendationRequestService {
  constructor(
    private readonly storage: IStorage,
    private readonly emitSignal: EmitSignal
  ) {}

  async requestRecommendations(
    ctx: RequestContext,
    clientId: string,
    payload: unknown
  ): Promise<RecommendationRequestResult<unknown>> {
    const parsed = generateRecommendationsSchema.safeParse(payload);
    if (!parsed.success) {
      return { ok: false, status: 400, error: parsed.error.errors[0]?.message || "Invalid payload" };
    }
    if (!ctx.agencyId || !ctx.userId) {
      return { ok: false, status: 400, error: "Invalid request context" };
    }

    const signalResult = await this.emitSignal(this.storage, {
      agencyId: ctx.agencyId,
      clientId,
      updates: {},
      actorId: ctx.userId,
      origin: "agency.recommendations.request",
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
    };
  }
}
