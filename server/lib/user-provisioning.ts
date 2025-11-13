import { supabaseAdmin } from './supabase';
import { db } from '../db';
import { profiles, clients } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import logger from '../middleware/logger';

/**
 * User provisioning service with compensation-based transaction handling
 * Ensures atomicity between Supabase Auth and database operations
 */

interface UserProvisioningOptions {
  email: string;
  password: string;
  fullName: string;
  role: 'Client' | 'Staff' | 'Admin' | 'SuperAdmin';
  agencyId?: string | null;
  clientData?: {
    companyName: string;
    businessContext?: string;
    retainerAmount?: number;
    billingDay?: number;
  };
}

interface UserProvisioningResult {
  user: SupabaseUser;
  profileId: string;
  clientId?: string;
}

/**
 * Provision a new user with robust error handling and compensation
 * 
 * This service ensures atomicity across Supabase Auth and database:
 * 1. Fail-fast: Check if email already exists before creating auth user
 * 2. Create auth user with app_metadata (agency_id, role)
 * 3. Create database records in a transaction (profile + optional client)
 * 4. Compensation: If DB transaction fails, delete the auth user (rollback)
 */
export async function provisionUser(options: UserProvisioningOptions): Promise<UserProvisioningResult> {
  const { email, password, fullName, role, agencyId, clientData } = options;
  const isSuperAdmin = role === 'SuperAdmin';
  
  logger.info(`[USER_PROVISIONING] Starting provisioning for ${email} with role ${role}`);
  
  let authUserId: string | null = null;
  
  try {
    // STEP 1: Fail-fast email validation
    logger.info(`[USER_PROVISIONING] Step 1: Checking if email already exists`);
    
    // Check profiles table first (faster than Supabase Auth API)
    const [existingProfile] = await db.select()
      .from(profiles)
      .where(eq(profiles.email, email.toLowerCase()))
      .limit(1);
    
    if (existingProfile) {
      logger.warn(`[USER_PROVISIONING] Email already exists in profiles table: ${email}`);
      throw new Error('A user with this email address has already been registered');
    }
    
    // Check Supabase Auth with pagination to ensure we check ALL users
    const emailExists = await checkAuthUserExists(email);
    
    if (emailExists) {
      logger.warn(`[USER_PROVISIONING] Email already exists in Supabase Auth: ${email}`);
      throw new Error('A user with this email address has already been registered');
    }
    
    logger.info(`[USER_PROVISIONING] Email validation passed`);
    
    // STEP 2: Create Supabase Auth user with app_metadata
    logger.info(`[USER_PROVISIONING] Step 2: Creating Supabase Auth user`);
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        fullName,
      },
      // CRITICAL: Use app_metadata for security-critical fields (immutable by user)
      app_metadata: {
        agency_id: agencyId || null,
        role: role,
        is_super_admin: isSuperAdmin
      }
    });
    
    if (authError || !authData.user) {
      logger.error(`[USER_PROVISIONING] Failed to create auth user: ${authError?.message}`);
      throw new Error(`Failed to create user: ${authError?.message || 'Unknown error'}`);
    }
    
    authUserId = authData.user.id;
    logger.info(`[USER_PROVISIONING] Auth user created successfully: ${authUserId}`);
    
    // STEP 3: Create database records in transaction
    logger.info(`[USER_PROVISIONING] Step 3: Creating database records in transaction`);
    
    const result = await db.transaction(async (tx) => {
      // Create profile
      const [profile] = await tx.insert(profiles).values({
        id: authData.user.id,
        fullName,
        email: email.toLowerCase(), // Mirror email from Supabase Auth
        role,
        agencyId: agencyId || null,
        isSuperAdmin
      }).returning();
      
      logger.info(`[USER_PROVISIONING] Profile created: ${profile.id}`);
      
      // Create client record if provided
      let clientId: string | undefined;
      if (clientData && role === 'Client') {
        const [client] = await tx.insert(clients).values({
          companyName: clientData.companyName,
          profileId: profile.id,
          agencyId: agencyId!,
          businessContext: clientData.businessContext || null,
          retainerAmount: clientData.retainerAmount || 0,
          billingDay: clientData.billingDay || 1,
        }).returning();
        
        clientId = client.id;
        logger.info(`[USER_PROVISIONING] Client record created: ${clientId}`);
      }
      
      return {
        profileId: profile.id,
        clientId
      };
    });
    
    logger.info(`[USER_PROVISIONING] Database transaction completed successfully`);
    logger.info(`[USER_PROVISIONING] User provisioning completed for ${email}`);
    
    return {
      user: authData.user,
      profileId: result.profileId,
      clientId: result.clientId
    };
    
  } catch (error: any) {
    logger.error(`[USER_PROVISIONING] Error during provisioning: ${error.message}`);
    
    // COMPENSATION: If we created an auth user but DB failed, delete it
    if (authUserId) {
      logger.warn(`[USER_PROVISIONING] Rolling back: Deleting auth user ${authUserId}`);
      try {
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
        if (deleteError) {
          logger.error(`[USER_PROVISIONING] Failed to delete auth user during rollback: ${deleteError.message}`);
          logger.error(`[USER_PROVISIONING] CRITICAL: Orphaned user may exist: ${authUserId} (${email})`);
        } else {
          logger.info(`[USER_PROVISIONING] Auth user deleted successfully during rollback`);
        }
      } catch (deleteErr: any) {
        logger.error(`[USER_PROVISIONING] Exception during rollback: ${deleteErr.message}`);
        logger.error(`[USER_PROVISIONING] CRITICAL: Orphaned user may exist: ${authUserId} (${email})`);
      }
    }
    
    // Re-throw the original error
    throw error;
  }
}

/**
 * Check if a user with the given email exists in Supabase Auth
 * Handles pagination to check ALL users, not just first page
 */
async function checkAuthUserExists(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase();
  let page = 1;
  const perPage = 1000; // Max allowed by Supabase
  
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage
    });
    
    if (error) {
      logger.error(`[USER_PROVISIONING] Error checking auth users: ${error.message}`);
      throw new Error(`Failed to check existing users: ${error.message}`);
    }
    
    const users = data?.users || [];
    
    // Check if email exists in this page
    const found = users.some(u => u.email?.toLowerCase() === normalizedEmail);
    if (found) {
      return true;
    }
    
    // If we got fewer users than perPage, we've reached the end
    if (users.length < perPage) {
      break;
    }
    
    page++;
  }
  
  return false;
}

/**
 * Get all users from Supabase Auth with pagination
 */
async function getAllAuthUsers() {
  const allUsers: any[] = [];
  let page = 1;
  const perPage = 1000; // Max allowed by Supabase
  
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage
    });
    
    if (error) {
      logger.error(`[ORPHAN_DETECTION] Error listing auth users: ${error.message}`);
      throw new Error(`Failed to list auth users: ${error.message}`);
    }
    
    const users = data?.users || [];
    allUsers.push(...users);
    
    // If we got fewer users than perPage, we've reached the end
    if (users.length < perPage) {
      break;
    }
    
    page++;
  }
  
  return allUsers;
}

/**
 * Check for orphaned users (users in Supabase Auth without profiles)
 * Returns array of orphaned user IDs and emails
 */
export async function detectOrphanedUsers(): Promise<Array<{ id: string; email: string }>> {
  logger.info(`[ORPHAN_DETECTION] Starting orphan detection`);
  
  try {
    // Get all users from Supabase Auth (with pagination)
    const authUsers = await getAllAuthUsers();
    
    logger.info(`[ORPHAN_DETECTION] Found ${authUsers.length} users in Supabase Auth`);
    
    // Get all profiles from database
    const allProfiles = await db.select({ id: profiles.id }).from(profiles);
    const profileIds = new Set(allProfiles.map(p => p.id));
    
    logger.info(`[ORPHAN_DETECTION] Found ${profileIds.size} profiles in database`);
    
    // Find orphaned users
    const orphans = authUsers
      .filter(user => !profileIds.has(user.id))
      .map(user => ({ id: user.id, email: user.email || 'unknown' }));
    
    logger.info(`[ORPHAN_DETECTION] Found ${orphans.length} orphaned users`);
    
    return orphans;
  } catch (error: any) {
    logger.error(`[ORPHAN_DETECTION] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Clean up orphaned users (delete from Supabase Auth)
 */
export async function cleanupOrphanedUsers(): Promise<{ deleted: number; errors: number }> {
  logger.info(`[ORPHAN_CLEANUP] Starting orphan cleanup`);
  
  const orphans = await detectOrphanedUsers();
  
  if (orphans.length === 0) {
    logger.info(`[ORPHAN_CLEANUP] No orphaned users found`);
    return { deleted: 0, errors: 0 };
  }
  
  let deleted = 0;
  let errors = 0;
  
  for (const orphan of orphans) {
    try {
      logger.info(`[ORPHAN_CLEANUP] Deleting orphaned user: ${orphan.id} (${orphan.email})`);
      const { error } = await supabaseAdmin.auth.admin.deleteUser(orphan.id);
      
      if (error) {
        logger.error(`[ORPHAN_CLEANUP] Failed to delete ${orphan.id}: ${error.message}`);
        errors++;
      } else {
        logger.info(`[ORPHAN_CLEANUP] Deleted ${orphan.id} successfully`);
        deleted++;
      }
    } catch (err: any) {
      logger.error(`[ORPHAN_CLEANUP] Exception deleting ${orphan.id}: ${err.message}`);
      errors++;
    }
  }
  
  logger.info(`[ORPHAN_CLEANUP] Cleanup complete: ${deleted} deleted, ${errors} errors`);
  
  return { deleted, errors };
}
