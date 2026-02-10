import type { IStorage } from "../storage";
import { signalRouter } from "../workflow/signal-router";
import { createWorkflowEngine } from "../workflow/engine";
import { ensureClientRecordRecommendationWorkflow } from "../workflow/defaults";

export interface ClientRecordSignalContext {
  agencyId: string;
  clientId: string;
  updates: Record<string, unknown>;
  actorId: string;
  origin: string;
  reason?: string;
  preset?: string;
  includeCompetitors?: boolean;
  competitorDomains?: string[];
}

export interface ClientRecordSignalResult {
  signalId: string;
  isDuplicate: boolean;
  workflowsTriggered: string[];
  executions: string[];
}

export async function emitClientRecordUpdatedSignal(
  storage: IStorage,
  context: ClientRecordSignalContext
): Promise<ClientRecordSignalResult> {
  await ensureClientRecordRecommendationWorkflow(storage, context.agencyId);

  const payload = {
    type: "client_record_updated",
    data: {
      clientId: context.clientId,
      updates: context.updates,
      actorId: context.actorId,
      reason: context.reason,
      preset: context.preset,
      includeCompetitors: context.includeCompetitors,
      competitorDomains: context.competitorDomains,
    },
    metadata: {
      origin: context.origin,
    },
    timestamp: new Date().toISOString(),
  };

  const result = await signalRouter.ingestSignal(
    context.agencyId,
    "internal",
    payload,
    context.clientId
  );

  if (result.isDuplicate || result.workflowsTriggered.length === 0) {
    return {
      signalId: result.signal.id,
      isDuplicate: result.isDuplicate,
      workflowsTriggered: result.workflowsTriggered,
      executions: [],
    };
  }

  const engine = createWorkflowEngine(storage);
  const processed = await engine.processSignal(
    result.signal.id,
    result.signal.payload as Record<string, unknown>,
    result.workflowsTriggered
  );

  return {
    signalId: result.signal.id,
    isDuplicate: result.isDuplicate,
    workflowsTriggered: result.workflowsTriggered,
    executions: processed.executions.map((execution) => execution.id),
  };
}
