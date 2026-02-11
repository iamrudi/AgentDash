import { describe, expect, it, vi } from "vitest";
import { RetentionPolicyService } from "../server/application/retention/retention-policy-service";

describe("RetentionPolicyService", () => {
  it("fails list when agency context missing", async () => {
    const service = new RetentionPolicyService({} as any);
    const result = await service.listPolicies(undefined);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toBe("Agency context required");
  });

  it("fails upsert when required fields missing", async () => {
    const service = new RetentionPolicyService({} as any);
    const result = await service.upsertPolicy("agency-1", { resourceType: "workflow_events" } as any);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toBe("resourceType and retentionDays are required");
  });

  it("denies deleting policy from another tenant for non-superadmin", async () => {
    const deps = {
      getPolicyById: vi.fn().mockResolvedValue({ id: "p1", agencyId: "agency-2" }),
      deletePolicyById: vi.fn(),
    } as any;
    const service = new RetentionPolicyService(deps);

    const result = await service.deletePolicy("p1", { agencyId: "agency-1", isSuperAdmin: false });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toBe("Access denied");
  });

  it("returns plan using count mode when requested", async () => {
    const deps = {
      buildPlanWithCounts: vi.fn().mockResolvedValue([{ resourceType: "workflow_events" }]),
    } as any;
    const service = new RetentionPolicyService(deps);

    const result = await service.cleanupPlan("agency-1", true);

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ plan: [{ resourceType: "workflow_events" }] });
    expect(deps.buildPlanWithCounts).toHaveBeenCalledWith("agency-1");
  });

  it("runs cleanup with dry-run result envelope", async () => {
    const deps = {
      runCleanup: vi.fn().mockResolvedValue([{ resourceType: "workflow_events", deletedCount: 0 }]),
    } as any;
    const service = new RetentionPolicyService(deps);

    const result = await service.runCleanup("agency-1", true);

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({
      message: "Retention cleanup dry-run completed",
      dryRun: true,
      results: [{ resourceType: "workflow_events", deletedCount: 0 }],
    });
  });
});
