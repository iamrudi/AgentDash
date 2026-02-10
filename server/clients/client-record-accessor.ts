import type { IStorage } from "../storage";
import type { RequestContext } from "../middleware/request-context";
import {
  validateClientRecordUpdateWithContext,
  type ClientRecordUpdateSource,
} from "./client-record-service";
import { auditClientRecordUpdate } from "./client-record-audit";
import { emitClientRecordUpdatedSignal } from "./client-record-signal";

export interface ClientRecordUpdateInput {
  clientId: string;
  updates: Record<string, unknown>;
  context: RequestContext;
  source: ClientRecordUpdateSource;
  signalSource?: string;
  origin: string;
}

export interface ClientRecordUpdateResult {
  ok: boolean;
  errors?: Array<{ field: string; reason: string }>;
  client?: unknown;
}

export async function updateClientRecord(
  storage: IStorage,
  input: ClientRecordUpdateInput
): Promise<ClientRecordUpdateResult> {
  const validation = validateClientRecordUpdateWithContext(input.updates, {
    source: input.source,
    signalSource: input.signalSource,
  });

  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  const updatedClient = await storage.updateClient(input.clientId, input.updates);
  await auditClientRecordUpdate(storage, {
    userId: input.context.userId,
    clientId: input.clientId,
    updates: input.updates,
    ipAddress: input.context.ip,
    userAgent: input.context.userAgent,
  });

  if (!input.context.agencyId) {
    throw new Error("Agency context required for client record updates");
  }

  await emitClientRecordUpdatedSignal(storage, {
    agencyId: input.context.agencyId,
    clientId: input.clientId,
    updates: input.updates,
    actorId: input.context.userId,
    origin: input.origin,
  });

  return { ok: true, client: updatedClient };
}
