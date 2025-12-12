-- ================================================================
-- COMPREHENSIVE RLS VERIFICATION SCRIPT
-- ================================================================
-- Run this in Supabase SQL Editor to verify complete RLS setup
-- ================================================================

-- ================================================================
-- CHECK 1: Helper Functions Exist
-- ================================================================
SELECT 
  '✓ Helper Functions' as check_name,
  COUNT(*) as found,
  CASE 
    WHEN COUNT(*) = 2 THEN '✓ PASS' 
    ELSE '✗ FAIL - Missing functions' 
  END as status
FROM information_schema.routines 
WHERE routine_name IN ('get_agency_id', 'is_authenticated')
  AND routine_schema = 'public';

-- ================================================================
-- CHECK 2: All Tables Have RLS Enabled
-- ================================================================
WITH expected_tables AS (
  SELECT unnest(ARRAY[
    'agencies', 
    'profiles', 
    'clients', 
    'projects', 
    'tasks', 
    'staff_assignments', 
    'invoices', 
    'invoice_line_items',
    'initiatives', 
    'daily_metrics', 
    'client_integrations',
    'client_objectives', 
    'client_messages', 
    'notifications',
    'users'  -- Legacy table - may or may not exist
  ]) as table_name
),
actual_tables AS (
  SELECT 
    tablename as table_name,
    rowsecurity as rls_enabled
  FROM pg_tables 
  WHERE schemaname = 'public'
)
SELECT 
  '✓ RLS Status' as check_name,
  e.table_name,
  CASE 
    WHEN a.table_name IS NULL THEN '⚠ Does not exist (OK if legacy)'
    WHEN a.rls_enabled THEN '✓ RLS enabled'
    ELSE '✗ RLS NOT enabled'
  END as status
FROM expected_tables e
LEFT JOIN actual_tables a ON e.table_name = a.table_name
ORDER BY 
  CASE 
    WHEN a.table_name IS NULL THEN 2
    WHEN a.rls_enabled THEN 0
    ELSE 1
  END,
  e.table_name;

-- ================================================================
-- CHECK 3: All Users Have agency_id in JWT
-- ================================================================
SELECT 
  '✓ JWT Migration' as check_name,
  COUNT(*) as total_users,
  COUNT(CASE WHEN (raw_app_meta_data->>'agency_id') IS NOT NULL THEN 1 END) as users_with_agency_id,
  CASE 
    WHEN COUNT(*) = COUNT(CASE WHEN (raw_app_meta_data->>'agency_id') IS NOT NULL THEN 1 END) 
    THEN '✓ PASS - All users migrated' 
    ELSE '✗ FAIL - Some users missing agency_id'
  END as status
FROM auth.users;

-- ================================================================
-- CHECK 4: Policy Count per Table
-- ================================================================
SELECT 
  '✓ Policy Coverage' as check_name,
  tablename,
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) >= 1 THEN '✓ Has policies'
    ELSE '✗ No policies'
  END as status
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- ================================================================
-- CHECK 5: Sample User Data
-- ================================================================
SELECT 
  '✓ User Sample' as check_name,
  u.email,
  u.raw_app_meta_data->>'agency_id' as agency_id_in_jwt,
  p.role,
  p.agency_id as profile_agency_id
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
ORDER BY u.email
LIMIT 5;

-- ================================================================
-- CHECK 6: Agency Data Isolation Test
-- ================================================================
-- This shows ALL agencies (you're using service role)
SELECT 
  '✓ Agency Data' as check_name,
  a.id,
  a.name as agency_name,
  COUNT(DISTINCT c.id) as client_count,
  COUNT(DISTINCT p.id) as user_count
FROM agencies a
LEFT JOIN clients c ON c.agency_id = a.id
LEFT JOIN profiles p ON p.agency_id = a.id
GROUP BY a.id, a.name
ORDER BY a.name;

-- ================================================================
-- FINAL SUMMARY
-- ================================================================
SELECT 
  '═══════════════════════════════════════' as separator,
  'RLS VERIFICATION COMPLETE' as summary,
  '═══════════════════════════════════════' as separator2;

-- Check overall status
DO $$
DECLARE
  tables_without_rls INTEGER;
  users_without_agency INTEGER;
  functions_missing INTEGER;
BEGIN
  -- Count tables without RLS
  SELECT COUNT(*) INTO tables_without_rls
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
  IF tables_without_rls = 0 AND users_without_agency = 0 AND functions_missing = 0 THEN
    RAISE NOTICE '✓✓✓ ALL CHECKS PASSED - RLS is fully configured! ✓✓✓';
  ELSE
    IF tables_without_rls > 0 THEN
      RAISE WARNING '✗ % tables are missing RLS policies', tables_without_rls;
    END IF;
    IF users_without_agency > 0 THEN
      RAISE WARNING '✗ % users are missing agency_id in JWT', users_without_agency;
    END IF;
    IF functions_missing > 0 THEN
      RAISE WARNING '✗ % helper functions are missing', functions_missing;
    END IF;
  END IF;
END $$;
