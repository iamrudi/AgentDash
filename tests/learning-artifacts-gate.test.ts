import { beforeEach, describe, expect, it, vi } from "vitest";

const storageMock = {
  getInitiativeById: vi.fn(),
  getLatestGateDecisionForTarget: vi.fn(),
  getSkuCompositionByInitiativeId: vi.fn(),
  getOutcomeReviewByInitiativeId: vi.fn(),
  createLearningArtifact: vi.fn(),
};

vi.mock("../server/storage", () => ({
  storage: storageMock,
}));

describe("Learning artifacts gate enforcement", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects when opportunity artifact link is missing", async () => {
    storageMock.getInitiativeById.mockResolvedValue({ id: "init-1", opportunityArtifactId: null });

    const { default: router } = await import("../server/routes/learning-artifacts");
    const handler = router.stack.find((layer: any) => layer.route?.path === "/learning-artifacts/:initiativeId").route.stack.at(-1).handle;

    const req = {
      params: { initiativeId: "init-1" },
      body: { learning: "test" },
      user: { id: "admin-1", agencyId: "agency-1", role: "Admin" },
    };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("creates learning artifact when gates are satisfied", async () => {
    storageMock.getInitiativeById.mockResolvedValue({ id: "init-1", opportunityArtifactId: "opp-1" });
    storageMock.getLatestGateDecisionForTarget.mockResolvedValue({ decision: "approve" });
    storageMock.getSkuCompositionByInitiativeId.mockResolvedValue({ frozenAt: new Date().toISOString() });
    storageMock.getOutcomeReviewByInitiativeId.mockResolvedValue({ outcomeSummary: "done" });
    storageMock.createLearningArtifact.mockResolvedValue({ id: "learn-1" });

    const { default: router } = await import("../server/routes/learning-artifacts");
    const handler = router.stack.find((layer: any) => layer.route?.path === "/learning-artifacts/:initiativeId").route.stack.at(-1).handle;

    const req = {
      params: { initiativeId: "init-1" },
      body: { learning: "test" },
      user: { id: "admin-1", agencyId: "agency-1", role: "Admin" },
    };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(storageMock.createLearningArtifact).toHaveBeenCalled();
  });
});
