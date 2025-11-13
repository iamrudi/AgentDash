import { supabaseAdmin } from '../server/lib/supabase';
import { db } from '../server/db';
import { profiles } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function checkSuperAdminAuth() {
  try {
    console.log('Checking SuperAdmin in Supabase Auth...\n');
    
    // Get user by email from Supabase Auth
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError.message);
      process.exit(1);
    }
    
    const authUser = users.find(u => u.email === 'testsuperadmin2@demo.com');
    
    if (!authUser) {
      console.log('❌ User NOT found in Supabase Auth');
      console.log('   Creating new user in Supabase Auth...');
      
      // Create user in Supabase Auth
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: 'testsuperadmin2@demo.com',
        password: 'TestSuper123',
        email_confirm: true,
        user_metadata: {
          fullName: 'Test SuperAdmin',
        },
        app_metadata: {
          role: 'SuperAdmin',
          is_super_admin: true,
          agency_id: null
        }
      });
      
      if (createError) {
        console.error('❌ Error creating user:', createError.message);
        process.exit(1);
      }
      
      console.log('✅ User created in Supabase Auth');
      console.log('   User ID:', newUser.user?.id);
      
      // Update profile with correct ID
      if (newUser.user) {
        await db.delete(profiles).where(eq(profiles.email, 'testsuperadmin2@demo.com'));
        
        await db.insert(profiles).values({
          id: newUser.user.id,
          fullName: 'Test SuperAdmin',
          email: 'testsuperadmin2@demo.com',
          role: 'SuperAdmin',
          agencyId: null,
          isSuperAdmin: true
        });
        
        console.log('✅ Profile updated with correct user ID');
      }
    } else {
      console.log('✅ User found in Supabase Auth');
      console.log('   User ID:', authUser.id);
      console.log('   Email:', authUser.email);
      console.log('   Email confirmed:', authUser.email_confirmed_at ? 'Yes' : 'No');
      console.log('\nChecking profile in database...\n');
      
      // Check profile
      const [profile] = await db.select().from(profiles).where(eq(profiles.id, authUser.id));
      
      if (!profile) {
        console.log('❌ Profile NOT found in database');
        console.log('   Creating profile...');
        
        await db.insert(profiles).values({
          id: authUser.id,
          fullName: 'Test SuperAdmin',
          email: 'testsuperadmin2@demo.com',
          role: 'SuperAdmin',
          agencyId: null,
          isSuperAdmin: true
        });
        
        console.log('✅ Profile created');
      } else {
        console.log('✅ Profile found in database');
        console.log('   Profile ID:', profile.id);
        console.log('   Full Name:', profile.fullName);
        console.log('   Email:', profile.email);
        console.log('   Role:', profile.role);
        console.log('   Is SuperAdmin:', profile.isSuperAdmin);
      }
      
      // Reset password to be sure
      console.log('\nResetting password to: TestSuper123');
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
        password: 'TestSuper123'
      });
      
      if (updateError) {
        console.error('❌ Error resetting password:', updateError.message);
      } else {
        console.log('✅ Password reset successfully');
      }
      
      // Update app_metadata to be sure
      const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
        app_metadata: {
          role: 'SuperAdmin',
          is_super_admin: true,
          agency_id: null
        }
      });
      
      if (metaError) {
        console.error('❌ Error updating app_metadata:', metaError.message);
      } else {
        console.log('✅ App metadata updated');
      }
    }
    
    console.log('\n🎉 SuperAdmin is ready!');
    console.log('   Email: testsuperadmin2@demo.com');
    console.log('   Password: TestSuper123');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkSuperAdminAuth();
