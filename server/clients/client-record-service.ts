import type { FieldCatalogEntry } from "../ai/ai-input-schema";
import { getClientRecordCatalog } from "./client-record-catalog";

export interface ClientRecordValidationError {
  field: string;
  reason: string;
}

export interface ClientRecordValidationResult {
  ok: boolean;
  errors: ClientRecordValidationError[];
  validatedFields: string[];
}

function parseAllowedValues(entry: FieldCatalogEntry): string[] {
  if (!entry.allowed_values) return [];
  return entry.allowed_values
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function isNumericString(value: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(value);
}

function validateValue(entry: FieldCatalogEntry, value: unknown): ClientRecordValidationError | null {
  if (value === undefined) return null;

  if (value === null) {
    return entry.nullable ? null : { field: entry.field_key, reason: "null_not_allowed" };
  }

  switch (entry.data_type) {
    case "string":
      return typeof value === "string" ? null : { field: entry.field_key, reason: "expected_string" };
    case "enum": {
      if (typeof value !== "string") {
        return { field: entry.field_key, reason: "expected_enum_string" };
      }
      const allowed = parseAllowedValues(entry);
      if (allowed.length === 0) {
        return { field: entry.field_key, reason: "enum_missing_allowed_values" };
      }
      return allowed.includes(value)
        ? null
        : { field: entry.field_key, reason: "enum_value_not_allowed" };
    }
    case "int":
      if (typeof value === "number") {
        return Number.isInteger(value) ? null : { field: entry.field_key, reason: "expected_int" };
      }
      if (typeof value === "string" && isNumericString(value)) {
        return Number.isInteger(Number(value))
          ? null
          : { field: entry.field_key, reason: "expected_int" };
      }
      return { field: entry.field_key, reason: "expected_int" };
    case "float":
      if (typeof value === "number") {
        return Number.isFinite(value) ? null : { field: entry.field_key, reason: "expected_float" };
      }
      if (typeof value === "string" && isNumericString(value)) {
        return Number.isFinite(Number(value))
          ? null
          : { field: entry.field_key, reason: "expected_float" };
      }
      return { field: entry.field_key, reason: "expected_float" };
    case "url":
      if (typeof value !== "string") {
        return { field: entry.field_key, reason: "expected_url_string" };
      }
      try {
        // eslint-disable-next-line no-new
        new URL(value);
        return null;
      } catch {
        return { field: entry.field_key, reason: "invalid_url" };
      }
    case "date":
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return null;
      }
      if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
        return null;
      }
      return { field: entry.field_key, reason: "invalid_date" };
    case "json":
      return null;
    default:
      return { field: entry.field_key, reason: "unknown_type" };
  }
}

export function validateClientRecordUpdate(
  updates: Record<string, unknown>
): ClientRecordValidationResult {
  const catalog = getClientRecordCatalog();
  const clientEntries = catalog.filter((entry) => entry.field_key.startsWith("client."));
  const entryMap = new Map<string, FieldCatalogEntry>();
  for (const entry of clientEntries) {
    const [, field] = entry.field_key.split(".");
    if (field) entryMap.set(field, entry);
  }

  const errors: ClientRecordValidationError[] = [];
  const validatedFields: string[] = [];

  for (const [field, value] of Object.entries(updates)) {
    const entry = entryMap.get(field);
    if (!entry) continue;
    const error = validateValue(entry, value);
    if (error) {
      errors.push(error);
    } else {
      validatedFields.push(field);
    }
  }

  return { ok: errors.length === 0, errors, validatedFields };
}
