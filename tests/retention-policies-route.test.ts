import { describe, expect, it, vi } from "vitest";
import { RetentionPolicyService } from "../server/application/retention/retention-policy-service";
import {
  createRetentionPoliciesListHandler,
  createRetentionPolicyUpsertHandler,
  createRetentionPolicyDeleteHandler,
  createRetentionCleanupPlanHandler,
  createRetentionCleanupRunHandler,
} from "../server/routes/retention-policies";

describe("Retention policies route handlers", () => {
  it("delegates policies list", async () => {
    const listPolicies = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { listPolicies } as unknown as RetentionPolicyService;
    const handler = createRetentionPoliciesListHandler(service);
    const req = { user: { agencyId: "agency-1" }, query: { agencyId: "agency-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(listPolicies).toHaveBeenCalledWith("agency-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates policy upsert", async () => {
    const upsertPolicy = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { id: "p1" } });
    const service = { upsertPolicy } as unknown as RetentionPolicyService;
    const handler = createRetentionPolicyUpsertHandler(service);
    const req = { user: { agencyId: "agency-1" }, query: { agencyId: "agency-1" }, body: { resourceType: "workflow_events", retentionDays: 30 } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(upsertPolicy).toHaveBeenCalledWith("agency-1", { resourceType: "workflow_events", retentionDays: 30 });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates policy delete", async () => {
    const deletePolicy = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { message: "Retention policy deleted" } });
    const service = { deletePolicy } as unknown as RetentionPolicyService;
    const handler = createRetentionPolicyDeleteHandler(service);
    const req = { params: { id: "p1" }, user: { agencyId: "agency-1", isSuperAdmin: false }, query: { agencyId: "agency-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(deletePolicy).toHaveBeenCalledWith("p1", { agencyId: "agency-1", isSuperAdmin: false });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates cleanup plan", async () => {
    const cleanupPlan = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { plan: [] } });
    const service = { cleanupPlan } as unknown as RetentionPolicyService;
    const handler = createRetentionCleanupPlanHandler(service);
    const req = { user: { agencyId: "agency-1" }, query: { agencyId: "agency-1", includeCounts: "true" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(cleanupPlan).toHaveBeenCalledWith("agency-1", true);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates cleanup run", async () => {
    const runCleanup = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { dryRun: true, results: [] } });
    const service = { runCleanup } as unknown as RetentionPolicyService;
    const handler = createRetentionCleanupRunHandler(service);
    const req = { user: { agencyId: "agency-1" }, query: { agencyId: "agency-1" }, body: { dryRun: true } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(runCleanup).toHaveBeenCalledWith("agency-1", true);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
