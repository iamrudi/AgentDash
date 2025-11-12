-- Create agency settings table for AI provider configuration
CREATE TABLE IF NOT EXISTS "agency_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agency_id" uuid NOT NULL REFERENCES "agencies"("id") ON DELETE CASCADE,
  "ai_provider" text NOT NULL DEFAULT 'gemini',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create unique constraint on agency_id (one settings record per agency)
CREATE UNIQUE INDEX IF NOT EXISTS "agency_settings_agency_id_unique" ON "agency_settings" ("agency_id");

-- Create index for agency_id lookups
CREATE INDEX IF NOT EXISTS "agency_settings_agency_id_idx" ON "agency_settings" ("agency_id");
