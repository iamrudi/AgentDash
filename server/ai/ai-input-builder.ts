import fs from "fs";
import path from "path";
import { z } from "zod";
import { FIELD_CATALOG_LIST_SCHEMA, type FieldCatalogEntry, type ClientRecordAIInput } from "./ai-input-schema";
import { selectAIExposedFields } from "./ai-input-selector";

export type AIInputBuildResult =
  | { ok: true; fieldCatalog: FieldCatalogEntry[]; aiInput: ClientRecordAIInput }
  | { ok: false; error: string };

export function loadFieldCatalog(catalogPath: string): FieldCatalogEntry[] {
  const raw = fs.readFileSync(catalogPath, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    throw new Error("Field catalog must include header and at least one row");
  }

  const header = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    for (let i = 0; i < header.length; i += 1) {
      row[header[i]] = values[i] ?? "";
    }
    return row;
  });

  const parseBool = (value: string | undefined): boolean | undefined => {
    if (value === undefined) return undefined;
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
    return undefined;
  };

  const parsed = FIELD_CATALOG_LIST_SCHEMA.safeParse(
    rows.map((row) => ({
      ...row,
      nullable: parseBool(row.nullable),
      ai_exposed: parseBool(row.ai_exposed),
      audit_required: parseBool(row.audit_required),
      allowed_values: row.allowed_values || undefined,
      signal_source: row.signal_source || undefined,
      freshness_sla_days: row.freshness_sla_days || undefined,
      confidence_required: row.confidence_required || undefined,
    }))
  );

  if (!parsed.success) {
    const message = parsed.error.errors.map((err) => err.message).join(", ");
    throw new Error(`Field catalog validation failed: ${message}`);
  }

  return parsed.data;
}

export function buildAIInput(
  catalog: FieldCatalogEntry[],
  clientRecord: Record<string, unknown>
): AIInputBuildResult {
  const exposed = selectAIExposedFields(clientRecord, catalog);

  const schema = z.object({
    client: z.object({
      companyName: z.string().min(1),
      businessContext: z.string().nullable().optional(),
      retainerAmount: z.union([z.string(), z.number()]).optional().nullable(),
      monthlyRetainerHours: z.union([z.string(), z.number()]).optional().nullable(),
      leadEvents: z.array(z.string()).optional().nullable(),
    }),
    signals: z.object({
      hubspot: z.any().optional().nullable(),
      linkedin: z.any().optional().nullable(),
      competitors: z.array(z.string()).optional().nullable(),
    }).optional(),
    metrics: z.object({
      ga4: z.array(
        z.object({
          date: z.string().min(1),
          source: z.string().optional().nullable(),
          sessions: z.number().optional().nullable(),
          conversions: z.number().optional().nullable(),
          clicks: z.number().optional().nullable(),
          impressions: z.number().optional().nullable(),
          spend: z.number().optional().nullable(),
        })
      ).optional().default([]),
      gsc: z.array(
        z.object({
          date: z.string().min(1),
          organicClicks: z.number().optional().nullable(),
          organicImpressions: z.number().optional().nullable(),
          avgPosition: z.number().optional().nullable(),
        })
      ).optional().default([]),
    }).optional().default({ ga4: [], gsc: [] }),
    objectives: z.array(z.string()).optional().default([]),
  });

  const validation = schema.safeParse(exposed);
  if (!validation.success) {
    const message = validation.error.errors.map((err) => err.message).join(", ");
    return { ok: false, error: message };
  }

  return { ok: true, fieldCatalog: catalog, aiInput: validation.data };
}

export function defaultFieldCatalogPath(): string {
  return path.join(process.cwd(), "docs", "client-record-field-catalog.csv");
}
