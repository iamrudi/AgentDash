-- ================================================================
-- ADD RLS POLICIES FOR LEGACY USERS TABLE
-- ================================================================
-- The "users" table is a legacy table from before Supabase Auth
-- If it exists in the database, it needs RLS policies for security
-- ================================================================

-- First, check if the users table exists and enable RLS
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'users'
  ) THEN
    -- Enable RLS on users table
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    
    RAISE NOTICE 'RLS enabled on users table';
  ELSE
    RAISE NOTICE 'users table does not exist - skipping RLS setup';
  END IF;
END $$;

-- ================================================================
-- USERS TABLE POLICIES (if table exists)
-- ================================================================
-- Users can only view their own user record

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'users'
  ) THEN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view their own user record" ON users;
    DROP POLICY IF EXISTS "Users can update their own user record" ON users;
    DROP POLICY IF EXISTS "System can create user records" ON users;
    
    -- Users can view their own user record
    CREATE POLICY "Users can view their own user record"
    ON users FOR SELECT
    TO authenticated
    USING (id = auth.uid());
    
    -- Users can update their own user record
    CREATE POLICY "Users can update their own user record"
    ON users FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());
    
    -- System can create user records (during signup)
    CREATE POLICY "System can create user records"
    ON users FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());
    
    RAISE NOTICE 'RLS policies created for users table';
  END IF;
END $$;

-- ================================================================
-- VERIFICATION
-- ================================================================

DO $$
DECLARE
  users_table_exists BOOLEAN;
  users_rls_enabled BOOLEAN;
BEGIN
  -- Check if users table exists
  SELECT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'users'
  ) INTO users_table_exists;
  
  IF users_table_exists THEN
    -- Check if RLS is enabled
    SELECT rowsecurity INTO users_rls_enabled
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'users';
    
    IF users_rls_enabled THEN
      RAISE NOTICE '✓ users table exists and RLS is enabled';
    ELSE
      RAISE WARNING '✗ users table exists but RLS is NOT enabled';
    END IF;
  ELSE
    RAISE NOTICE 'ℹ users table does not exist in database (this is OK - using Supabase Auth instead)';
  END IF;
END $$;

-- ================================================================
-- COMPLETE DATABASE STATUS CHECK
-- ================================================================

SELECT 
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN (
    'users',          -- Legacy table (may not exist)
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
    'notifications'
  )
ORDER BY tablename;
