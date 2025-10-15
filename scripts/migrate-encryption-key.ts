#!/usr/bin/env tsx
/**
 * ENCRYPTION_KEY Migration Tool
 * 
 * This script re-encrypts all encrypted credentials when rotating the ENCRYPTION_KEY.
 * 
 * USAGE:
 *   tsx scripts/migrate-encryption-key.ts <OLD_KEY> <NEW_KEY>
 * 
 * EXAMPLE:
 *   tsx scripts/migrate-encryption-key.ts "old-key-base64==" "new-key-base64=="
 * 
 * IMPORTANT:
 * - Backup your database before running this script
 * - Run during maintenance window (no active user sessions)
 * - Test in development environment first
 * - Update ENCRYPTION_KEY environment variable AFTER successful migration
 */

import crypto from 'crypto';
import { db } from '../server/db';
import { clientIntegrations, agencyIntegrations } from '../shared/schema';
import { eq } from 'drizzle-orm';

interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
}

// Validate key format
function validateKey(key: string): Buffer {
  let keyBuffer: Buffer;
  
  if (key.length === 44 && key.endsWith('=')) {
    keyBuffer = Buffer.from(key, 'base64');
  } else {
    keyBuffer = Buffer.from(key);
  }

  if (keyBuffer.length !== 32) {
    throw new Error(`Key must be exactly 32 bytes. Current: ${keyBuffer.length} bytes`);
  }

  return keyBuffer;
}

// Decrypt with old key
function decryptWithOldKey(
  encrypted: string,
  iv: string,
  authTag: string,
  oldKey: Buffer
): string {
  const decipher = crypto.createDecipheriv('aes-256-gcm', oldKey, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Encrypt with new key
function encryptWithNewKey(text: string, newKey: Buffer): EncryptedData {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', newKey, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

// Re-encrypt a credential
function reencryptCredential(
  encrypted: string | null,
  iv: string | null,
  authTag: string | null,
  oldKey: Buffer,
  newKey: Buffer
): EncryptedData | null {
  if (!encrypted || !iv || !authTag) {
    return null; // Skip null/missing credentials
  }

  try {
    const decrypted = decryptWithOldKey(encrypted, iv, authTag, oldKey);
    return encryptWithNewKey(decrypted, newKey);
  } catch (error) {
    console.error('Failed to re-encrypt credential:', error);
    return null;
  }
}

async function migrateClientIntegrations(oldKey: Buffer, newKey: Buffer): Promise<{ migrated: number; skipped: number; failed: number; failedRecords: string[] }> {
  console.log('\n📦 Migrating client_integrations...');
  
  const integrations = await db.select().from(clientIntegrations);
  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  const failedRecords: string[] = [];

  for (const integration of integrations) {
    const updates: any = {};
    let hasUpdates = false;
    let hasFailures = false;

    // Re-encrypt access token
    if (integration.accessToken && integration.accessTokenIv && integration.accessTokenAuthTag) {
      const reencrypted = reencryptCredential(
        integration.accessToken,
        integration.accessTokenIv,
        integration.accessTokenAuthTag,
        oldKey,
        newKey
      );
      
      if (reencrypted) {
        updates.accessToken = reencrypted.encrypted;
        updates.accessTokenIv = reencrypted.iv;
        updates.accessTokenAuthTag = reencrypted.authTag;
        hasUpdates = true;
      } else {
        failed++;
        hasFailures = true;
        failedRecords.push(`client_integrations.id=${integration.id} (access_token)`);
      }
    }

    // Re-encrypt refresh token
    if (integration.refreshToken && integration.refreshTokenIv && integration.refreshTokenAuthTag) {
      const reencrypted = reencryptCredential(
        integration.refreshToken,
        integration.refreshTokenIv,
        integration.refreshTokenAuthTag,
        oldKey,
        newKey
      );
      
      if (reencrypted) {
        updates.refreshToken = reencrypted.encrypted;
        updates.refreshTokenIv = reencrypted.iv;
        updates.refreshTokenAuthTag = reencrypted.authTag;
        hasUpdates = true;
      } else {
        failed++;
        hasFailures = true;
        failedRecords.push(`client_integrations.id=${integration.id} (refresh_token)`);
      }
    }

    // Re-encrypt DataForSEO login
    if (integration.dataForSeoLogin && integration.dataForSeoLoginIv && integration.dataForSeoLoginAuthTag) {
      const reencrypted = reencryptCredential(
        integration.dataForSeoLogin,
        integration.dataForSeoLoginIv,
        integration.dataForSeoLoginAuthTag,
        oldKey,
        newKey
      );
      
      if (reencrypted) {
        updates.dataForSeoLogin = reencrypted.encrypted;
        updates.dataForSeoLoginIv = reencrypted.iv;
        updates.dataForSeoLoginAuthTag = reencrypted.authTag;
        hasUpdates = true;
      } else {
        failed++;
        hasFailures = true;
        failedRecords.push(`client_integrations.id=${integration.id} (dataforseo_login)`);
      }
    }

    // Re-encrypt DataForSEO password
    if (integration.dataForSeoPassword && integration.dataForSeoPasswordIv && integration.dataForSeoPasswordAuthTag) {
      const reencrypted = reencryptCredential(
        integration.dataForSeoPassword,
        integration.dataForSeoPasswordIv,
        integration.dataForSeoPasswordAuthTag,
        oldKey,
        newKey
      );
      
      if (reencrypted) {
        updates.dataForSeoPassword = reencrypted.encrypted;
        updates.dataForSeoPasswordIv = reencrypted.iv;
        updates.dataForSeoPasswordAuthTag = reencrypted.authTag;
        hasUpdates = true;
      } else {
        failed++;
        hasFailures = true;
        failedRecords.push(`client_integrations.id=${integration.id} (dataforseo_password)`);
      }
    }

    if (hasUpdates && !hasFailures) {
      await db.update(clientIntegrations)
        .set(updates)
        .where(eq(clientIntegrations.id, integration.id));
      migrated++;
    } else if (!hasUpdates) {
      skipped++;
    }
    // If hasFailures is true, don't update the record at all
  }

  console.log(`  ✓ Migrated: ${migrated}`);
  console.log(`  ⊘ Skipped: ${skipped}`);
  if (failed > 0) {
    console.log(`  ✗ Failed: ${failed}`);
  }
  
  return { migrated, skipped, failed, failedRecords };
}

async function migrateAgencyIntegrations(oldKey: Buffer, newKey: Buffer): Promise<{ migrated: number; skipped: number; failed: number; failedRecords: string[] }> {
  console.log('\n📦 Migrating agency_integrations...');
  
  const integrations = await db.select().from(agencyIntegrations);
  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  const failedRecords: string[] = [];

  for (const integration of integrations) {
    const updates: any = {};
    let hasUpdates = false;
    let hasFailures = false;

    // Re-encrypt DataForSEO login
    if (integration.dataForSeoLogin && integration.dataForSeoLoginIv && integration.dataForSeoLoginAuthTag) {
      const reencrypted = reencryptCredential(
        integration.dataForSeoLogin,
        integration.dataForSeoLoginIv,
        integration.dataForSeoLoginAuthTag,
        oldKey,
        newKey
      );
      
      if (reencrypted) {
        updates.dataForSeoLogin = reencrypted.encrypted;
        updates.dataForSeoLoginIv = reencrypted.iv;
        updates.dataForSeoLoginAuthTag = reencrypted.authTag;
        hasUpdates = true;
      } else {
        failed++;
        hasFailures = true;
        failedRecords.push(`agency_integrations.id=${integration.id} (dataforseo_login)`);
      }
    }

    // Re-encrypt DataForSEO password
    if (integration.dataForSeoPassword && integration.dataForSeoPasswordIv && integration.dataForSeoPasswordAuthTag) {
      const reencrypted = reencryptCredential(
        integration.dataForSeoPassword,
        integration.dataForSeoPasswordIv,
        integration.dataForSeoPasswordAuthTag,
        oldKey,
        newKey
      );
      
      if (reencrypted) {
        updates.dataForSeoPassword = reencrypted.encrypted;
        updates.dataForSeoPasswordIv = reencrypted.iv;
        updates.dataForSeoPasswordAuthTag = reencrypted.authTag;
        hasUpdates = true;
      } else {
        failed++;
        hasFailures = true;
        failedRecords.push(`agency_integrations.id=${integration.id} (dataforseo_password)`);
      }
    }

    if (hasUpdates && !hasFailures) {
      await db.update(agencyIntegrations)
        .set(updates)
        .where(eq(agencyIntegrations.id, integration.id));
      migrated++;
    } else if (!hasUpdates) {
      skipped++;
    }
    // If hasFailures is true, don't update the record at all
  }

  console.log(`  ✓ Migrated: ${migrated}`);
  console.log(`  ⊘ Skipped: ${skipped}`);
  if (failed > 0) {
    console.log(`  ✗ Failed: ${failed}`);
  }
  
  return { migrated, skipped, failed, failedRecords };
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.error('❌ Error: Missing arguments');
    console.error('\nUsage:');
    console.error('  tsx scripts/migrate-encryption-key.ts <OLD_KEY> <NEW_KEY>');
    console.error('\nExample:');
    console.error('  tsx scripts/migrate-encryption-key.ts "oldKeyBase64==" "newKeyBase64=="');
    process.exit(1);
  }

  const [oldKeyStr, newKeyStr] = args;

  console.log('🔐 ENCRYPTION_KEY Migration Tool');
  console.log('================================\n');

  try {
    // Validate keys
    console.log('🔍 Validating keys...');
    const oldKey = validateKey(oldKeyStr);
    const newKey = validateKey(newKeyStr);
    console.log('  ✓ Old key: Valid (32 bytes)');
    console.log('  ✓ New key: Valid (32 bytes)');

    // Confirm before proceeding
    console.log('\n⚠️  WARNING: This will re-encrypt ALL credentials in the database.');
    console.log('Make sure you have backed up your database before proceeding.\n');
    
    // Start migration
    console.log('🚀 Starting migration...');
    const clientResults = await migrateClientIntegrations(oldKey, newKey);
    const agencyResults = await migrateAgencyIntegrations(oldKey, newKey);
    
    // Combine results
    const totalFailed = clientResults.failed + agencyResults.failed;
    const allFailedRecords = [...clientResults.failedRecords, ...agencyResults.failedRecords];
    
    if (totalFailed > 0) {
      console.error('\n❌ Migration FAILED!');
      console.error(`\n${totalFailed} credential(s) could not be re-encrypted.`);
      console.error('\nFailed records:');
      allFailedRecords.forEach(record => console.error(`  - ${record}`));
      console.error('\nPossible causes:');
      console.error('  1. Wrong OLD_KEY provided (most common)');
      console.error('  2. Credentials were encrypted with a different key');
      console.error('  3. Credentials are already corrupted');
      console.error('\n⚠️  DO NOT update ENCRYPTION_KEY until this is resolved!');
      console.error('Action required:');
      console.error('  - Verify OLD_KEY matches current ENCRYPTION_KEY');
      console.error('  - Check if failed credentials are already corrupted');
      console.error('  - Consider clearing failed credentials via Settings UI');
      process.exit(1);
    }
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('  1. Update ENCRYPTION_KEY environment variable to the new key');
    console.log('  2. Restart your application');
    console.log('  3. Verify all integrations work correctly');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
