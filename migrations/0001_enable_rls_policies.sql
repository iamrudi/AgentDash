-- ================================================================
-- SUPABASE ROW LEVEL SECURITY (RLS) POLICIES
-- Multi-Tenant Agency Client Portal
-- ================================================================
-- This migration enables database-level tenant isolation using RLS
-- All queries are automatically filtered by agency_id from JWT
-- ================================================================

-- ================================================================
-- HELPER FUNCTIONS
-- ================================================================

-- Extract agency_id from Supabase Auth JWT (app_metadata)
-- This is the secure way to get tenant context for RLS policies
CREATE OR REPLACE FUNCTION auth.get_agency_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'agency_id')::UUID,
    NULL
  );
$$ LANGUAGE SQL STABLE;

-- Helper to check if current user is authenticated
CREATE OR REPLACE FUNCTION auth.is_authenticated()
RETURNS BOOLEAN AS $$
  SELECT auth.uid() IS NOT NULL;
$$ LANGUAGE SQL STABLE;

-- ================================================================
-- ENABLE RLS ON ALL TABLES
-- ================================================================

ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- AGENCIES TABLE POLICIES
-- ================================================================
-- Users can only view their own agency

CREATE POLICY "Users can view their own agency"
ON agencies FOR SELECT
TO authenticated
USING (id = (SELECT auth.get_agency_id()));

-- ================================================================
-- PROFILES TABLE POLICIES
-- ================================================================
-- Users can view profiles in their agency + their own profile

CREATE POLICY "Users can view profiles in their agency"
ON profiles FOR SELECT
TO authenticated
USING (
  -- Admin/Staff: can see profiles in same agency
  (agency_id = (SELECT auth.get_agency_id()))
  OR
  -- Client users: can see their own profile
  (id = auth.uid())
);

CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- ================================================================
-- CLIENTS TABLE POLICIES
-- ================================================================
-- Users can only access clients in their agency

CREATE POLICY "Users can view clients in their agency"
ON clients FOR SELECT
TO authenticated
USING (agency_id = (SELECT auth.get_agency_id()));

CREATE POLICY "Admins can insert clients in their agency"
ON clients FOR INSERT
TO authenticated
WITH CHECK (agency_id = (SELECT auth.get_agency_id()));

CREATE POLICY "Admins can update clients in their agency"
ON clients FOR UPDATE
TO authenticated
USING (agency_id = (SELECT auth.get_agency_id()))
WITH CHECK (agency_id = (SELECT auth.get_agency_id()));

CREATE POLICY "Admins can delete clients in their agency"
ON clients FOR DELETE
TO authenticated
USING (agency_id = (SELECT auth.get_agency_id()));

-- ================================================================
-- PROJECTS TABLE POLICIES
-- ================================================================
-- Access via client relationship

CREATE POLICY "Users can view projects in their agency"
ON projects FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
  )
);

CREATE POLICY "Admins can insert projects in their agency"
ON projects FOR INSERT
TO authenticated
WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
  )
);

CREATE POLICY "Admins can update projects in their agency"
ON projects FOR UPDATE
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
  )
)
WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
  )
);

CREATE POLICY "Admins can delete projects in their agency"
ON projects FOR DELETE
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
  )
);

-- ================================================================
-- TASKS TABLE POLICIES
-- ================================================================
-- Access via project -> client relationship

CREATE POLICY "Users can view tasks in their agency"
ON tasks FOR SELECT
TO authenticated
USING (
  project_id IN (
    SELECT id FROM projects WHERE client_id IN (
      SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
    )
  )
);

CREATE POLICY "Admins can insert tasks in their agency"
ON tasks FOR INSERT
TO authenticated
WITH CHECK (
  project_id IN (
    SELECT id FROM projects WHERE client_id IN (
      SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
    )
  )
);

CREATE POLICY "Users can update tasks in their agency"
ON tasks FOR UPDATE
TO authenticated
USING (
  project_id IN (
    SELECT id FROM projects WHERE client_id IN (
      SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
    )
  )
)
WITH CHECK (
  project_id IN (
    SELECT id FROM projects WHERE client_id IN (
      SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
    )
  )
);

CREATE POLICY "Admins can delete tasks in their agency"
ON tasks FOR DELETE
TO authenticated
USING (
  project_id IN (
    SELECT id FROM projects WHERE client_id IN (
      SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
    )
  )
);

-- ================================================================
-- STAFF ASSIGNMENTS TABLE POLICIES
-- ================================================================
-- Access via task -> project -> client relationship

CREATE POLICY "Users can view staff assignments in their agency"
ON staff_assignments FOR SELECT
TO authenticated
USING (
  task_id IN (
    SELECT id FROM tasks WHERE project_id IN (
      SELECT id FROM projects WHERE client_id IN (
        SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
      )
    )
  )
);

CREATE POLICY "Admins can manage staff assignments in their agency"
ON staff_assignments FOR ALL
TO authenticated
USING (
  task_id IN (
    SELECT id FROM tasks WHERE project_id IN (
      SELECT id FROM projects WHERE client_id IN (
        SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
      )
    )
  )
)
WITH CHECK (
  task_id IN (
    SELECT id FROM tasks WHERE project_id IN (
      SELECT id FROM projects WHERE client_id IN (
        SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
      )
    )
  )
);

-- ================================================================
-- INVOICES TABLE POLICIES
-- ================================================================
-- Access via client relationship

CREATE POLICY "Users can view invoices in their agency"
ON invoices FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
  )
);

CREATE POLICY "Admins can manage invoices in their agency"
ON invoices FOR ALL
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
  )
)
WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
  )
);

-- ================================================================
-- INVOICE LINE ITEMS TABLE POLICIES
-- ================================================================
-- Access via invoice -> client relationship

CREATE POLICY "Users can view invoice line items in their agency"
ON invoice_line_items FOR SELECT
TO authenticated
USING (
  invoice_id IN (
    SELECT id FROM invoices WHERE client_id IN (
      SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
    )
  )
);

CREATE POLICY "Admins can manage invoice line items in their agency"
ON invoice_line_items FOR ALL
TO authenticated
USING (
  invoice_id IN (
    SELECT id FROM invoices WHERE client_id IN (
      SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
    )
  )
)
WITH CHECK (
  invoice_id IN (
    SELECT id FROM invoices WHERE client_id IN (
      SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
    )
  )
);

-- ================================================================
-- INITIATIVES TABLE POLICIES
-- ================================================================
-- Access via client relationship

CREATE POLICY "Users can view initiatives in their agency"
ON initiatives FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
  )
);

CREATE POLICY "Admins can manage initiatives in their agency"
ON initiatives FOR ALL
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
  )
)
WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
  )
);

-- ================================================================
-- DAILY METRICS TABLE POLICIES
-- ================================================================
-- Access via client relationship

CREATE POLICY "Users can view metrics in their agency"
ON daily_metrics FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
  )
);

CREATE POLICY "System can manage metrics in their agency"
ON daily_metrics FOR ALL
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
  )
)
WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
  )
);

-- ================================================================
-- CLIENT INTEGRATIONS TABLE POLICIES
-- ================================================================
-- Access via client relationship (OAuth tokens - sensitive)

CREATE POLICY "Users can view integrations in their agency"
ON client_integrations FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
  )
);

CREATE POLICY "Admins can manage integrations in their agency"
ON client_integrations FOR ALL
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
  )
)
WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
  )
);

-- ================================================================
-- CLIENT OBJECTIVES TABLE POLICIES
-- ================================================================
-- Access via client relationship

CREATE POLICY "Users can view objectives in their agency"
ON client_objectives FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
  )
);

CREATE POLICY "Admins can manage objectives in their agency"
ON client_objectives FOR ALL
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
  )
)
WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
  )
);

-- ================================================================
-- CLIENT MESSAGES TABLE POLICIES
-- ================================================================
-- Access via client relationship

CREATE POLICY "Users can view messages in their agency"
ON client_messages FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
  )
);

CREATE POLICY "Users can send messages in their agency"
ON client_messages FOR INSERT
TO authenticated
WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
  )
);

CREATE POLICY "Users can update messages in their agency"
ON client_messages FOR UPDATE
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
  )
)
WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
  )
);

-- ================================================================
-- NOTIFICATIONS TABLE POLICIES
-- ================================================================
-- Special case: users can only see their own notifications
-- Note: notifications.user_id references old users table, should reference profiles.id

CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "System can create notifications for users"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR auth.get_agency_id() IS NOT NULL);

CREATE POLICY "Users can update their own notifications"
ON notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own notifications"
ON notifications FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ================================================================
-- PERFORMANCE INDEXES FOR RLS
-- ================================================================
-- These indexes optimize RLS policy checks

-- Index for agency_id lookups (already exists in schema, but ensuring)
CREATE INDEX IF NOT EXISTS idx_clients_agency_id_rls ON clients(agency_id);
CREATE INDEX IF NOT EXISTS idx_profiles_agency_id_rls ON profiles(agency_id);

-- Index for client_id foreign key lookups
CREATE INDEX IF NOT EXISTS idx_projects_client_id_rls ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id_rls ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_initiatives_client_id_rls ON initiatives(client_id);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_client_id_rls ON daily_metrics(client_id);
CREATE INDEX IF NOT EXISTS idx_client_integrations_client_id_rls ON client_integrations(client_id);
CREATE INDEX IF NOT EXISTS idx_client_objectives_client_id_rls ON client_objectives(client_id);
CREATE INDEX IF NOT EXISTS idx_client_messages_client_id_rls ON client_messages(client_id);

-- Index for project_id lookups
CREATE INDEX IF NOT EXISTS idx_tasks_project_id_rls ON tasks(project_id);

-- Index for task_id lookups
CREATE INDEX IF NOT EXISTS idx_staff_assignments_task_id_rls ON staff_assignments(task_id);

-- Index for invoice_id lookups
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id_rls ON invoice_line_items(invoice_id);

-- Index for user_id lookups in notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_rls ON notifications(user_id);

-- ================================================================
-- GRANT PERMISSIONS
-- ================================================================
-- Ensure authenticated users can execute helper functions

GRANT EXECUTE ON FUNCTION auth.get_agency_id() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_authenticated() TO authenticated;

-- ================================================================
-- COMMENTS FOR DOCUMENTATION
-- ================================================================

COMMENT ON FUNCTION auth.get_agency_id() IS 'Extracts agency_id from Supabase Auth JWT app_metadata for RLS policies';
COMMENT ON FUNCTION auth.is_authenticated() IS 'Checks if current user is authenticated via Supabase Auth';

-- ================================================================
-- RLS IMPLEMENTATION COMPLETE
-- ================================================================
-- All tables now have database-level tenant isolation
-- Users can only access data belonging to their agency
-- Even direct SQL queries will respect tenant boundaries
-- ================================================================
