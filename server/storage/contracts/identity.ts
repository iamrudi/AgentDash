import type {
  User,
  InsertUser,
  Profile,
  InsertProfile,
  Client,
} from "@shared/schema";

export interface IdentityStorage {
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsersWithProfiles(agencyId?: string): Promise<Array<User & { profile: Profile | null; client?: Client | null }>>;
  updateUserRole(userId: string, role: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  
  getProfileByUserId(userId: string): Promise<Profile | undefined>;
  getProfileById(id: string): Promise<Profile | undefined>;
  getStaffProfileById(id: string): Promise<Profile | undefined>;
  getAllStaff(agencyId?: string): Promise<Profile[]>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  updateUserProfile(userId: string, data: { fullName?: string; skills?: string[] }): Promise<Profile | undefined>;
}
