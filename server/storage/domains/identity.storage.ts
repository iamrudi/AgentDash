import type { DbCtx } from "../db/db";
import type { IdentityStorage } from "../contracts/identity";
import type {
  User,
  InsertUser,
  Profile,
  InsertProfile,
  Client,
} from "@shared/schema";
import { users, profiles, clients } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";

export function identityStorage(db: DbCtx): IdentityStorage {
  async function getClientByProfileId(profileId: string): Promise<Client | undefined> {
    const result = await db.select().from(clients).where(eq(clients.profileId, profileId)).limit(1);
    return result[0];
  }

  return {
    async getUserById(id: string): Promise<User | undefined> {
      const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return result[0];
    },

    async getUserByEmail(email: string): Promise<User | undefined> {
      const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
      return result[0];
    },

    async createUser(insertUser: InsertUser): Promise<User> {
      const hashedPassword = await bcrypt.hash(insertUser.password, 10);
      const result = await db.insert(users).values({
        ...insertUser,
        password: hashedPassword,
      }).returning();
      return result[0];
    },

    async getAllUsersWithProfiles(agencyId?: string): Promise<Array<User & { profile: Profile | null; client?: Client | null }>> {
      if (agencyId) {
        const [agencyProfiles, agencyClients] = await Promise.all([
          db.select().from(profiles).where(eq(profiles.agencyId, agencyId)),
          db.select().from(clients).where(eq(clients.agencyId, agencyId))
        ]);
        
        const clientMap = new Map(agencyClients.map(c => [c.profileId, c]));
        
        const usersWithProfiles = agencyProfiles.map((profile) => {
          let client = null;
          if (profile.role === "Client") {
            client = clientMap.get(profile.id) || null;
          }
          return {
            id: profile.id,
            email: '',
            password: '',
            createdAt: profile.createdAt,
            profile,
            client,
          };
        });
        
        return usersWithProfiles.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
      
      const allProfiles = await db.select().from(profiles).orderBy(desc(profiles.createdAt));
      
      const usersWithProfiles = await Promise.all(
        allProfiles.map(async (profile) => {
          let client = null;
          if (profile.role === "Client") {
            client = await getClientByProfileId(profile.id);
          }
          return {
            id: profile.id,
            email: '',
            password: '',
            createdAt: profile.createdAt,
            profile,
            client: client || null,
          };
        })
      );
      
      return usersWithProfiles;
    },

    async updateUserRole(userId: string, role: string): Promise<void> {
      const result = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
      const profile = result[0];
      if (!profile) {
        throw new Error("Profile not found");
      }
      
      await db.update(profiles)
        .set({ role })
        .where(eq(profiles.id, userId));
    },

    async deleteUser(userId: string): Promise<void> {
      await db.delete(users).where(eq(users.id, userId));
    },

    async getProfileByUserId(userId: string): Promise<Profile | undefined> {
      const result = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
      return result[0];
    },

    async getProfileById(id: string): Promise<Profile | undefined> {
      const result = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
      return result[0];
    },

    async getStaffProfileById(id: string): Promise<Profile | undefined> {
      const result = await db.select().from(profiles)
        .where(and(eq(profiles.id, id), eq(profiles.role, "Staff")))
        .limit(1);
      return result[0];
    },

    async getAllStaff(agencyId?: string): Promise<Profile[]> {
      if (agencyId) {
        return await db.select().from(profiles)
          .where(and(eq(profiles.role, "Staff"), eq(profiles.agencyId, agencyId)))
          .orderBy(desc(profiles.createdAt));
      }
      return await db.select().from(profiles).where(eq(profiles.role, "Staff")).orderBy(desc(profiles.createdAt));
    },

    async createProfile(profile: InsertProfile): Promise<Profile> {
      const result = await db.insert(profiles).values(profile).returning();
      return result[0];
    },

    async updateUserProfile(userId: string, data: { fullName?: string; skills?: string[] }): Promise<Profile | undefined> {
      const updateFields: Record<string, unknown> = {};
      if (data.fullName !== undefined) {
        updateFields.fullName = data.fullName;
      }
      if (data.skills !== undefined) {
        updateFields.skills = data.skills;
      }
      
      if (Object.keys(updateFields).length === 0) {
        const result = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
        return result[0];
      }
      
      const result = await db.update(profiles)
        .set(updateFields)
        .where(eq(profiles.id, userId))
        .returning();
      
      return result[0];
    },
  };
}
