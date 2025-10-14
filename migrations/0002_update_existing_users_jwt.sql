-- ================================================================
-- UPDATE EXISTING USERS WITH AGENCY_ID IN JWT
-- ================================================================
-- This migration adds agency_id to app_metadata for all existing users
-- Run this AFTER enabling RLS policies
-- ================================================================

-- Update Admin/Staff users (agency_id from profiles table)
DO $$
DECLARE
  user_record RECORD;
  updated_count INTEGER := 0;
BEGIN
  FOR user_record IN 
    SELECT p.id, p.agency_id 
    FROM profiles p 
    WHERE p.agency_id IS NOT NULL
      AND p.role IN ('Admin', 'Staff')
  LOOP
    -- Update Supabase Auth user with agency_id in app_metadata
    UPDATE auth.users
    SET raw_app_meta_data = 
      jsonb_set(
        COALESCE(raw_app_meta_data, '{}'::jsonb),
        '{agency_id}',
        to_jsonb(user_record.agency_id::text)
      )
    WHERE id = user_record.id;
    
    updated_count := updated_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Updated % Admin/Staff users with agency_id in app_metadata', updated_count;
END $$;

-- Update Client users (agency_id from clients table)
DO $$
DECLARE
  user_record RECORD;
  updated_count INTEGER := 0;
BEGIN
  FOR user_record IN 
    SELECT p.id, c.agency_id 
    FROM profiles p
    JOIN clients c ON c.profile_id = p.id
    WHERE p.role = 'Client'
  LOOP
    -- Update Supabase Auth user with agency_id in app_metadata
    UPDATE auth.users
    SET raw_app_meta_data = 
      jsonb_set(
        COALESCE(raw_app_meta_data, '{}'::jsonb),
        '{agency_id}',
        to_jsonb(user_record.agency_id::text)
      )
    WHERE id = user_record.id;
    
    updated_count := updated_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Updated % Client users with agency_id in app_metadata', updated_count;
END $$;

-- Verify all users have agency_id
DO $$
DECLARE
  users_without_agency INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO users_without_agency
  FROM auth.users u
  JOIN profiles p ON p.id = u.id
  WHERE (u.raw_app_meta_data->>'agency_id') IS NULL;
  
  IF users_without_agency > 0 THEN
    RAISE WARNING '% users still missing agency_id in JWT. Please investigate.', users_without_agency;
  ELSE
    RAISE NOTICE 'All users have agency_id in JWT app_metadata. RLS setup complete!';
  END IF;
END $$;

-- ================================================================
-- IMPORTANT: Users must logout and login again for JWT changes to take effect
-- ================================================================
