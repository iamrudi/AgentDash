import { z } from "zod";
import type { IStorage } from "../../storage";
import type { RequestContext } from "../../middleware/request-context";
import { hardenedAIExecutor } from "../../ai/hardened-executor";
import { buildAIInput, loadFieldCatalog, defaultFieldCatalogPath } from "../../ai/ai-input-builder";
import type { ClientRecordAIInput } from "../../ai/ai-input-schema";
import {
  OpportunityArtifactAIOutputSchema,
  OpportunityArtifactManualSchema,
  type OpportunityArtifactAIOutput,
} from "../../domain/opportunities/schemas";

export interface OpportunityServiceResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export class OpportunityService {
  constructor(private storage: IStorage) {}

  async buildAIInputFromClientRecord(
    clientId: string
  ): Promise<OpportunityServiceResult<ClientRecordAIInput>> {
    const [client, objectives, metrics] = await Promise.all([
      this.storage.getClientById(clientId),
      this.storage.getActiveObjectivesByClientId(clientId),
      this.storage.getMetricsByClientId(clientId, 30),
    ]);

    if (!client) {
      return { ok: false, error: "Client not found" };
    }

    const ga4 = metrics
      .filter((m) => (m.sessions || 0) > 0 || (m.conversions || 0) > 0 || (m.clicks || 0) > 0 || (m.impressions || 0) > 0 || (m.spend && parseFloat(m.spend) > 0))
      .map((m) => ({
        date: String(m.date),
        source: m.source,
        sessions: m.sessions || 0,
        conversions: m.conversions || 0,
        clicks: m.clicks || 0,
        impressions: m.impressions || 0,
        spend: m.spend ? parseFloat(m.spend) : 0,
      }));

    const gsc = metrics
      .filter((m) => (m.organicClicks || 0) > 0 || (m.organicImpressions || 0) > 0 || (m.avgPosition !== null && m.avgPosition !== undefined))
      .map((m) => ({
        date: String(m.date),
        organicClicks: m.organicClicks || 0,
        organicImpressions: m.organicImpressions || 0,
        avgPosition: m.avgPosition ? Number(m.avgPosition) : null,
      }));

    const clientRecord = {
      client,
      metrics: { ga4, gsc },
      objectives: objectives.map((obj) => obj.title || obj.description || "").filter(Boolean),
    } as Record<string, unknown>;

    const catalog = loadFieldCatalog(defaultFieldCatalogPath());
    const buildResult = buildAIInput(catalog, clientRecord);
    if (!buildResult.ok) {
      return { ok: false, error: buildResult.error };
    }

    return { ok: true, data: buildResult.aiInput };
  }

  async generateOpportunityArtifactFromAI(
    clientId: string,
    ctx: RequestContext
  ): Promise<OpportunityServiceResult<OpportunityArtifactAIOutput>> {
    if (!ctx.agencyId) {
      return { ok: false, error: "Agency context required" };
    }
    const inputResult = await this.buildAIInputFromClientRecord(clientId);
    if (!inputResult.ok || !inputResult.data) {
      return { ok: false, error: inputResult.error || "Failed to build AI input" };
    }

    const prompt = [
      "You are a strategist generating an Opportunity Artifact for a client.",
      "Use only the provided JSON context.",
      "Return a single JSON object that matches the schema exactly.",
      "",
      "Required fields:",
      "- opportunity_statement (string)",
      "- reasoning (string)",
      "- assumptions (array of strings)",
      "- confidence (high|med|low)",
      "- evidence_refs (array of strings referencing signals/metrics)",
      "- risks (array of strings)",
      "- suggested_success_criteria (array of strings)",
      "",
      "Client Context:",
      JSON.stringify(inputResult.data, null, 2),
    ].join("\n");

    const aiResult = await hardenedAIExecutor.executeWithSchema(
      {
        agencyId: ctx.agencyId,
        operation: "opportunity_artifact_generate",
      },
      { prompt },
      OpportunityArtifactAIOutputSchema
    );

    if (!aiResult.success) {
      return { ok: false, error: aiResult.error || "AI generation failed" };
    }

    return { ok: true, data: aiResult.data };
  }

  async persistOpportunityArtifact(
    clientId: string,
    payload: OpportunityArtifactAIOutput | z.infer<typeof OpportunityArtifactManualSchema>,
    ctx: RequestContext
  ): Promise<OpportunityServiceResult<unknown>> {
    if (!ctx.agencyId) {
      return { ok: false, error: "Agency context required" };
    }
    const record = await this.storage.createOpportunityArtifact({
      agencyId: ctx.agencyId,
      clientId,
      opportunityStatement: "opportunity_statement" in payload
        ? payload.opportunity_statement
        : payload.opportunityStatement,
      reasoning: "reasoning" in payload ? payload.reasoning : payload.reasoning,
      assumptions: "assumptions" in payload ? payload.assumptions : payload.assumptions,
      confidence: "confidence" in payload ? payload.confidence : payload.confidence,
      evidenceRefs: "evidence_refs" in payload ? payload.evidence_refs : payload.evidenceRefs,
      risks: "risks" in payload ? payload.risks : payload.risks,
      suggestedSuccessCriteria: "suggested_success_criteria" in payload
        ? payload.suggested_success_criteria
        : payload.suggestedSuccessCriteria,
    } as any);

    if (this.storage.createAuditLog) {
      try {
        await this.storage.createAuditLog({
          userId: ctx.userId,
          action: "opportunity_artifact.create",
          resourceType: "opportunity_artifact",
          resourceId: record.id,
          details: { clientId },
          ipAddress: ctx.ip,
          userAgent: ctx.userAgent,
        });
      } catch {
        // Ignore audit failures to keep route non-blocking.
      }
    }

    return { ok: true, data: record };
  }
}
