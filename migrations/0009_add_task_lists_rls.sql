-- ================================================================
-- TASK LISTS ROW LEVEL SECURITY (RLS) POLICIES
-- ================================================================
-- This migration enables database-level tenant isolation for task_lists table
-- Uses Supabase's built-in auth.jwt() function to access app_metadata
-- No prerequisite migrations needed - uses built-in Supabase functions
-- ================================================================

-- Enable RLS on task_lists table
ALTER TABLE task_lists ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- TASK LISTS TABLE POLICIES
-- ================================================================
-- Users can only access task lists in their own agency

CREATE POLICY "Users can view task lists in their agency"
ON task_lists FOR SELECT
TO authenticated
USING (agency_id = (auth.jwt() -> 'app_metadata' ->> 'agency_id')::uuid);

CREATE POLICY "Admins can insert task lists in their agency"
ON task_lists FOR INSERT
TO authenticated
WITH CHECK (agency_id = (auth.jwt() -> 'app_metadata' ->> 'agency_id')::uuid);

CREATE POLICY "Admins can update task lists in their agency"
ON task_lists FOR UPDATE
TO authenticated
USING (agency_id = (auth.jwt() -> 'app_metadata' ->> 'agency_id')::uuid)
WITH CHECK (agency_id = (auth.jwt() -> 'app_metadata' ->> 'agency_id')::uuid);

CREATE POLICY "Admins can delete task lists in their agency"
ON task_lists FOR DELETE
TO authenticated
USING (agency_id = (auth.jwt() -> 'app_metadata' ->> 'agency_id')::uuid);

-- ================================================================
-- PERFORMANCE INDEXES FOR RLS
-- ================================================================
-- These indexes optimize RLS policy checks

-- Index for agency_id lookups (already exists in schema, ensuring it's created)
CREATE INDEX IF NOT EXISTS idx_task_lists_agency_id_rls ON task_lists(agency_id);

-- ================================================================
-- COMMENTS FOR DOCUMENTATION
-- ================================================================

COMMENT ON POLICY "Users can view task lists in their agency" ON task_lists IS 'RLS: Users can only view task lists belonging to their agency';
COMMENT ON POLICY "Admins can insert task lists in their agency" ON task_lists IS 'RLS: Admins can only create task lists in their agency';
COMMENT ON POLICY "Admins can update task lists in their agency" ON task_lists IS 'RLS: Admins can only update task lists in their agency';
COMMENT ON POLICY "Admins can delete task lists in their agency" ON task_lists IS 'RLS: Admins can only delete task lists in their agency';

-- ================================================================
-- RLS IMPLEMENTATION COMPLETE FOR TASK_LISTS
-- ================================================================
-- Task lists table now has database-level tenant isolation
-- Users can only access task lists belonging to their agency
-- Uses Supabase's built-in auth.jwt() for JWT app_metadata access
-- Even direct SQL queries will respect tenant boundaries
-- ================================================================
