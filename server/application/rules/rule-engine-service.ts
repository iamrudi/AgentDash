import { z } from "zod";
import { insertWorkflowRuleSchema, updateWorkflowRuleSchema } from "@shared/schema";
import type { IStorage } from "../../storage";

const versionRequestSchema = z.object({
  conditionLogic: z.enum(["all", "any"]).optional(),
  thresholdConfig: z.record(z.unknown()).optional(),
  lifecycleConfig: z.record(z.unknown()).optional(),
  anomalyConfig: z.record(z.unknown()).optional(),
});

const conditionSchema = z.object({
  fieldPath: z.string().min(1),
  operator: z.string().min(1),
  comparisonValue: z.unknown().optional(),
  windowConfig: z.record(z.unknown()).optional(),
  scope: z.enum(["signal", "context", "history", "aggregated"]).optional(),
  order: z.number().optional(),
});

const actionSchema = z.object({
  actionType: z.string().min(1),
  actionConfig: z.record(z.unknown()).optional(),
  order: z.number().optional(),
});

export interface RuleEngineResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  errors?: unknown;
}

export class RuleEngineService {
  constructor(private readonly storage: IStorage) {}

  async listRules(agencyId: string | undefined): Promise<RuleEngineResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 400, error: "Agency context required" };
    }
    const rules = await this.storage.getWorkflowRulesByAgencyId(agencyId);
    return { ok: true, status: 200, data: rules };
  }

  async getRule(ruleId: string, user: { agencyId?: string; isSuperAdmin?: boolean }): Promise<RuleEngineResult<unknown>> {
    const rule = await this.storage.getWorkflowRuleById(ruleId);
    if (!rule) {
      return { ok: false, status: 404, error: "Rule not found" };
    }
    if (rule.agencyId !== user.agencyId && !user.isSuperAdmin) {
      return { ok: false, status: 403, error: "Access denied" };
    }
    return { ok: true, status: 200, data: rule };
  }

  async createRule(
    agencyId: string | undefined,
    actorId: string | undefined,
    payload: unknown
  ): Promise<RuleEngineResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 400, error: "Agency context required" };
    }

    const parsed = insertWorkflowRuleSchema.safeParse({
      ...(payload as Record<string, unknown>),
      agencyId,
      createdBy: actorId || null,
    });
    if (!parsed.success) {
      return { ok: false, status: 400, error: "Validation error", errors: parsed.error.errors };
    }

    const rule = await this.storage.createWorkflowRule(parsed.data);
    await this.storage.createRuleAudit({
      ruleId: rule.id,
      actorId: actorId || null,
      changeType: "created",
      changeSummary: `Rule "${rule.name}" created`,
      newState: rule as any,
    });

    return { ok: true, status: 201, data: rule };
  }

  async updateRule(
    ruleId: string,
    user: { agencyId?: string; isSuperAdmin?: boolean; id?: string },
    payload: unknown
  ): Promise<RuleEngineResult<unknown>> {
    const rule = await this.storage.getWorkflowRuleById(ruleId);
    if (!rule) {
      return { ok: false, status: 404, error: "Rule not found" };
    }
    if (rule.agencyId !== user.agencyId && !user.isSuperAdmin) {
      return { ok: false, status: 403, error: "Access denied" };
    }

    const parsed = updateWorkflowRuleSchema.safeParse(payload);
    if (!parsed.success) {
      return { ok: false, status: 400, error: "Validation error", errors: parsed.error.errors };
    }

    const previousState = { ...rule };
    const updated = await this.storage.updateWorkflowRule(ruleId, parsed.data);

    await this.storage.createRuleAudit({
      ruleId,
      actorId: user.id || null,
      changeType: "updated",
      changeSummary: "Rule updated",
      previousState: previousState as any,
      newState: updated as any,
    });

    return { ok: true, status: 200, data: updated };
  }

  async deleteRule(ruleId: string, user: { agencyId?: string; isSuperAdmin?: boolean; id?: string }): Promise<RuleEngineResult<undefined>> {
    const rule = await this.storage.getWorkflowRuleById(ruleId);
    if (!rule) {
      return { ok: false, status: 404, error: "Rule not found" };
    }
    if (rule.agencyId !== user.agencyId && !user.isSuperAdmin) {
      return { ok: false, status: 403, error: "Access denied" };
    }

    await this.storage.createRuleAudit({
      ruleId,
      actorId: user.id || null,
      changeType: "deleted",
      changeSummary: `Rule "${rule.name}" deleted`,
      previousState: rule as any,
    });

    await this.storage.deleteWorkflowRule(ruleId);
    return { ok: true, status: 204 };
  }

  async listRuleVersions(ruleId: string, user: { agencyId?: string; isSuperAdmin?: boolean }): Promise<RuleEngineResult<unknown>> {
    const ruleAccess = await this.getRule(ruleId, user);
    if (!ruleAccess.ok) {
      return ruleAccess;
    }
    const versions = await this.storage.getRuleVersionsByRuleId(ruleId);
    return { ok: true, status: 200, data: versions };
  }

  async createRuleVersion(
    ruleId: string,
    user: { agencyId?: string; isSuperAdmin?: boolean; id?: string },
    payload: unknown
  ): Promise<RuleEngineResult<unknown>> {
    const rule = await this.storage.getWorkflowRuleById(ruleId);
    if (!rule) {
      return { ok: false, status: 404, error: "Rule not found" };
    }
    if (rule.agencyId !== user.agencyId && !user.isSuperAdmin) {
      return { ok: false, status: 403, error: "Access denied" };
    }

    const existingVersions = await this.storage.getRuleVersionsByRuleId(ruleId);
    const nextVersion = existingVersions.length > 0 ? Math.max(...existingVersions.map((entry) => entry.version)) + 1 : 1;

    const versionPayload = payload as Record<string, unknown>;
    const { conditions, actions, ...versionData } = versionPayload;
    const parsedVersion = versionRequestSchema.safeParse(versionData);
    if (!parsedVersion.success) {
      return { ok: false, status: 400, error: "Validation error", errors: parsedVersion.error.errors };
    }

    const version = await this.storage.createRuleVersion({
      ruleId,
      version: nextVersion,
      status: "draft",
      conditionLogic: parsedVersion.data.conditionLogic || "all",
      thresholdConfig: parsedVersion.data.thresholdConfig,
      lifecycleConfig: parsedVersion.data.lifecycleConfig,
      anomalyConfig: parsedVersion.data.anomalyConfig,
      createdBy: user.id || null,
    });

    if (Array.isArray(conditions) && conditions.length > 0) {
      const inputs = [];
      for (let i = 0; i < conditions.length; i++) {
        const parsed = conditionSchema.safeParse(conditions[i]);
        if (!parsed.success) {
          return { ok: false, status: 400, error: "Condition validation error", errors: parsed.error.errors };
        }
        inputs.push({
          ruleVersionId: version.id,
          order: parsed.data.order ?? i,
          fieldPath: parsed.data.fieldPath,
          operator: parsed.data.operator,
          comparisonValue: parsed.data.comparisonValue as any,
          windowConfig: parsed.data.windowConfig as any,
          scope: parsed.data.scope || "signal",
        });
      }
      await this.storage.createRuleConditions(inputs);
    }

    if (Array.isArray(actions) && actions.length > 0) {
      const inputs = [];
      for (let i = 0; i < actions.length; i++) {
        const parsed = actionSchema.safeParse(actions[i]);
        if (!parsed.success) {
          return { ok: false, status: 400, error: "Action validation error", errors: parsed.error.errors };
        }
        inputs.push({
          ruleVersionId: version.id,
          order: parsed.data.order ?? i,
          actionType: parsed.data.actionType,
          actionConfig: parsed.data.actionConfig || {},
        });
      }
      await this.storage.createRuleActions(inputs);
    }

    return { ok: true, status: 201, data: version };
  }

  async publishRuleVersion(
    versionId: string,
    user: { agencyId?: string; isSuperAdmin?: boolean; id?: string }
  ): Promise<RuleEngineResult<unknown>> {
    const version = await this.storage.getRuleVersionById(versionId);
    if (!version) {
      return { ok: false, status: 404, error: "Version not found" };
    }

    const rule = await this.storage.getWorkflowRuleById(version.ruleId);
    if (!rule) {
      return { ok: false, status: 404, error: "Rule not found" };
    }

    if (rule.agencyId !== user.agencyId && !user.isSuperAdmin) {
      return { ok: false, status: 403, error: "Access denied" };
    }

    const published = await this.storage.publishRuleVersion(versionId);
    await this.storage.updateWorkflowRule(rule.id, { defaultVersionId: versionId });

    await this.storage.createRuleAudit({
      ruleId: rule.id,
      ruleVersionId: versionId,
      actorId: user.id || null,
      changeType: "published",
      changeSummary: `Version ${version.version} published`,
      newState: published as any,
    });

    return { ok: true, status: 200, data: published };
  }

  async listRuleConditions(versionId: string): Promise<RuleEngineResult<unknown>> {
    const conditions = await this.storage.getRuleConditionsByVersionId(versionId);
    return { ok: true, status: 200, data: conditions };
  }

  async listRuleActions(versionId: string): Promise<RuleEngineResult<unknown>> {
    const actions = await this.storage.getRuleActionsByVersionId(versionId);
    return { ok: true, status: 200, data: actions };
  }

  async listRuleAudits(ruleId: string, user: { agencyId?: string; isSuperAdmin?: boolean }): Promise<RuleEngineResult<unknown>> {
    const ruleAccess = await this.getRule(ruleId, user);
    if (!ruleAccess.ok) {
      return ruleAccess;
    }
    const audits = await this.storage.getRuleAuditsByRuleId(ruleId);
    return { ok: true, status: 200, data: audits };
  }

  async listRuleEvaluations(
    ruleId: string,
    user: { agencyId?: string; isSuperAdmin?: boolean },
    limitRaw: unknown
  ): Promise<RuleEngineResult<unknown>> {
    const ruleAccess = await this.getRule(ruleId, user);
    if (!ruleAccess.ok) {
      return ruleAccess;
    }
    const limit = Number.parseInt(String(limitRaw), 10) || 100;
    const evaluations = await this.storage.getRuleEvaluationsByRuleId(ruleId, limit);
    return { ok: true, status: 200, data: evaluations };
  }
}
