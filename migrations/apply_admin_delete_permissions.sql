-- ================================================================
-- APPLY ADMIN DELETE PERMISSIONS
-- ================================================================
-- Run this to ensure only Admin users can delete clients and users
-- ================================================================

-- STEP 1: Create helper functions for role checking
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((SELECT role = 'Admin' FROM profiles WHERE id = auth.uid() LIMIT 1), false);
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- STEP 2: Update clients delete policy
DROP POLICY IF EXISTS "Admins can delete clients in their agency" ON clients;
DROP POLICY IF EXISTS "Only Admins can delete clients" ON clients;

CREATE POLICY "Only Admins can delete clients"
ON clients FOR DELETE
TO authenticated
USING (agency_id = public.get_agency_id() AND public.is_admin());

-- STEP 3: Update profiles delete policy
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
DROP POLICY IF EXISTS "Only Admins can delete profiles" ON profiles;

CREATE POLICY "Only Admins can delete profiles"
ON profiles FOR DELETE
TO authenticated
USING (
  (agency_id = public.get_agency_id() AND public.is_admin())
  OR (id = auth.uid())
);

-- STEP 4: Update projects delete policy
DROP POLICY IF EXISTS "Admins can delete projects in their agency" ON projects;
DROP POLICY IF EXISTS "Only Admins can delete projects" ON projects;

CREATE POLICY "Only Admins can delete projects"
ON projects FOR DELETE
TO authenticated
USING (
  client_id IN (SELECT id FROM clients WHERE agency_id = public.get_agency_id())
  AND public.is_admin()
);

-- STEP 5: Update tasks delete policy
DROP POLICY IF EXISTS "Admins can delete tasks in their agency" ON tasks;
DROP POLICY IF EXISTS "Only Admins can delete tasks" ON tasks;

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

-- STEP 6: Show updated delete policies
SELECT 
  tablename,
  policyname,
  'DELETE' as operation
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd = 'DELETE'
ORDER BY tablename;
