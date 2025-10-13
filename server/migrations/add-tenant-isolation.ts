import { db } from "../db";
import { agencies, profiles, clients } from "@shared/schema";
import { eq, isNull } from "drizzle-orm";

/**
 * Migration: Add tenant isolation with agencies table
 * 
 * This migration:
 * 1. Creates a default agency for existing data
 * 2. Associates all existing clients with the default agency
 * 3. Associates all existing Admin/Staff profiles with the default agency
 */
export async function migrateToTenantIsolation() {
  console.log("Starting tenant isolation migration...");

  try {
    // Step 1: Create default agency for existing data
    console.log("Creating default agency...");
    const [defaultAgency] = await db
      .insert(agencies)
      .values({
        name: "Default Agency",
      })
      .returning();

    console.log(`Default agency created with ID: ${defaultAgency.id}`);

    // Step 2: Update all existing clients to use default agency
    console.log("Updating existing clients...");
    const existingClients = await db.select().from(clients);
    
    for (const client of existingClients) {
      await db
        .update(clients)
        .set({ agencyId: defaultAgency.id })
        .where(eq(clients.id, client.id));
    }
    
    console.log(`Updated ${existingClients.length} clients`);

    // Step 3: Update all Admin/Staff profiles to use default agency
    console.log("Updating existing Admin/Staff profiles...");
    const adminStaffProfiles = await db
      .select()
      .from(profiles)
      .where(isNull(profiles.agencyId));

    let updatedCount = 0;
    for (const profile of adminStaffProfiles) {
      if (profile.role === "Admin" || profile.role === "Staff") {
        await db
          .update(profiles)
          .set({ agencyId: defaultAgency.id })
          .where(eq(profiles.id, profile.id));
        updatedCount++;
      }
    }

    console.log(`Updated ${updatedCount} Admin/Staff profiles`);
    console.log("Tenant isolation migration completed successfully!");

    return defaultAgency;
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}
