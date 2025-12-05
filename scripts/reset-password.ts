import { supabaseAdmin } from '../server/lib/supabase';
import { db } from '../server/db';
import { profiles } from '../shared/schema';
import { eq } from 'drizzle-orm';

const EMAIL = process.argv[2] || 'rudi@mmagency.co.uk';
const NEW_PASSWORD = process.argv[3] || 'SuperAdmin123!';

async function resetPassword() {
  try {
    console.log(`\nResetting password for: ${EMAIL}\n`);
    
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError.message);
      process.exit(1);
    }
    
    const authUser = users.find(u => u.email === EMAIL);
    
    if (!authUser) {
      console.log(`User ${EMAIL} NOT found in Supabase Auth`);
      
      const [profile] = await db.select().from(profiles).where(eq(profiles.email, EMAIL));
      
      if (profile) {
        console.log('Profile exists in database, creating Supabase Auth user...');
        
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: EMAIL,
          password: NEW_PASSWORD,
          email_confirm: true,
          user_metadata: {
            fullName: profile.fullName,
          },
          app_metadata: {
            role: profile.role,
            is_super_admin: profile.isSuperAdmin,
            agency_id: profile.agencyId
          }
        });
        
        if (createError) {
          console.error('Error creating user:', createError.message);
          process.exit(1);
        }
        
        if (newUser.user) {
          await db.update(profiles)
            .set({ id: newUser.user.id })
            .where(eq(profiles.email, EMAIL));
          
          console.log('User created and profile updated!');
          console.log(`  New User ID: ${newUser.user.id}`);
        }
      } else {
        console.error('No profile found for this email');
        process.exit(1);
      }
    } else {
      console.log('User found in Supabase Auth');
      console.log(`  User ID: ${authUser.id}`);
      console.log(`  Email confirmed: ${authUser.email_confirmed_at ? 'Yes' : 'No'}`);
      
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
        password: NEW_PASSWORD,
        email_confirm: true
      });
      
      if (updateError) {
        console.error('Error resetting password:', updateError.message);
        process.exit(1);
      }
      
      console.log('Password reset successfully!');
      
      const [profile] = await db.select().from(profiles).where(eq(profiles.id, authUser.id));
      
      if (profile) {
        const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
          app_metadata: {
            role: profile.role,
            is_super_admin: profile.isSuperAdmin,
            agency_id: profile.agencyId
          }
        });
        
        if (metaError) {
          console.error('Warning: Could not update app_metadata:', metaError.message);
        } else {
          console.log('App metadata updated');
        }
      }
    }
    
    console.log('\nPassword reset complete!');
    console.log(`  Email: ${EMAIL}`);
    console.log(`  Password: ${NEW_PASSWORD}`);
    
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

resetPassword();
