import { z } from "zod";

export const FIELD_TYPES = ["string", "enum", "int", "float", "url", "date", "json"] as const;
export type FieldType = typeof FIELD_TYPES[number];

export const CONFIDENCE_LEVELS = ["high", "med", "low"] as const;
export type ConfidenceLevel = typeof CONFIDENCE_LEVELS[number];

export const UPDATE_MODES = ["manual", "signal", "derived"] as const;
export type UpdateMode = typeof UPDATE_MODES[number];

export const FIELD_CATALOG_SCHEMA = z.object({
  field_key: z.string().min(1),
  plane: z.literal("data"),
  primitive_owner: z.string().regex(/^P[1-8]$/),
  data_type: z.enum(FIELD_TYPES),
  allowed_values: z.string().optional(),
  nullable: z.coerce.boolean(),
  scope: z.enum(["agency", "client"]),
  read_roles: z.string().min(1),
  write_roles: z.string().min(1),
  ai_exposed: z.coerce.boolean(),
  update_mode: z.enum(UPDATE_MODES),
  signal_source: z.string().optional(),
  freshness_sla_days: z.coerce.number().int().positive().optional(),
  confidence_required: z.enum(CONFIDENCE_LEVELS).optional(),
  audit_required: z.coerce.boolean(),
});

export type FieldCatalogEntry = z.infer<typeof FIELD_CATALOG_SCHEMA>;

export const FIELD_CATALOG_LIST_SCHEMA = z.array(FIELD_CATALOG_SCHEMA).min(1);

export const CLIENT_RECORD_INPUT_SCHEMA = z.object({
  client: z.object({
    id: z.string().uuid().optional(),
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

export type ClientRecordAIInput = z.infer<typeof CLIENT_RECORD_INPUT_SCHEMA>;
