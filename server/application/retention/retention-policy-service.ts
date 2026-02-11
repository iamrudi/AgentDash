import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { workflowRetentionPolicies } from "@shared/schema";
import { RetentionService } from "./retention-service";

interface RetentionPolicyRow {
  id: string;
  agencyId: string;
  resourceType: string;
  retentionDays: number;
  archiveBeforeDelete: boolean | null;
  enabled: boolean | null;
}

interface RetentionPolicyDeps {
  listPoliciesByAgency: (agencyId: string) => Promise<RetentionPolicyRow[]>;
  findPolicyByAgencyAndResourceType: (agencyId: string, resourceType: string) => Promise<RetentionPolicyRow | undefined>;
  insertPolicy: (input: {
    agencyId: string;
    resourceType: string;
    retentionDays: number;
    archiveBeforeDelete: boolean;
    enabled: boolean;
  }) => Promise<RetentionPolicyRow>;
  updatePolicyById: (
    policyId: string,
    input: {
      retentionDays: number;
      archiveBeforeDelete: boolean;
      enabled: boolean;
      updatedAt: Date;
    }
  ) => Promise<RetentionPolicyRow>;
  getPolicyById: (policyId: string) => Promise<RetentionPolicyRow | undefined>;
  deletePolicyById: (policyId: string) => Promise<void>;
  buildPlan: (agencyId: string) => Promise<unknown>;
  buildPlanWithCounts: (agencyId: string) => Promise<unknown>;
  runCleanup: (agencyId: string, dryRun: boolean) => Promise<unknown>;
}

const retentionService = new RetentionService();

const defaultDeps: RetentionPolicyDeps = {
  listPoliciesByAgency: async (agencyId) => {
    return db.select().from(workflowRetentionPolicies).where(eq(workflowRetentionPolicies.agencyId, agencyId)) as any;
  },
  findPolicyByAgencyAndResourceType: async (agencyId, resourceType) => {
    const rows = await db
      .select()
      .from(workflowRetentionPolicies)
      .where(and(eq(workflowRetentionPolicies.agencyId, agencyId), eq(workflowRetentionPolicies.resourceType, resourceType)))
      .limit(1);
    return rows[0] as any;
  },
  insertPolicy: async (input) => {
    const [row] = await db.insert(workflowRetentionPolicies).values(input).returning();
    return row as any;
  },
  updatePolicyById: async (policyId, input) => {
    const [row] = await db
      .update(workflowRetentionPolicies)
      .set(input)
      .where(eq(workflowRetentionPolicies.id, policyId))
      .returning();
    return row as any;
  },
  getPolicyById: async (policyId) => {
    const rows = await db.select().from(workflowRetentionPolicies).where(eq(workflowRetentionPolicies.id, policyId)).limit(1);
    return rows[0] as any;
  },
  deletePolicyById: async (policyId) => {
    await db.delete(workflowRetentionPolicies).where(eq(workflowRetentionPolicies.id, policyId));
  },
  buildPlan: async (agencyId) => retentionService.buildPlan(agencyId),
  buildPlanWithCounts: async (agencyId) => retentionService.buildPlanWithCounts(agencyId),
  runCleanup: async (agencyId, dryRun) => retentionService.runCleanup(agencyId, dryRun),
};

export interface RetentionPolicyResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class RetentionPolicyService {
  constructor(private readonly deps: RetentionPolicyDeps = defaultDeps) {}

  async listPolicies(agencyId: string | undefined): Promise<RetentionPolicyResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 400, error: "Agency context required" };
    }
    const policies = await this.deps.listPoliciesByAgency(agencyId);
    return { ok: true, status: 200, data: policies };
  }

  async upsertPolicy(
    agencyId: string | undefined,
    payload: {
      resourceType?: string;
      retentionDays?: number;
      archiveBeforeDelete?: boolean;
      enabled?: boolean;
    }
  ): Promise<RetentionPolicyResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 400, error: "Agency context required" };
    }

    if (!payload.resourceType || !payload.retentionDays) {
      return { ok: false, status: 400, error: "resourceType and retentionDays are required" };
    }

    const existing = await this.deps.findPolicyByAgencyAndResourceType(agencyId, payload.resourceType);

    const archiveBeforeDelete = payload.archiveBeforeDelete ?? false;
    const enabled = payload.enabled ?? true;

    const policy = existing
      ? await this.deps.updatePolicyById(existing.id, {
          retentionDays: payload.retentionDays,
          archiveBeforeDelete,
          enabled,
          updatedAt: new Date(),
        })
      : await this.deps.insertPolicy({
          agencyId,
          resourceType: payload.resourceType,
          retentionDays: payload.retentionDays,
          archiveBeforeDelete,
          enabled,
        });

    return { ok: true, status: 200, data: policy };
  }

  async deletePolicy(
    policyId: string,
    params: { agencyId?: string; isSuperAdmin?: boolean }
  ): Promise<RetentionPolicyResult<{ message: string }>> {
    if (!params.agencyId) {
      return { ok: false, status: 400, error: "Agency context required" };
    }

    const policy = await this.deps.getPolicyById(policyId);
    if (!policy) {
      return { ok: false, status: 404, error: "Retention policy not found" };
    }

    if (policy.agencyId !== params.agencyId && !params.isSuperAdmin) {
      return { ok: false, status: 403, error: "Access denied" };
    }

    await this.deps.deletePolicyById(policyId);
    return { ok: true, status: 200, data: { message: "Retention policy deleted" } };
  }

  async cleanupPlan(agencyId: string | undefined, includeCounts: boolean): Promise<RetentionPolicyResult<{ plan: unknown }>> {
    if (!agencyId) {
      return { ok: false, status: 400, error: "Agency context required" };
    }

    const plan = includeCounts
      ? await this.deps.buildPlanWithCounts(agencyId)
      : await this.deps.buildPlan(agencyId);

    return { ok: true, status: 200, data: { plan } };
  }

  async runCleanup(agencyId: string | undefined, dryRun: boolean): Promise<RetentionPolicyResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 400, error: "Agency context required" };
    }

    const results = await this.deps.runCleanup(agencyId, dryRun);
    return {
      ok: true,
      status: 200,
      data: {
        message: dryRun ? "Retention cleanup dry-run completed" : "Retention cleanup completed",
        dryRun,
        results,
      },
    };
  }
}
