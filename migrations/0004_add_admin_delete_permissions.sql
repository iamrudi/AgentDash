-- ================================================================
-- ADD ROLE-BASED DELETE PERMISSIONS FOR ADMIN USERS
-- ================================================================
-- This migration ensures only Admin users can delete clients and users
-- ================================================================

-- ================================================================
-- CREATE HELPER FUNCTION TO CHECK USER ROLE
-- ================================================================

-- Get current user's role from profiles table
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role 
  FROM profiles 
  WHERE id = auth.uid()
  LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Check if current user is an Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT role = 'Admin' FROM profiles WHERE id = auth.uid() LIMIT 1),
    false
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ================================================================
-- UPDATE CLIENTS TABLE DELETE POLICY
-- ================================================================

-- Drop existing delete policy
DROP POLICY IF EXISTS "Admins can delete clients in their agency" ON clients;

-- Create new policy that checks for Admin role
CREATE POLICY "Only Admins can delete clients"
ON clients FOR DELETE
TO authenticated
USING (
  agency_id = public.get_agency_id()
  AND public.is_admin()
);

-- ================================================================
-- UPDATE PROFILES TABLE DELETE POLICY
-- ================================================================

-- Drop existing delete policy if it exists
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

-- Create new delete policy for profiles (user management)
CREATE POLICY "Only Admins can delete profiles"
ON profiles FOR DELETE
TO authenticated
USING (
  -- Admin can delete profiles in their agency
  (agency_id = public.get_agency_id() AND public.is_admin())
  OR
  -- Users can delete their own profile
  (id = auth.uid())
);

-- ================================================================
-- UPDATE USERS TABLE DELETE POLICY (if table exists)
-- ================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'users'
  ) THEN
    -- Drop existing delete policy if it exists
    DROP POLICY IF EXISTS "Admins can delete users" ON users;
    
    -- Create new delete policy for users (legacy table)
    CREATE POLICY "Only Admins can delete users"
    ON users FOR DELETE
    TO authenticated
    USING (public.is_admin());
    
    RAISE NOTICE '✓ Updated delete policy for users table';
  ELSE
    RAISE NOTICE 'ℹ users table does not exist';
  END IF;
END $$;

-- ================================================================
-- UPDATE OTHER RELATED DELETE POLICIES
-- ================================================================

-- Projects: Only Admins can delete
DROP POLICY IF EXISTS "Admins can delete projects in their agency" ON projects;
CREATE POLICY "Only Admins can delete projects"
ON projects FOR DELETE
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id = public.get_agency_id()
  )
  AND public.is_admin()
);

-- Tasks: Only Admins can delete
DROP POLICY IF EXISTS "Admins can delete tasks in their agency" ON tasks;
CREATE POLICY "Only Admins can delete tasks"
ON tasks FOR DELETE
TO authenticated
USING (
  project_id IN (
    SELECT id FROM projects WHERE client_id IN (
      SELECT id FROM clients WHERE agency_id = public.get_agency_id()
    )
  )
  AND public.is_admin()
);

-- ================================================================
-- VERIFICATION
-- ================================================================

-- Show updated policies
SELECT 
  schemaname,
  tablename,
  policyname,
  CASE 
    WHEN cmd = 'DELETE' THEN '✓ DELETE'
    ELSE cmd::text
  END as operation,
  CASE 
    WHEN policyname LIKE '%Admin%' THEN '✓ Admin-restricted'
    ELSE 'ℹ Not restricted'
  END as restriction
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd = 'DELETE'
ORDER BY tablename, policyname;

-- ================================================================
-- COMMENTS
-- ================================================================

COMMENT ON FUNCTION public.get_user_role() IS 'Returns the role of the current authenticated user';
COMMENT ON FUNCTION public.is_admin() IS 'Returns true if current user has Admin role';
