import type { DbCtx } from "../db/db";
import type { AgencyStorage } from "../contracts/agency";
import type { Agency, Client, Profile } from "@shared/schema";
import { agencies, profiles, clients } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

export function agencyStorage(db: DbCtx): AgencyStorage {
  return {
    async getDefaultAgency(): Promise<Agency | undefined> {
      const result = await db.select().from(agencies).orderBy(agencies.createdAt).limit(1);
      return result[0];
    },

    async getAgencyById(id: string): Promise<Agency | undefined> {
      const result = await db.select().from(agencies).where(eq(agencies.id, id)).limit(1);
      return result[0];
    },

    async deleteAgency(id: string): Promise<void> {
      await db.delete(agencies).where(eq(agencies.id, id));
    },

    async getAllAgenciesForSuperAdmin(): Promise<Array<Agency & { userCount: number; clientCount: number }>> {
      const result = await db
        .select({
          id: agencies.id,
          name: agencies.name,
          createdAt: agencies.createdAt,
          userCount: sql<number>`(SELECT COUNT(*) FROM ${profiles} WHERE ${profiles.agencyId} = ${agencies.id})`,
          clientCount: sql<number>`(SELECT COUNT(*) FROM ${clients} WHERE ${clients.agencyId} = ${agencies.id})`,
        })
        .from(agencies)
        .orderBy(desc(agencies.createdAt));

      return result;
    },
  };
}
