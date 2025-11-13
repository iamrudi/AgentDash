import { supabaseAdmin } from '../server/lib/supabase';
import { db } from '../server/db';
import { profiles } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function fixOrphanedUser(email: string) {
  try {
    console.log(`\n🔍 Checking for orphaned user: ${email}\n`);
    
    // Get user from Supabase Auth
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError.message);
      process.exit(1);
    }
    
    const authUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!authUser) {
      console.log(`✅ No orphaned user found in Supabase Auth`);
      console.log(`   You can now create a new user with this email`);
      process.exit(0);
    }
    
    console.log(`⚠️  Found user in Supabase Auth:`);
    console.log(`   User ID: ${authUser.id}`);
    console.log(`   Email: ${authUser.email}`);
    console.log(`   Created: ${authUser.created_at}`);
    
    // Check if profile exists
    const [existingProfile] = await db.select()
      .from(profiles)
      .where(eq(profiles.id, authUser.id));
    
    if (existingProfile) {
      console.log(`\n✅ Profile exists in database`);
      console.log(`   This is not an orphaned user`);
      process.exit(0);
    }
    
    console.log(`\n❌ Profile NOT found in database - This is an orphaned user!`);
    console.log(`\n🔧 Fixing by deleting from Supabase Auth...`);
    
    // Delete the orphaned user from Supabase Auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
    
    if (deleteError) {
      console.error(`❌ Error deleting user:`, deleteError.message);
      process.exit(1);
    }
    
    console.log(`✅ User deleted from Supabase Auth`);
    console.log(`\n🎉 Fixed! You can now create a new user with email: ${email}`);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.error('❌ Please provide an email address');
  console.log('Usage: tsx scripts/fix-orphaned-user.ts <email>');
  process.exit(1);
}

fixOrphanedUser(email);
