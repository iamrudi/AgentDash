import { describe, expect, it, vi } from "vitest";
import { RuleEngineService } from "../server/application/rules/rule-engine-service";

describe("RuleEngineService", () => {
  it("fails closed on listRules when agency missing", async () => {
    const service = new RuleEngineService({} as any);
    const result = await service.listRules(undefined);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toBe("Agency context required");
  });

  it("returns 404 when rule is missing", async () => {
    const storage = {
      getWorkflowRuleById: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new RuleEngineService(storage);
    const result = await service.getRule("rule-1", { agencyId: "agency-1", isSuperAdmin: false });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe("Rule not found");
  });

  it("blocks cross-tenant rule access for non-superadmin", async () => {
    const storage = {
      getWorkflowRuleById: vi.fn().mockResolvedValue({ id: "rule-1", agencyId: "agency-2" }),
    } as any;
    const service = new RuleEngineService(storage);
    const result = await service.getRule("rule-1", { agencyId: "agency-1", isSuperAdmin: false });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toBe("Access denied");
  });

  it("fails closed on invalid createRule payload", async () => {
    const service = new RuleEngineService({} as any);
    const result = await service.createRule("agency-1", "user-1", { name: "Rule" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toBe("Validation error");
  });

  it("returns 404 on publish when version missing", async () => {
    const storage = {
      getRuleVersionById: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new RuleEngineService(storage);
    const result = await service.publishRuleVersion("version-1", { agencyId: "agency-1", isSuperAdmin: false, id: "user-1" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe("Version not found");
  });
});
