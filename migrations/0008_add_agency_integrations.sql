-- Create agency integrations table
CREATE TABLE IF NOT EXISTS "agency_integrations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agency_id" uuid NOT NULL REFERENCES "agencies"("id") ON DELETE CASCADE,
  "service_name" text NOT NULL,
  "dataforseo_login" text,
  "dataforseo_password" text,
  "dataforseo_login_iv" text,
  "dataforseo_password_iv" text,
  "dataforseo_login_auth_tag" text,
  "dataforseo_password_auth_tag" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create unique index for agency_id + service_name
CREATE UNIQUE INDEX IF NOT EXISTS "agency_integrations_agency_service_idx" ON "agency_integrations" ("agency_id", "service_name");

-- Create agency integration client access table
CREATE TABLE IF NOT EXISTS "agency_integration_client_access" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agency_integration_id" uuid NOT NULL REFERENCES "agency_integrations"("id") ON DELETE CASCADE,
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create unique index for agency_integration_id + client_id
CREATE UNIQUE INDEX IF NOT EXISTS "agency_integration_client_access_idx" ON "agency_integration_client_access" ("agency_integration_id", "client_id");

-- Create additional indexes
CREATE INDEX IF NOT EXISTS "access_agency_integration_id_idx" ON "agency_integration_client_access" ("agency_integration_id");
CREATE INDEX IF NOT EXISTS "access_client_id_idx" ON "agency_integration_client_access" ("client_id");
