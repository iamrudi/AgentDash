import type { IStorage } from "../../storage";
import { canCaptureLearning } from "../../control/gate-service";

export class LearningArtifactService {
  constructor(private readonly storage: IStorage) {}

  async createLearning(
    initiativeId: string,
    data: { learning: string; invalidatedAssumptions?: string[]; confidence?: string }
  ): Promise<{ ok: boolean; status: number; data?: unknown; error?: string }> {
    const initiative = await this.storage.getInitiativeById(initiativeId);
    if (!initiative) {
      return { ok: false, status: 404, error: "Initiative not found" };
    }

    if (!initiative.opportunityArtifactId) {
      return { ok: false, status: 400, error: "Initiative is missing opportunity artifact link" };
    }

    const opportunityGate = await this.storage.getLatestGateDecisionForTarget(
      "opportunity_artifact",
      initiative.opportunityArtifactId,
      "opportunity"
    );
    const sku = await this.storage.getSkuCompositionByInitiativeId(initiativeId);
    const outcome = await this.storage.getOutcomeReviewByInitiativeId(initiativeId);

    const canWrite = canCaptureLearning({
      opportunityApproved: Boolean(opportunityGate && opportunityGate.decision === "approve"),
      skuFrozen: Boolean(sku?.frozenAt),
      outcomeReviewed: Boolean(outcome?.outcomeSummary),
    });

    if (!canWrite) {
      return {
        ok: false,
        status: 400,
        error: "Learning can only be captured after opportunity approval, SKU freeze, and outcome review",
      };
    }

    const record = await this.storage.createLearningArtifact({
      initiativeId,
      learning: data.learning,
      invalidatedAssumptions: data.invalidatedAssumptions,
      confidence: data.confidence,
    } as any);

    return { ok: true, status: 201, data: record };
  }
}
