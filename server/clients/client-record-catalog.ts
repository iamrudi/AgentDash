import { defaultFieldCatalogPath, loadFieldCatalog } from "../ai/ai-input-builder";
import type { FieldCatalogEntry } from "../ai/ai-input-schema";

let cachedCatalog: FieldCatalogEntry[] | null = null;
let cachedAuditableClientFields: Set<string> | null = null;

export function getClientRecordCatalog(): FieldCatalogEntry[] {
  if (!cachedCatalog) {
    cachedCatalog = loadFieldCatalog(defaultFieldCatalogPath());
  }
  return cachedCatalog;
}

export function getAuditableClientFields(): Set<string> {
  if (cachedAuditableClientFields) {
    return cachedAuditableClientFields;
  }

  const catalog = getClientRecordCatalog();
  const fields = new Set<string>();

  for (const entry of catalog) {
    if (!entry.audit_required) continue;
    if (!entry.field_key.startsWith("client.")) continue;
    const field = entry.field_key.split(".")[1];
    if (field) fields.add(field);
  }

  cachedAuditableClientFields = fields;
  return fields;
}
