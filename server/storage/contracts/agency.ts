import type { Agency, Profile, Client } from "@shared/schema";

export interface AgencyStorage {
  getDefaultAgency(): Promise<Agency | undefined>;
  getAgencyById(id: string): Promise<Agency | undefined>;
  deleteAgency(id: string): Promise<void>;
  getAllAgenciesForSuperAdmin(): Promise<Array<Agency & { userCount: number; clientCount: number }>>;
}
