export type GateType = "opportunity" | "initiative" | "acceptance" | "outcome" | "learning";
export type GateDecision = "approve" | "reject" | "defer";

export interface GateDecisionRecord {
  gateType: GateType;
  decision: GateDecision;
}

export interface SkuCompositionRecord {
  productSku: string;
  executionSkus: string[];
  frozenAt?: Date | string | null;
}

export interface OutcomeReviewRecord {
  outcomeSummary?: string | null;
}

export function assertOpportunityApproved(decision: GateDecisionRecord): void {
  if (decision.gateType !== "opportunity" || decision.decision !== "approve") {
    throw new Error("Opportunity must be approved before initiative creation");
  }
}

export function assertSkuFrozen(sku: SkuCompositionRecord): void {
  if (!sku.frozenAt || sku.executionSkus.length === 0) {
    throw new Error("SKU composition must be frozen before execution");
  }
}

export function assertAcceptanceApproved(decision: GateDecisionRecord): void {
  if (decision.gateType !== "acceptance" || decision.decision !== "approve") {
    throw new Error("Acceptance gate must approve outputs before release");
  }
}

export function assertOutcomeReviewed(review: OutcomeReviewRecord): void {
  if (!review.outcomeSummary) {
    throw new Error("Outcome review must be completed before learning writeback");
  }
}

export function canCaptureLearning(input: {
  opportunityApproved: boolean;
  skuFrozen: boolean;
  outcomeReviewed: boolean;
}): boolean {
  return input.opportunityApproved && input.skuFrozen && input.outcomeReviewed;
}
