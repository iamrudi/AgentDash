import { describe, expect, it, vi } from "vitest";
import { RuleEngineService } from "../server/application/rules/rule-engine-service";
import {
  createWorkflowRulesListHandler,
  createWorkflowRuleGetHandler,
  createWorkflowRuleCreateHandler,
  createWorkflowRuleUpdateHandler,
  createWorkflowRuleDeleteHandler,
  createWorkflowRuleVersionsListHandler,
  createWorkflowRuleVersionCreateHandler,
  createWorkflowRuleVersionPublishHandler,
  createWorkflowRuleConditionsListHandler,
  createWorkflowRuleActionsListHandler,
  createWorkflowRuleAuditsListHandler,
  createWorkflowRuleEvaluationsListHandler,
} from "../server/routes/rule-engine";

describe("Rule engine route handlers", () => {
  it("delegates rules list", async () => {
    const listRules = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { listRules } as unknown as RuleEngineService;
    const handler = createWorkflowRulesListHandler(service);
    const req = { user: { agencyId: "agency-1" }, query: { agencyId: "agency-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(listRules).toHaveBeenCalledWith("agency-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates rule get", async () => {
    const getRule = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { id: "rule-1" } });
    const service = { getRule } as unknown as RuleEngineService;
    const handler = createWorkflowRuleGetHandler(service);
    const req = { params: { id: "rule-1" }, user: { agencyId: "agency-1", isSuperAdmin: false } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(getRule).toHaveBeenCalledWith("rule-1", { agencyId: "agency-1", isSuperAdmin: false });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates rule create", async () => {
    const createRule = vi.fn().mockResolvedValue({ ok: true, status: 201, data: { id: "rule-1" } });
    const service = { createRule } as unknown as RuleEngineService;
    const handler = createWorkflowRuleCreateHandler(service);
    const req = { user: { id: "user-1", agencyId: "agency-1" }, query: { agencyId: "agency-1" }, body: { name: "R" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(createRule).toHaveBeenCalledWith("agency-1", "user-1", { name: "R" });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("delegates rule update", async () => {
    const updateRule = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { id: "rule-1" } });
    const service = { updateRule } as unknown as RuleEngineService;
    const handler = createWorkflowRuleUpdateHandler(service);
    const req = { params: { id: "rule-1" }, user: { id: "user-1", agencyId: "agency-1", isSuperAdmin: false }, body: { isActive: true } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(updateRule).toHaveBeenCalledWith("rule-1", { agencyId: "agency-1", isSuperAdmin: false, id: "user-1" }, { isActive: true });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates rule delete", async () => {
    const deleteRule = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    const service = { deleteRule } as unknown as RuleEngineService;
    const handler = createWorkflowRuleDeleteHandler(service);
    const req = { params: { id: "rule-1" }, user: { id: "user-1", agencyId: "agency-1", isSuperAdmin: false } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() };

    await handler(req, res);

    expect(deleteRule).toHaveBeenCalledWith("rule-1", { agencyId: "agency-1", isSuperAdmin: false, id: "user-1" });
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("delegates versions list", async () => {
    const listRuleVersions = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { listRuleVersions } as unknown as RuleEngineService;
    const handler = createWorkflowRuleVersionsListHandler(service);
    const req = { params: { id: "rule-1" }, user: { agencyId: "agency-1", isSuperAdmin: false } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(listRuleVersions).toHaveBeenCalledWith("rule-1", { agencyId: "agency-1", isSuperAdmin: false });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates version create", async () => {
    const createRuleVersion = vi.fn().mockResolvedValue({ ok: true, status: 201, data: { id: "version-1" } });
    const service = { createRuleVersion } as unknown as RuleEngineService;
    const handler = createWorkflowRuleVersionCreateHandler(service);
    const req = { params: { id: "rule-1" }, user: { id: "user-1", agencyId: "agency-1", isSuperAdmin: false }, body: { conditionLogic: "all" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(createRuleVersion).toHaveBeenCalledWith("rule-1", { agencyId: "agency-1", isSuperAdmin: false, id: "user-1" }, { conditionLogic: "all" });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("delegates version publish", async () => {
    const publishRuleVersion = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { id: "version-1" } });
    const service = { publishRuleVersion } as unknown as RuleEngineService;
    const handler = createWorkflowRuleVersionPublishHandler(service);
    const req = { params: { id: "version-1" }, user: { id: "user-1", agencyId: "agency-1", isSuperAdmin: false } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(publishRuleVersion).toHaveBeenCalledWith("version-1", { agencyId: "agency-1", isSuperAdmin: false, id: "user-1" });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates conditions list", async () => {
    const listRuleConditions = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { listRuleConditions } as unknown as RuleEngineService;
    const handler = createWorkflowRuleConditionsListHandler(service);
    const req = { params: { id: "version-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(listRuleConditions).toHaveBeenCalledWith("version-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates actions list", async () => {
    const listRuleActions = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { listRuleActions } as unknown as RuleEngineService;
    const handler = createWorkflowRuleActionsListHandler(service);
    const req = { params: { id: "version-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(listRuleActions).toHaveBeenCalledWith("version-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates audits list", async () => {
    const listRuleAudits = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { listRuleAudits } as unknown as RuleEngineService;
    const handler = createWorkflowRuleAuditsListHandler(service);
    const req = { params: { id: "rule-1" }, user: { agencyId: "agency-1", isSuperAdmin: false } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(listRuleAudits).toHaveBeenCalledWith("rule-1", { agencyId: "agency-1", isSuperAdmin: false });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates evaluations list", async () => {
    const listRuleEvaluations = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { listRuleEvaluations } as unknown as RuleEngineService;
    const handler = createWorkflowRuleEvaluationsListHandler(service);
    const req = { params: { id: "rule-1" }, query: { limit: "25" }, user: { agencyId: "agency-1", isSuperAdmin: false } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(listRuleEvaluations).toHaveBeenCalledWith("rule-1", { agencyId: "agency-1", isSuperAdmin: false }, "25");
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
