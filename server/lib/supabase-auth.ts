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
  role: 'Client' | 'Staff' | 'Admin' | 'SuperAdmin',
  agencyId?: string
): Promise<{ user: SupabaseUser; profileId: string }> {
  const isSuperAdmin = role === 'SuperAdmin';
  
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
      role: role, // Store role in app_metadata for security
      is_super_admin: isSuperAdmin // Set SuperAdmin flag for stateless JWT auth
    }
  });

  if (error || !data.user) {
    throw new Error(`Failed to create user: ${error?.message || 'Unknown error'}`);
  }

  // Create profile in our database
  const [profile] = await db.insert(profiles).values({
    id: data.user.id, // Use Supabase Auth user ID
    fullName,
    email, // Mirror email from Supabase Auth
    role,
    agencyId: agencyId || null,
    isSuperAdmin // Set SuperAdmin flag in profiles table
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

/**
 * Update user email in Supabase Auth and profiles table (SuperAdmin only)
 */
export async function updateUserEmail(
  userId: string,
  newEmail: string
): Promise<void> {
  // Update email in Supabase Auth
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    email: newEmail,
    email_confirm: true // Skip confirmation email
  });

  if (error) {
    throw new Error(`Failed to update user email: ${error.message}`);
  }

  // Also update email in profiles table to keep in sync
  await db.update(profiles)
    .set({ email: newEmail })
    .where(eq(profiles.id, userId));
}

/**
 * Update user password in Supabase Auth (SuperAdmin only)
 */
export async function updateUserPassword(
  userId: string,
  newPassword: string
): Promise<void> {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword
  });

  if (error) {
    throw new Error(`Failed to update user password: ${error.message}`);
  }
}

/**
 * Promote user to SuperAdmin (SuperAdmin only)
 * Only Admin and Staff users can be promoted. Clients cannot be promoted due to agency-scoped constraints.
 */
export async function promoteUserToSuperAdmin(userId: string): Promise<Profile> {
  // 1. Fetch current profile to validate eligibility
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!profile) {
    throw new Error('User not found');
  }

  // Store pre-promotion state for logging and rollback
  const oldState = {
    role: profile.role,
    isSuperAdmin: profile.isSuperAdmin,
    agencyId: profile.agencyId
  };

  console.log('[PROMOTE_SUPERADMIN] Starting promotion for user', {
    userId,
    email: profile.email,
    oldRole: oldState.role,
    oldAgencyId: oldState.agencyId
  });

  // 2. Check if already SuperAdmin
  if (profile.isSuperAdmin) {
    throw new Error('User is already a SuperAdmin');
  }

  // 3. Only Admin and Staff can be promoted (Clients have agency-scoped client records)
  if (profile.role === 'Client') {
    throw new Error('Clients cannot be promoted to SuperAdmin. Convert to Staff/Admin first.');
  }

  if (!['Admin', 'Staff'].includes(profile.role)) {
    throw new Error('Only Admin and Staff users can be promoted to SuperAdmin');
  }

  // 4. Update Supabase Auth app_metadata first
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: {
      role: 'SuperAdmin',
      is_super_admin: true,
      agency_id: null // SuperAdmins are not bound to any agency
    }
  });

  if (authError) {
    console.error('[PROMOTE_SUPERADMIN] Supabase Auth update failed', { userId, error: authError.message });
    throw new Error(`Failed to update Supabase Auth metadata: ${authError.message}`);
  }

  console.log('[PROMOTE_SUPERADMIN] Supabase Auth updated successfully', { userId });

  // 5. Update profiles table in transaction (future-proof for multi-step DB updates)
  try {
    await db.transaction(async (tx) => {
      await tx.update(profiles)
        .set({
          role: 'SuperAdmin',
          isSuperAdmin: true,
          agencyId: null // Clear agency association
        })
        .where(eq(profiles.id, userId));
      
      // Future: Add additional cleanup steps here (e.g., clearing agency-scoped relations)
    });

    console.log('[PROMOTE_SUPERADMIN] Promotion successful', {
      userId,
      email: profile.email,
      oldRole: oldState.role,
      newRole: 'SuperAdmin',
      oldAgencyId: oldState.agencyId,
      newAgencyId: null
    });

    // 6. Fetch and return updated profile
    const [updatedProfile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!updatedProfile) {
      throw new Error('Failed to fetch updated profile');
    }

    return updatedProfile;
  } catch (dbError: any) {
    // Rollback Supabase Auth changes if DB update fails
    console.error('[PROMOTE_SUPERADMIN] Database update failed, attempting rollback...', {
      userId,
      error: dbError.message
    });
    
    try {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        app_metadata: {
          role: oldState.role,
          is_super_admin: oldState.isSuperAdmin,
          agency_id: oldState.agencyId
        }
      });
      console.log('[PROMOTE_SUPERADMIN] Rollback successful', {
        userId,
        restoredState: oldState
      });
    } catch (rollbackError: any) {
      console.error('[PROMOTE_SUPERADMIN] CRITICAL: Rollback failed!', {
        userId,
        email: profile.email,
        rollbackError: rollbackError.message,
        originalError: dbError.message,
        oldState,
        message: 'Manual intervention required - Supabase Auth and DB are out of sync'
      });
      throw new Error(`Promotion failed and rollback unsuccessful: ${dbError.message}`);
    }
    
    throw new Error(`Failed to update profile: ${dbError.message}`);
  }
}
