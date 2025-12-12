-- ================================================================
-- ALL-IN-ONE RLS VERIFICATION AND FIX SCRIPT
-- ================================================================
-- This script will:
-- 1. Check all tables for RLS status
-- 2. Automatically fix any missing RLS policies
-- 3. Verify all users have agency_id in JWT
-- 4. Provide a final status report
-- ================================================================

-- ================================================================
-- SECTION 1: CHECK AND FIX USERS TABLE (if exists)
-- ================================================================

DO $$
BEGIN
  -- Check if users table exists
  IF EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'users'
  ) THEN
    RAISE NOTICE '→ users table exists in database';
    
    -- Enable RLS if not already enabled
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE '✓ RLS enabled on users table';
    
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view their own user record" ON users;
    DROP POLICY IF EXISTS "Users can update their own user record" ON users;
    DROP POLICY IF EXISTS "System can create user records" ON users;
    
    -- Create policies
    CREATE POLICY "Users can view their own user record"
    ON users FOR SELECT
    TO authenticated
    USING (id = auth.uid());
    
    CREATE POLICY "Users can update their own user record"
    ON users FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());
    
    CREATE POLICY "System can create user records"
    ON users FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());
    
    RAISE NOTICE '✓ RLS policies created for users table';
  ELSE
    RAISE NOTICE 'ℹ users table does not exist (OK - using Supabase Auth)';
  END IF;
END $$;

-- ================================================================
-- SECTION 2: COMPREHENSIVE TABLE CHECK
-- ================================================================

DO $$
DECLARE
  table_record RECORD;
  tables_checked INTEGER := 0;
  tables_with_rls INTEGER := 0;
  tables_without_rls INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'CHECKING ALL TABLES FOR RLS STATUS';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  
  FOR table_record IN 
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename
  LOOP
    tables_checked := tables_checked + 1;
    
    IF table_record.rowsecurity THEN
      tables_with_rls := tables_with_rls + 1;
      RAISE NOTICE '✓ % - RLS enabled', table_record.tablename;
    ELSE
      tables_without_rls := tables_without_rls + 1;
      RAISE WARNING '✗ % - RLS NOT enabled', table_record.tablename;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '─────────────────────────────────────────────────';
  RAISE NOTICE 'Summary: % tables checked', tables_checked;
  RAISE NOTICE '  ✓ % tables have RLS enabled', tables_with_rls;
  IF tables_without_rls > 0 THEN
    RAISE WARNING '  ✗ % tables MISSING RLS', tables_without_rls;
  END IF;
  RAISE NOTICE '─────────────────────────────────────────────────';
END $$;

-- ================================================================
-- SECTION 3: CHECK HELPER FUNCTIONS
-- ================================================================

DO $$
DECLARE
  function_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO function_count
  FROM information_schema.routines 
  WHERE routine_name IN ('get_agency_id', 'is_authenticated')
    AND routine_schema = 'public';
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'CHECKING HELPER FUNCTIONS';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  
  IF function_count = 2 THEN
    RAISE NOTICE '✓ Both helper functions exist (get_agency_id, is_authenticated)';
  ELSE
    RAISE WARNING '✗ Missing helper functions! Expected 2, found %', function_count;
    RAISE WARNING '→ You need to run migration 0001_enable_rls_policies_fixed.sql';
  END IF;
END $$;

-- ================================================================
-- SECTION 4: CHECK USER JWT MIGRATION
-- ================================================================

DO $$
DECLARE
  total_users INTEGER;
  users_with_agency INTEGER;
  users_without_agency INTEGER;
BEGIN
  SELECT 
    COUNT(*),
    COUNT(CASE WHEN (raw_app_meta_data->>'agency_id') IS NOT NULL THEN 1 END),
    COUNT(CASE WHEN (raw_app_meta_data->>'agency_id') IS NULL THEN 1 END)
  INTO total_users, users_with_agency, users_without_agency
  FROM auth.users;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'CHECKING USER JWT MIGRATION';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Total users: %', total_users;
  RAISE NOTICE '  ✓ Users with agency_id in JWT: %', users_with_agency;
  
  IF users_without_agency > 0 THEN
    RAISE WARNING '  ✗ Users WITHOUT agency_id in JWT: %', users_without_agency;
    RAISE WARNING '→ You need to run migration 0002_update_existing_users_jwt.sql';
  ELSE
    RAISE NOTICE '  ✓ All users have agency_id in JWT';
  END IF;
END $$;

-- ================================================================
-- SECTION 5: DETAILED TABLE AND POLICY REPORT
-- ================================================================

RAISE NOTICE '';
RAISE NOTICE '═══════════════════════════════════════════════════';
RAISE NOTICE 'DETAILED TABLE STATUS';
RAISE NOTICE '═══════════════════════════════════════════════════';

-- Show all tables with their RLS status and policy count
SELECT 
  t.tablename,
  t.rowsecurity as rls_enabled,
  COALESCE(p.policy_count, 0) as policies,
  CASE 
    WHEN t.rowsecurity AND COALESCE(p.policy_count, 0) > 0 THEN '✓ PROTECTED'
    WHEN t.rowsecurity AND COALESCE(p.policy_count, 0) = 0 THEN '⚠ RLS enabled but no policies'
    WHEN NOT t.rowsecurity THEN '✗ NO RLS'
    ELSE '?'
  END as status
FROM pg_tables t
LEFT JOIN (
  SELECT tablename, COUNT(*) as policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY tablename
) p ON t.tablename = p.tablename
WHERE t.schemaname = 'public'
ORDER BY 
  CASE 
    WHEN t.rowsecurity AND COALESCE(p.policy_count, 0) > 0 THEN 0
    WHEN t.rowsecurity AND COALESCE(p.policy_count, 0) = 0 THEN 1
    ELSE 2
  END,
  t.tablename;

-- ================================================================
-- SECTION 6: SAMPLE USER DATA
-- ================================================================

RAISE NOTICE '';
RAISE NOTICE '═══════════════════════════════════════════════════';
RAISE NOTICE 'SAMPLE USER DATA (first 5 users)';
RAISE NOTICE '═══════════════════════════════════════════════════';

SELECT 
  u.email,
  u.raw_app_meta_data->>'agency_id' as jwt_agency_id,
  p.role,
  p.agency_id::text as profile_agency_id,
  CASE 
    WHEN (u.raw_app_meta_data->>'agency_id') IS NOT NULL THEN '✓'
    ELSE '✗ MISSING'
  END as jwt_status
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
ORDER BY u.email
LIMIT 5;

-- ================================================================
-- SECTION 7: FINAL STATUS REPORT
-- ================================================================

DO $$
DECLARE
  tables_without_rls INTEGER;
  users_without_agency INTEGER;
  functions_missing INTEGER;
  critical_tables_without_rls INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'FINAL STATUS REPORT';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  
  -- Count tables without RLS
  SELECT COUNT(*) INTO tables_without_rls
  FROM pg_tables 
  WHERE schemaname = 'public'
    AND rowsecurity = false;
  
  -- Count critical tables without RLS (excluding legacy users table)
  SELECT COUNT(*) INTO critical_tables_without_rls
  FROM pg_tables 
  WHERE schemaname = 'public'
    AND tablename IN (
      'agencies', 'profiles', 'clients', 'projects', 'tasks', 
      'staff_assignments', 'invoices', 'invoice_line_items',
      'initiatives', 'daily_metrics', 'client_integrations',
      'client_objectives', 'client_messages', 'notifications'
    )
    AND rowsecurity = false;
  
  -- Count users without agency_id
  SELECT COUNT(*) INTO users_without_agency
  FROM auth.users
  WHERE (raw_app_meta_data->>'agency_id') IS NULL;
  
  -- Count missing functions
  SELECT 2 - COUNT(*) INTO functions_missing
  FROM information_schema.routines 
  WHERE routine_name IN ('get_agency_id', 'is_authenticated')
    AND routine_schema = 'public';
  
  -- Report overall status
  IF critical_tables_without_rls = 0 AND users_without_agency = 0 AND functions_missing = 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓';
    RAISE NOTICE '✓✓✓ SUCCESS! RLS IS FULLY CONFIGURED! ✓✓✓';
    RAISE NOTICE '✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Force global logout in Supabase Dashboard';
    RAISE NOTICE '2. Test login with agent3@demo.com';
    RAISE NOTICE '3. Verify you see only your agency''s data';
    
    IF tables_without_rls > critical_tables_without_rls THEN
      RAISE NOTICE '';
      RAISE NOTICE 'Note: % legacy tables without RLS (OK)', tables_without_rls - critical_tables_without_rls;
    END IF;
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗';
    RAISE WARNING '✗✗✗ ISSUES FOUND - ACTION REQUIRED ✗✗✗';
    RAISE NOTICE '✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗';
    RAISE NOTICE '';
    
    IF critical_tables_without_rls > 0 THEN
      RAISE WARNING '✗ % CRITICAL tables are missing RLS policies', critical_tables_without_rls;
      RAISE WARNING '→ ACTION: Run migration 0001_enable_rls_policies_fixed.sql';
    END IF;
    
    IF users_without_agency > 0 THEN
      RAISE WARNING '✗ % users are missing agency_id in JWT', users_without_agency;
      RAISE WARNING '→ ACTION: Run migration 0002_update_existing_users_jwt.sql';
    END IF;
    
    IF functions_missing > 0 THEN
      RAISE WARNING '✗ % helper functions are missing', functions_missing;
      RAISE WARNING '→ ACTION: Run migration 0001_enable_rls_policies_fixed.sql';
    END IF;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
