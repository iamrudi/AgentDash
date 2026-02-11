import { updateUserEmailSchema, updateUserPasswordSchema } from "@shared/schema";
import type { IStorage } from "../../storage";

type Role = "Client" | "Staff" | "Admin" | "SuperAdmin";

interface SuperadminUserDeps {
  updateUserEmail: (userId: string, email: string) => Promise<void>;
  updateUserPassword: (userId: string, password: string) => Promise<void>;
  promoteUserToSuperAdmin: (userId: string) => Promise<any>;
  updateUserRole: (userId: string, role: Role, agencyId?: string | null) => Promise<any>;
  deleteUser: (userId: string) => Promise<void>;
  getAuthUserEmail: (userId: string) => Promise<string | undefined>;
}

const defaultDeps: SuperadminUserDeps = {
  updateUserEmail: async (userId, email) => {
    const { updateUserEmail } = await import("../../lib/supabase-auth");
    await updateUserEmail(userId, email);
  },
  updateUserPassword: async (userId, password) => {
    const { updateUserPassword } = await import("../../lib/supabase-auth");
    await updateUserPassword(userId, password);
  },
  promoteUserToSuperAdmin: async (userId) => {
    const { promoteUserToSuperAdmin } = await import("../../lib/supabase-auth");
    return promoteUserToSuperAdmin(userId);
  },
  updateUserRole: async (userId, role, agencyId) => {
    const { updateUserRole } = await import("../../lib/supabase-auth");
    return updateUserRole(userId, role, agencyId ?? undefined);
  },
  deleteUser: async (userId) => {
    const { deleteUser } = await import("../../lib/supabase-auth");
    await deleteUser(userId);
  },
  getAuthUserEmail: async (userId) => {
    const { supabaseAdmin } = await import("../../lib/supabase");
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    return data?.user?.email;
  },
};

interface AuditEvent {
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: Record<string, unknown>;
}

export interface SuperadminUserResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  errors?: unknown;
  auditEvent?: AuditEvent;
}

export class SuperadminUserService {
  constructor(private storage: IStorage, private deps: SuperadminUserDeps = defaultDeps) {}

  async updateEmail(userId: string, payload: unknown): Promise<SuperadminUserResult<{ message: string }>> {
    const validation = updateUserEmailSchema.safeParse(payload);
    if (!validation.success) {
      return {
        ok: false,
        status: 400,
        error: "Invalid email address",
        errors: validation.error.errors,
      };
    }

    const oldUser = await this.storage.getUserById(userId);
    if (!oldUser) {
      return { ok: false, status: 404, error: "User not found" };
    }

    const oldEmail = (await this.deps.getAuthUserEmail(userId)) ?? "unknown";
    await this.deps.updateUserEmail(userId, validation.data.email);

    return {
      ok: true,
      status: 200,
      data: { message: "User email updated successfully" },
      auditEvent: {
        action: "user.update_email",
        resourceType: "user",
        resourceId: userId,
        details: { oldEmail, newEmail: validation.data.email },
      },
    };
  }

  async updatePassword(userId: string, payload: unknown): Promise<SuperadminUserResult<{ message: string }>> {
    const validation = updateUserPasswordSchema.safeParse(payload);
    if (!validation.success) {
      return {
        ok: false,
        status: 400,
        error: "Invalid password",
        errors: validation.error.errors,
      };
    }

    const user = await this.storage.getUserById(userId);
    if (!user) {
      return { ok: false, status: 404, error: "User not found" };
    }

    await this.deps.updateUserPassword(userId, validation.data.password);

    return {
      ok: true,
      status: 200,
      data: { message: "User password updated successfully" },
      auditEvent: {
        action: "user.update_password",
        resourceType: "user",
        resourceId: userId,
        details: { passwordChanged: true },
      },
    };
  }

  async promoteToSuperadmin(userId: string): Promise<SuperadminUserResult<{ message: string; profile: unknown }>> {
    const profile = await this.storage.getProfileById(userId);
    if (!profile) {
      return { ok: false, status: 404, error: "User not found" };
    }

    const oldState = {
      role: profile.role,
      isSuperAdmin: profile.isSuperAdmin,
      agencyId: profile.agencyId,
    };
    const updatedProfile = await this.deps.promoteUserToSuperAdmin(userId);

    return {
      ok: true,
      status: 200,
      data: { message: "User promoted to SuperAdmin successfully", profile: updatedProfile },
      auditEvent: {
        action: "user.promote_superadmin",
        resourceType: "user",
        resourceId: userId,
        details: {
          oldRole: oldState.role,
          newRole: "SuperAdmin",
          oldAgencyId: oldState.agencyId,
          newAgencyId: null,
          oldIsSuperAdmin: oldState.isSuperAdmin,
          newIsSuperAdmin: true,
        },
      },
    };
  }

  async updateRole(
    userId: string,
    payload: { role?: unknown; agencyId?: unknown }
  ): Promise<SuperadminUserResult<{ message: string; profile: unknown }>> {
    const role = payload?.role;
    if (!role || !["Client", "Staff", "Admin", "SuperAdmin"].includes(String(role))) {
      return { ok: false, status: 400, error: "Invalid role specified" };
    }

    const profile = await this.storage.getProfileById(userId);
    if (!profile) {
      return { ok: false, status: 404, error: "User not found" };
    }

    const oldState = {
      role: profile.role,
      isSuperAdmin: profile.isSuperAdmin,
      agencyId: profile.agencyId,
    };

    const updatedProfile = await this.deps.updateUserRole(
      userId,
      role as Role,
      (payload?.agencyId as string | null | undefined) ?? undefined
    );

    return {
      ok: true,
      status: 200,
      data: { message: "User role updated successfully", profile: updatedProfile },
      auditEvent: {
        action: "user.role_update",
        resourceType: "user",
        resourceId: userId,
        details: {
          oldRole: oldState.role,
          newRole: role,
          oldAgencyId: oldState.agencyId,
          newAgencyId: updatedProfile.agencyId,
          oldIsSuperAdmin: oldState.isSuperAdmin,
          newIsSuperAdmin: updatedProfile.isSuperAdmin,
        },
      },
    };
  }

  async deleteUser(userId: string): Promise<SuperadminUserResult<{ message: string }>> {
    const user = await this.storage.getUserById(userId);
    if (!user) {
      return { ok: false, status: 404, error: "User not found" };
    }

    await this.deps.deleteUser(userId);

    return {
      ok: true,
      status: 200,
      data: { message: "User deleted successfully" },
      auditEvent: {
        action: "user.delete",
        resourceType: "user",
        resourceId: userId,
        details: { deletedUser: user },
      },
    };
  }
}
