import { supabaseAdmin } from '../server/lib/supabase';
import { db } from '../server/db';
import { profiles } from '../shared/schema';

async function createSuperAdmin() {
  try {
    console.log('Searching for user in Supabase Auth...');
    
    // Get user by email
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError.message);
      process.exit(1);
    }
    
    const user = users.find(u => u.email === 'testsuperadmin2@demo.com');
    
    if (!user) {
      console.error('❌ User not found in Supabase Auth');
      process.exit(1);
    }
    
    console.log('✅ Found user in Supabase Auth');
    console.log('   User ID:', user.id);
    console.log('   Email:', user.email);
    console.log('Creating profile in database...');
    
    // Create profile
    const [profile] = await db.insert(profiles).values({
      id: user.id,
      fullName: 'Test SuperAdmin',
      email: 'testsuperadmin2@demo.com',
      role: 'SuperAdmin',
      agencyId: null,
      isSuperAdmin: true
    }).returning();
    
    console.log('✅ Profile created successfully!');
    console.log('   Profile ID:', profile.id);
    console.log('   Full Name:', profile.fullName);
    console.log('   Role:', profile.role);
    
    // Update user app_metadata to ensure SuperAdmin flag is set
    console.log('Updating user app_metadata...');
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      app_metadata: {
        role: 'SuperAdmin',
        is_super_admin: true,
        agency_id: null
      }
    });
    
    if (updateError) {
      console.error('⚠️  Warning: Could not update app_metadata:', updateError.message);
    } else {
      console.log('✅ User app_metadata updated');
    }
    
    console.log('\n🎉 SuperAdmin setup complete!');
    console.log('   Email: testsuperadmin2@demo.com');
    console.log('   Password: TestSuper123');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createSuperAdmin();
