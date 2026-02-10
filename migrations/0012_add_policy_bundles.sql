CREATE TABLE IF NOT EXISTS "policy_bundles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agency_id" uuid NOT NULL REFERENCES "agencies"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "status" text NOT NULL DEFAULT 'draft',
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "policy_bundles_agency_id_idx" ON "policy_bundles" ("agency_id");

CREATE TABLE IF NOT EXISTS "policy_bundle_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "bundle_id" uuid NOT NULL REFERENCES "policy_bundles"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'draft',
  "config" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "policy_bundle_versions_bundle_id_idx" ON "policy_bundle_versions" ("bundle_id");
CREATE INDEX IF NOT EXISTS "policy_bundle_versions_version_idx" ON "policy_bundle_versions" ("bundle_id", "version");
