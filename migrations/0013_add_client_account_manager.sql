ALTER TABLE "clients"
ADD COLUMN IF NOT EXISTS "account_manager_profile_id" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clients_account_manager_profile_id_profiles_id_fk'
  ) THEN
    ALTER TABLE "clients"
    ADD CONSTRAINT "clients_account_manager_profile_id_profiles_id_fk"
    FOREIGN KEY ("account_manager_profile_id")
    REFERENCES "profiles"("id")
    ON DELETE SET NULL
    ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "clients_account_manager_profile_id_idx"
ON "clients" ("account_manager_profile_id");
