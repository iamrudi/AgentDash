import { describe, expect, it } from "vitest";
import {
  assertAcceptanceApproved,
  assertOpportunityApproved,
  assertOutcomeReviewed,
  assertSkuFrozen,
  canCaptureLearning,
} from "../server/control/gate-service";

describe("Gate progression", () => {
  it("blocks initiative creation without opportunity approval", () => {
    expect(() => assertOpportunityApproved({ gateType: "opportunity", decision: "reject" }))
      .toThrow("Opportunity must be approved before initiative creation");
  });

  it("blocks execution without SKU freeze", () => {
    expect(() => assertSkuFrozen({ productSku: "sku-1", executionSkus: [], frozenAt: null }))
      .toThrow("SKU composition must be frozen before execution");
  });

  it("blocks release without acceptance approval", () => {
    expect(() => assertAcceptanceApproved({ gateType: "acceptance", decision: "defer" }))
      .toThrow("Acceptance gate must approve outputs before release");
  });

  it("blocks learning without outcome review", () => {
    expect(() => assertOutcomeReviewed({ outcomeSummary: "" }))
      .toThrow("Outcome review must be completed before learning writeback");
  });

  it("allows learning only when prerequisites are met", () => {
    expect(canCaptureLearning({ opportunityApproved: true, skuFrozen: true, outcomeReviewed: true })).toBe(true);
    expect(canCaptureLearning({ opportunityApproved: false, skuFrozen: true, outcomeReviewed: true })).toBe(false);
  });
});
