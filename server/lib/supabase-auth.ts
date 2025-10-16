import { supabaseAdmin } from './supabase';
import { db } from '../db';
import { profiles, clients } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { AuthResponse, User as SupabaseUser } from '@supabase/supabase-js';

/**
 * Create a new user with Supabase Auth and set up profile
 */
export async function createUserWithProfile(
  email: string,
  password: string,
  fullName: string,
  role: 'Client' | 'Staff' | 'Admin',
  agencyId?: string
): Promise<{ user: SupabaseUser; profileId: string }> {
  // Create user in Supabase Auth
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm email
    user_metadata: {
      fullName,
    },
    // CRITICAL: Use app_metadata for security-critical fields (secure, user cannot modify)
    app_metadata: {
      agency_id: agencyId || null,
      role: role // Store role in app_metadata for security
    }
  });

  if (error || !data.user) {
    throw new Error(`Failed to create user: ${error?.message || 'Unknown error'}`);
  }

  // Create profile in our database
  const [profile] = await db.insert(profiles).values({
    id: data.user.id, // Use Supabase Auth user ID
    fullName,
    role,
    agencyId: agencyId || null
  }).returning();

  return {
    user: data.user,
    profileId: profile.id
  };
}

/**
 * Sign in user with Supabase Auth
 */
export async function signInWithPassword(email: string, password: string): Promise<AuthResponse> {
  return await supabaseAdmin.auth.signInWithPassword({
    email,
    password
  });
}

/**
 * Get user profile with agency info
 */
export async function getUserProfile(userId: string) {
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!profile) {
    return null;
  }

  // If user is a client, get client details
  if (profile.role === 'Client') {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.profileId, profile.id))
      .limit(1);

    return { ...profile, clientId: client?.id };
  }

  return profile;
}

/**
 * Delete user from Supabase Auth (cascade deletes profile via DB trigger)
 */
export async function deleteUser(userId: string): Promise<void> {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  
  if (error) {
    throw new Error(`Failed to delete user: ${error.message}`);
  }
  
  // Also delete profile (in case trigger doesn't work)
  await db.delete(profiles).where(eq(profiles.id, userId));
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<AuthResponse> {
  return await supabaseAdmin.auth.refreshSession({ refresh_token: refreshToken });
}

/**
 * Update user metadata in Supabase Auth
 */
export async function updateUserMetadata(
  userId: string,
  updates: { fullName?: string; role?: string; agencyId?: string }
): Promise<void> {
  const userMetadata: Record<string, any> = {};
  const appMetadata: Record<string, any> = {};

  // Separate updates into user_metadata (display info) and app_metadata (secure fields)
  if (updates.fullName !== undefined) userMetadata.fullName = updates.fullName;
  if (updates.role !== undefined) appMetadata.role = updates.role; // Store role in app_metadata for security
  if (updates.agencyId !== undefined) appMetadata.agency_id = updates.agencyId;

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: Object.keys(userMetadata).length > 0 ? userMetadata : undefined,
    app_metadata: Object.keys(appMetadata).length > 0 ? appMetadata : undefined
  });

  if (error) {
    throw new Error(`Failed to update user metadata: ${error.message}`);
  }

  // Also update profile
  const profileUpdates: Record<string, any> = {};
  if (updates.fullName !== undefined) profileUpdates.fullName = updates.fullName;
  if (updates.role !== undefined) profileUpdates.role = updates.role;
  if (updates.agencyId !== undefined) profileUpdates.agencyId = updates.agencyId;

  if (Object.keys(profileUpdates).length > 0) {
    await db.update(profiles)
      .set(profileUpdates)
      .where(eq(profiles.id, userId));
  }
}
