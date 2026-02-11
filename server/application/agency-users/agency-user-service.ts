import type { IStorage } from "../../storage";
import {
  createClientUserSchema,
  createStaffAdminUserSchema,
} from "@shared/schema";

interface AgencyUserDeps {
  deleteUser: (userId: string) => Promise<void>;
  provisionUser: (payload: {
    email: string;
    password: string;
    fullName: string;
    role: "Client" | "Staff" | "Admin";
    agencyId: string;
    clientData?: { companyName: string; accountManagerProfileId?: string };
  }) => Promise<{ clientId?: string; profileId?: string }>;
}

const defaultDeps: AgencyUserDeps = {
  deleteUser: async (userId) => {
    const { deleteUser } = await import("../../lib/supabase-auth");
    await deleteUser(userId);
  },
  provisionUser: async (payload) => {
    const { provisionUser } = await import("../../lib/user-provisioning");
    return provisionUser(payload);
  },
};

export interface AgencyUserResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  errors?: unknown;
}

export class AgencyUserService {
  constructor(private readonly storage: IStorage, private readonly deps: AgencyUserDeps = defaultDeps) {}

  async listUsers(agencyId: string | undefined): Promise<AgencyUserResult<unknown>> {
    const users = await this.storage.getAllUsersWithProfiles(agencyId);
    return { ok: true, status: 200, data: users };
  }

  async updateRole(userId: string, role: unknown): Promise<AgencyUserResult<{ message: string }>> {
    if (!["Client", "Staff", "Admin"].includes(String(role))) {
      return { ok: false, status: 400, error: "Invalid role" };
    }

    await this.storage.updateUserRole(userId, String(role));
    return { ok: true, status: 200, data: { message: "User role updated successfully" } };
  }

  async deleteUser(currentUserId: string | undefined, targetUserId: string): Promise<AgencyUserResult<{ message: string }>> {
    if (currentUserId === targetUserId) {
      return { ok: false, status: 400, error: "Cannot delete your own account" };
    }

    await this.deps.deleteUser(targetUserId);
    return { ok: true, status: 200, data: { message: "User deleted successfully" } };
  }

  async createClientUser(
    agencyId: string,
    payload: unknown,
    actorProfileId?: string
  ): Promise<AgencyUserResult<unknown>> {
    const parsed = createClientUserSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        status: 400,
        error: "Validation failed",
        errors: parsed.error.errors.map((entry) => ({
          field: entry.path.join("."),
          message: entry.message,
        })),
      };
    }

    const selectedAccountManagerProfileId =
      parsed.data.accountManagerProfileId || actorProfileId;

    if (selectedAccountManagerProfileId) {
      const accountManager = await this.storage.getProfileById(selectedAccountManagerProfileId);
      if (!accountManager || accountManager.role !== "Admin" || accountManager.agencyId !== agencyId) {
        return {
          ok: false,
          status: 400,
          error: "Account manager must be an Admin in the same agency",
        };
      }
    }

    const result = await this.deps.provisionUser({
      email: parsed.data.email,
      password: parsed.data.password,
      fullName: parsed.data.fullName,
      role: "Client",
      agencyId,
      clientData: {
        companyName: parsed.data.companyName,
        accountManagerProfileId: selectedAccountManagerProfileId,
      },
    });

    return {
      ok: true,
      status: 201,
      data: {
        message: "Client created successfully",
        client: {
          id: result.clientId!,
          companyName: parsed.data.companyName,
          user: {
            email: parsed.data.email,
            fullName: parsed.data.fullName,
          },
        },
      },
    };
  }

  async createStaffOrAdminUser(
    agencyId: string,
    payload: unknown
  ): Promise<AgencyUserResult<unknown>> {
    const parsed = createStaffAdminUserSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        status: 400,
        error: "Validation failed",
        errors: parsed.error.errors.map((entry) => ({
          field: entry.path.join("."),
          message: entry.message,
        })),
      };
    }

    const result = await this.deps.provisionUser({
      email: parsed.data.email,
      password: parsed.data.password,
      fullName: parsed.data.fullName,
      role: parsed.data.role,
      agencyId,
    });

    return {
      ok: true,
      status: 201,
      data: {
        message: `${parsed.data.role} user created successfully`,
        user: {
          id: result.profileId,
          email: parsed.data.email,
          fullName: parsed.data.fullName,
          role: parsed.data.role,
        },
      },
    };
  }
}
