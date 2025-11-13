import { supabaseAdmin } from './lib/supabase';

async function cleanupOrphanedUser(email: string) {
  console.log(`\n🔍 Searching for orphaned user: ${email}`);
  
  try {
    // Search for the user in Supabase Auth
    let allUsers: any[] = [];
    let page = 1;
    const perPage = 1000;
    
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage
      });
      
      if (error) {
        throw new Error(`Failed to list users: ${error.message}`);
      }
      
      if (!data.users || data.users.length === 0) {
        break;
      }
      
      allUsers = allUsers.concat(data.users);
      
      if (data.users.length < perPage) {
        break;
      }
      
      page++;
    }
    
    console.log(`✅ Scanned ${allUsers.length} total auth users`);
    
    // Find user with matching email
    const orphanedUser = allUsers.find(u => u.email === email);
    
    if (!orphanedUser) {
      console.log(`❌ No auth user found with email: ${email}`);
      return;
    }
    
    console.log(`✅ Found orphaned auth user:`);
    console.log(`   - ID: ${orphanedUser.id}`);
    console.log(`   - Email: ${orphanedUser.email}`);
    console.log(`   - Created: ${orphanedUser.created_at}`);
    
    // Delete the orphaned user
    console.log(`\n🗑️  Deleting orphaned auth user...`);
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(orphanedUser.id);
    
    if (deleteError) {
      throw new Error(`Failed to delete user: ${deleteError.message}`);
    }
    
    console.log(`✅ Successfully deleted orphaned auth user: ${email}`);
    console.log(`\n✨ You can now create this user again!\n`);
    
  } catch (error: any) {
    console.error(`\n❌ Error during cleanup:`, error.message);
    throw error;
  }
}

// Run cleanup
const emailToCleanup = 'rudi@mmagency.co.uk';
cleanupOrphanedUser(emailToCleanup)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
