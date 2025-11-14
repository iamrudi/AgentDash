-- Enable RLS on task_lists table
ALTER TABLE task_lists ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access task lists from their own agency
CREATE POLICY task_lists_tenant_isolation ON task_lists
  FOR ALL
  USING (agency_id = auth.get_agency_id());

-- Policy: SuperAdmins can access all task lists (if needed)
-- Note: This may already be handled at application layer
-- CREATE POLICY task_lists_superadmin ON task_lists
--   FOR ALL
--   USING (auth.is_super_admin());
