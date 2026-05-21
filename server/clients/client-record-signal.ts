import crypto from "crypto";
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
      requestNonce: crypto.randomUUID(),
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

  if (result.isDuplicate) {
    console.warn(`[ClientRecordSignal] Signal deduplicated for client ${context.clientId}, skipping workflow execution`);
    return {
      signalId: result.signal.id,
      isDuplicate: true,
      workflowsTriggered: result.workflowsTriggered,
      executions: [],
    };
  }

  if (result.workflowsTriggered.length === 0) {
    console.warn(`[ClientRecordSignal] No workflows matched signal for client ${context.clientId}`);
    return {
      signalId: result.signal.id,
      isDuplicate: false,
      workflowsTriggered: [],
      executions: [],
    };
  }

  console.log(`[ClientRecordSignal] Processing signal ${result.signal.id} through ${result.workflowsTriggered.length} workflow(s)`);

  const engine = createWorkflowEngine(storage);
  const processed = await engine.processSignal(
    result.signal.id,
    result.signal.payload as Record<string, unknown>,
    result.workflowsTriggered
  );

  console.log(`[ClientRecordSignal] Signal ${result.signal.id} processed, ${processed.executions.length} execution(s) completed`);

  return {
    signalId: result.signal.id,
    isDuplicate: result.isDuplicate,
    workflowsTriggered: result.workflowsTriggered,
    executions: processed.executions.map((execution) => execution.id),
  };
}
