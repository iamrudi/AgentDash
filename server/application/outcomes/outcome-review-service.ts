import type { IStorage } from "../../storage";

export class OutcomeReviewService {
  constructor(private readonly storage: IStorage) {}

  async createOutcome(
    initiativeId: string,
    data: {
      outcomeSummary?: string;
      kpiDelta?: Record<string, unknown>;
      qualitativeFeedback?: Record<string, unknown>;
    }
  ): Promise<{ ok: boolean; status: number; data?: unknown; error?: string }> {
    const acceptance = await this.storage.getLatestGateDecisionForTarget(
      "initiative",
      initiativeId,
      "acceptance"
    );
    if (!acceptance || acceptance.decision !== "approve") {
      return {
        ok: false,
        status: 400,
        error: "Acceptance must be approved before outcome review",
      };
    }

    const record = await this.storage.createOutcomeReview({
      initiativeId,
      outcomeSummary: data.outcomeSummary,
      kpiDelta: data.kpiDelta,
      qualitativeFeedback: data.qualitativeFeedback,
    } as any);

    return { ok: true, status: 201, data: record };
  }
}
