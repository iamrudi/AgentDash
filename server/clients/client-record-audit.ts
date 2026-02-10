import type { InsertAuditLog } from "@shared/schema";
import type { Storage } from "../storage";
import { getAuditableClientFields } from "./client-record-catalog";

export interface ClientRecordAuditContext {
  userId: string;
  clientId: string;
  updates: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function auditClientRecordUpdate(
  storage: Storage,
  ctx: ClientRecordAuditContext
): Promise<{ audited: boolean; fields: string[] }> {
  const auditableFields = getAuditableClientFields();
  const updatedFields = Object.keys(ctx.updates).filter(
    (key) => ctx.updates[key] !== undefined
  );
  const fields = updatedFields.filter((key) => auditableFields.has(key));

  if (fields.length === 0) {
    return { audited: false, fields: [] };
  }

  const log: InsertAuditLog = {
    userId: ctx.userId,
    action: "client.record.update",
    resourceType: "client",
    resourceId: ctx.clientId,
    details: {
      updatedFields: fields,
    },
    ipAddress: ctx.ipAddress ?? undefined,
    userAgent: ctx.userAgent ?? undefined,
  };

  await storage.createAuditLog(log);
  return { audited: true, fields };
}
