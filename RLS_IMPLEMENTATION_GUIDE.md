# Row-Level Security (RLS) Implementation Guide

## Overview

This document explains the RLS (Row-Level Security) implementation for the multi-tenant Agency Client Portal. RLS provides **database-level tenant isolation**, ensuring that even direct SQL queries respect agency boundaries.

## 🔒 Security Architecture

### Before RLS (Application-Level Only)
- ❌ Middleware checks (`requireAuth`, `requireClientAccess`)
- ❌ Storage layer filtering by `agencyId`
- ❌ **Vulnerable to:** application bugs, direct database access, service key leaks

### After RLS (Defense-in-Depth)
- ✅ Application-level security (middleware)
- ✅ **Database-level security (RLS policies)**
- ✅ **Protected against:** application bypasses, SQL editor access, compromised service keys

## 📋 Implementation Steps

### Step 1: Apply RLS Migration

**Option A: Using Supabase Dashboard (Recommended)**

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Copy contents of `migrations/0001_enable_rls_policies.sql`
4. Paste and run the SQL
5. Verify success in the output panel

**Option B: Using Drizzle CLI**

```bash
# Push schema changes to database
npm run db:push

# Then apply RLS policies manually via SQL editor
```

**Option C: Using psql (Advanced)**

```bash
# Connect to your Supabase database
psql "your-supabase-connection-string"

# Run the migration
\i migrations/0001_enable_rls_policies.sql
```

### Step 2: Update Existing Users

All existing users need `agency_id` in their JWT `app_metadata`. Run this migration:

```sql
-- Update existing users with agency_id in app_metadata
-- This script gets agencyId from profiles and sets it in JWT

DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT p.id, p.agency_id 
    FROM profiles p 
    WHERE p.agency_id IS NOT NULL
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
  END LOOP;
  
  RAISE NOTICE 'Updated % users with agency_id in app_metadata', (SELECT COUNT(*) FROM profiles WHERE agency_id IS NOT NULL);
END $$;

-- Also update Client users (get agency from their client record)
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT p.id, c.agency_id 
    FROM profiles p
    JOIN clients c ON c.profile_id = p.id
    WHERE p.role = 'Client'
  LOOP
    UPDATE auth.users
    SET raw_app_meta_data = 
      jsonb_set(
        COALESCE(raw_app_meta_data, '{}'::jsonb),
        '{agency_id}',
        to_jsonb(user_record.agency_id::text)
      )
    WHERE id = user_record.id;
  END LOOP;
  
  RAISE NOTICE 'Updated % client users with agency_id in app_metadata', (SELECT COUNT(*) FROM profiles WHERE role = 'Client');
END $$;
```

### Step 3: Verify RLS is Working

Test RLS policies by simulating different users:

```sql
-- Test 1: View as specific user
SET request.jwt.claim.sub = 'user-uuid-here';
SET request.jwt.claim.app_metadata = '{"agency_id": "agency-uuid-here"}';

-- Try to query clients - should only see clients from this agency
SELECT * FROM clients;

-- Reset
RESET request.jwt.claim.sub;
RESET request.jwt.claim.app_metadata;
```

**Expected Behavior:**
- ✅ Users only see data from their agency
- ✅ Cross-agency queries return empty results
- ✅ Unauthenticated queries are blocked

## 🏗️ RLS Policy Architecture

### Tenant Isolation Strategy

**1. Direct Agency Relationship**
```sql
-- Tables: clients, profiles (Admin/Staff)
WHERE agency_id = auth.get_agency_id()
```

**2. Indirect via Clients Table**
```sql
-- Tables: projects, invoices, initiatives, metrics, etc.
WHERE client_id IN (
  SELECT id FROM clients WHERE agency_id = auth.get_agency_id()
)
```

**3. Multi-Level Relationships**
```sql
-- Tasks (via project → client)
WHERE project_id IN (
  SELECT id FROM projects WHERE client_id IN (
    SELECT id FROM clients WHERE agency_id = auth.get_agency_id()
  )
)
```

**4. User-Specific Data**
```sql
-- Notifications (per-user, not per-agency)
WHERE user_id = auth.uid()
```

### Policy Types

**SELECT Policies**: Who can view data
```sql
CREATE POLICY "Users can view X in their agency"
ON table_name FOR SELECT
TO authenticated
USING (/* agency check */);
```

**INSERT/UPDATE/DELETE Policies**: Who can modify data
```sql
CREATE POLICY "Admins can manage X in their agency"
ON table_name FOR ALL
TO authenticated
USING (/* check for read */)
WITH CHECK (/* check for write */);
```

## 🔍 Testing RLS Policies

### Manual Testing

**Test 1: Cross-Agency Access**
```sql
-- Login as user from Agency A
-- Try to access client from Agency B (should fail)
SELECT * FROM clients WHERE id = 'agency-b-client-id';
-- Expected: Empty result
```

**Test 2: Own Agency Access**
```sql
-- Login as user from Agency A
-- Access client from Agency A (should succeed)
SELECT * FROM clients WHERE agency_id = 'agency-a-id';
-- Expected: Returns clients from Agency A
```

**Test 3: Unauthenticated Access**
```sql
-- No auth token set
SELECT * FROM clients;
-- Expected: Empty result or permission denied
```

### Application Testing

1. **Login as Admin from Agency A**
   - Navigate to clients list
   - Verify only Agency A clients visible
   - Check browser network tab for SQL queries

2. **Login as Client from Agency B**
   - View dashboard
   - Verify only own company data visible
   - Check that cross-agency API calls fail

3. **Check Application Logs**
   - No RLS policy violations logged
   - All queries filtered by `agency_id`

## 📊 Performance Considerations

### Optimized Indexes

The migration creates indexes for all RLS-checked columns:

```sql
-- Optimizes agency_id lookups
CREATE INDEX idx_clients_agency_id_rls ON clients(agency_id);

-- Optimizes client_id lookups for indirect relationships
CREATE INDEX idx_projects_client_id_rls ON projects(client_id);
CREATE INDEX idx_invoices_client_id_rls ON invoices(client_id);
```

### Best Practices

1. **Wrap function calls in SELECT** for caching:
   ```sql
   -- ❌ Bad: Function called for every row
   WHERE agency_id = auth.get_agency_id()
   
   -- ✅ Good: Function result cached
   WHERE agency_id = (SELECT auth.get_agency_id())
   ```

2. **Use indexes on all filtered columns**:
   - All `agency_id` columns are indexed
   - All `client_id` foreign keys are indexed
   - Query plans remain efficient

3. **Monitor query performance**:
   ```sql
   EXPLAIN ANALYZE SELECT * FROM projects;
   ```

## 🚨 Troubleshooting

### Issue: Users can't see any data

**Cause**: Missing `agency_id` in JWT `app_metadata`

**Fix**:
1. Check if user has `agency_id` in JWT:
   ```sql
   SELECT raw_app_meta_data FROM auth.users WHERE id = 'user-uuid';
   ```

2. If missing, run Step 2 migration above

3. Have user logout and login again (refreshes JWT)

### Issue: RLS policy violation errors

**Cause**: Application trying to insert data without proper `agency_id`

**Fix**:
1. Ensure all INSERT operations set correct `agency_id`
2. Check application logs for failed queries
3. Verify `createUserWithProfile` sets `app_metadata.agency_id`

### Issue: Performance degradation

**Cause**: Missing indexes or complex subqueries

**Fix**:
1. Run `EXPLAIN ANALYZE` on slow queries
2. Verify all RLS indexes exist (see migration)
3. Consider materialized views for complex joins

## 🔄 Future Maintenance

### Adding New Tables

When adding tables that need tenant isolation:

1. **Add agency relationship** to schema:
   ```typescript
   export const newTable = pgTable("new_table", {
     id: uuid("id").primaryKey(),
     clientId: uuid("client_id").references(() => clients.id),
     // ... other columns
   });
   ```

2. **Enable RLS**:
   ```sql
   ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
   ```

3. **Create policies**:
   ```sql
   CREATE POLICY "Users can view data in their agency"
   ON new_table FOR SELECT
   TO authenticated
   USING (
     client_id IN (
       SELECT id FROM clients WHERE agency_id = (SELECT auth.get_agency_id())
     )
   );
   ```

4. **Add index**:
   ```sql
   CREATE INDEX idx_new_table_client_id ON new_table(client_id);
   ```

### Monitoring

- **Supabase Dashboard**: Monitor RLS policy hits in Database → Performance
- **Application Logs**: Watch for RLS-related errors
- **Query Performance**: Regular `EXPLAIN ANALYZE` checks

## ✅ Verification Checklist

Before deploying RLS to production:

- [ ] All 14 tables have RLS enabled
- [ ] All policies tested with different user roles
- [ ] Existing users updated with `agency_id` in JWT
- [ ] Performance indexes created and verified
- [ ] Cross-agency access blocked (tested)
- [ ] Own agency access working (tested)
- [ ] Application still functions correctly
- [ ] No RLS policy violations in logs
- [ ] Documentation updated

## 🔐 Security Benefits

With RLS enabled, you now have:

1. **Defense-in-Depth**: Application + Database layers
2. **Zero-Trust Architecture**: Every query verified by database
3. **Protection Against**:
   - Application bugs/bypasses
   - Direct SQL access (dashboard, psql)
   - Service key compromise
   - SQL injection attacks
4. **Compliance Ready**: Database-enforced data isolation for GDPR, SOC 2

## 📚 Additional Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [PostgreSQL RLS Guide](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Multi-Tenancy Best Practices](https://supabase.com/docs/guides/database/postgres/row-level-security#multi-tenancy)
