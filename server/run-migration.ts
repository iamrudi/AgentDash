import { migrateToTenantIsolation } from "./migrations/add-tenant-isolation";

// Run the migration
migrateToTenantIsolation()
  .then(() => {
    console.log("Migration completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
