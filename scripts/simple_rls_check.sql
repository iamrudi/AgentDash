-- ================================================================
-- SIMPLE RLS VERIFICATION SCRIPT
-- ================================================================

-- STEP 1: Check if users table exists and fix it
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can view their own user record" ON users;
    DROP POLICY IF EXISTS "Users can update their own user record" ON users;
    DROP POLICY IF EXISTS "System can create user records" ON users;
    
    CREATE POLICY "Users can view their own user record" ON users FOR SELECT TO authenticated USING (id = auth.uid());
    CREATE POLICY "Users can update their own user record" ON users FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
    CREATE POLICY "System can create user records" ON users FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
    
    RAISE NOTICE 'Fixed users table RLS';
  ELSE
    RAISE NOTICE 'users table does not exist';
  END IF;
END $$;

-- STEP 2: Show all tables and their RLS status
SELECT 
  tablename,
  rowsecurity as rls_enabled,
  CASE WHEN rowsecurity THEN '✓' ELSE '✗' END as status
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- STEP 3: Show policy counts per table
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- STEP 4: Check users have agency_id in JWT
SELECT 
  COUNT(*) as total_users,
  COUNT(CASE WHEN (raw_app_meta_data->>'agency_id') IS NOT NULL THEN 1 END) as with_agency_id,
  COUNT(CASE WHEN (raw_app_meta_data->>'agency_id') IS NULL THEN 1 END) as missing_agency_id
FROM auth.users;

-- STEP 5: Check helper functions
SELECT 
  routine_name,
  routine_schema
FROM information_schema.routines 
WHERE routine_name IN ('get_agency_id', 'is_authenticated')
  AND routine_schema = 'public';

-- STEP 6: Sample user data
SELECT 
  u.email,
  u.raw_app_meta_data->>'agency_id' as jwt_agency_id,
  p.role
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
ORDER BY u.email
LIMIT 5;
