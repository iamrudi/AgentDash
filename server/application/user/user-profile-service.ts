import { updateUserProfileSchema } from "@shared/schema";
import type { IStorage } from "../../storage";

export interface UserProfileResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  errors?: unknown;
}

export class UserProfileService {
  constructor(private readonly storage: IStorage) {}

  async updateProfile(userId: string, payload: unknown): Promise<UserProfileResult<unknown>> {
    const validation = updateUserProfileSchema.safeParse(payload);
    if (!validation.success) {
      return {
        ok: false,
        status: 400,
        error: "Invalid profile data",
        errors: validation.error.errors,
      };
    }

    const updateData: { fullName?: string; skills?: string[] } = {};
    if (validation.data.fullName !== undefined) {
      updateData.fullName = validation.data.fullName;
    }
    if (validation.data.skills !== undefined) {
      updateData.skills = validation.data.skills;
    }

    const updatedProfile = await this.storage.updateUserProfile(userId, updateData);
    if (!updatedProfile) {
      return { ok: false, status: 404, error: "Profile not found" };
    }

    return {
      ok: true,
      status: 200,
      data: {
        message: "Profile updated successfully",
        profile: updatedProfile,
      },
    };
  }

  async getProfile(userId: string): Promise<UserProfileResult<unknown>> {
    const profile = await this.storage.getProfileByUserId(userId);
    if (!profile) {
      return { ok: false, status: 404, error: "Profile not found" };
    }
    return { ok: true, status: 200, data: profile };
  }
}
