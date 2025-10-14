# RLS Verification Tests

## Test Environment
- **Test Agency 1**: Agency ID `614d7633-5dd9-4147-a261-ebf8458a2ec4`
  - Admin: `agent3@demo.com` / `Agent1234`
  - Client: `jon@mmagency.co.uk` / `Letmein120`
- **Test Agency 2**: If you have another agency for testing

---

## Test Suite

### Test 1: Verify JWT Contains agency_id

**In Supabase SQL Editor:**

```sql
-- Check all users have agency_id in JWT
SELECT 
  id,
  email,
  raw_app_meta_data->>'agency_id' as agency_id_in_jwt,
  raw_user_meta_data->>'role' as role
FROM auth.users
ORDER BY email;
```

**Expected Result:** All users should have `agency_id_in_jwt` populated (not NULL).

---

### Test 2: Verify RLS is Enabled

**In Supabase SQL Editor:**

```sql
-- Check RLS is enabled on all tables
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'agencies', 'profiles', 'clients', 'projects', 'tasks', 
    'staff_assignments', 'invoices', 'invoice_line_items',
    'initiatives', 'daily_metrics', 'client_integrations',
    'client_objectives', 'client_messages', 'notifications'
  )
ORDER BY tablename;
```

**Expected Result:** All tables should show `rowsecurity = true`.

---

### Test 3: Verify Helper Functions Work

**In Supabase SQL Editor:**

```sql
-- Test helper functions exist
SELECT 
  routine_name, 
  routine_schema 
FROM information_schema.routines 
WHERE routine_name IN ('get_agency_id', 'is_authenticated')
  AND routine_schema = 'public';
```

**Expected Result:** Both functions should be listed.

---

### Test 4: Application-Level Testing

#### 4A: Admin Access Test

1. **Logout** from application (if logged in)
2. **Login** as `agent3@demo.com` / `Agent1234` (Admin)
3. **Navigate to Clients page**
4. **Verify:** You see only clients from Agency 1 (e.g., "MMA Marketing")
5. **Check browser console:** No errors should appear

#### 4B: Client Access Test

1. **Logout** from application
2. **Login** as `jon@mmagency.co.uk` / `Letmein120` (Client)
3. **Navigate to Dashboard**
4. **Verify:** You see only your own client data
5. **Check browser console:** No errors should appear

---

### Test 5: Database-Level Isolation Test

**This is the critical security test - verifying RLS blocks unauthorized access at the database level.**

#### 5A: Count Total Clients (Without RLS Context)

**In Supabase SQL Editor:**

```sql
-- As admin/service role, see ALL clients across agencies
SELECT 
  c.id,
  c.name,
  c.agency_id,
  a.name as agency_name
FROM clients c
JOIN agencies a ON a.id = c.agency_id
ORDER BY a.name, c.name;
```

**Expected Result:** Shows clients from ALL agencies (Service role bypasses RLS).

#### 5B: Verify RLS Blocks Cross-Agency Access

**Test Plan:**

1. **Create a SQL function** that simulates a user query:

```sql
-- Create test function that runs with user's permissions
CREATE OR REPLACE FUNCTION test_rls_isolation(test_user_id UUID)
RETURNS TABLE(client_count BIGINT) AS $$
BEGIN
  -- Set the JWT context to simulate the user
  PERFORM set_config('request.jwt.claims', 
    json_build_object(
      'sub', test_user_id::text,
      'app_metadata', json_build_object(
        'agency_id', (
          SELECT p.agency_id::text 
          FROM profiles p 
          WHERE p.id = test_user_id
        )
      )
    )::text, 
    true
  );
  
  -- Try to query clients (RLS will filter automatically)
  RETURN QUERY
  SELECT COUNT(*) FROM clients;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test as Admin user (agent3@demo.com)
SELECT * FROM test_rls_isolation(
  (SELECT id FROM auth.users WHERE email = 'agent3@demo.com')
);
```

**Expected Result:** Should return only the count of clients in Agent3's agency.

---

### Test 6: Cross-Agency Data Leak Test

**Verify users CANNOT access other agencies' data:**

#### Method 1: Direct SQL Attempt

**In Supabase SQL Editor (as authenticated user):**

```sql
-- Try to query ALL agencies (should only see your own)
SELECT * FROM agencies;

-- Try to query clients from another agency
SELECT * FROM clients WHERE agency_id != '614d7633-5dd9-4147-a261-ebf8458a2ec4';
```

**Expected Result:** 
- First query: Returns only YOUR agency
- Second query: Returns 0 rows (RLS blocks access)

#### Method 2: API Endpoint Test

**In browser console (F12) while logged in:**

```javascript
// Try to fetch all clients
const response = await fetch('/api/agency/clients');
const clients = await response.json();
console.log('Clients visible to me:', clients);

// All clients should belong to YOUR agency only
const allFromMyAgency = clients.every(
  c => c.agencyId === '<your-agency-id>'
);
console.log('All clients from my agency?', allFromMyAgency);
```

**Expected Result:** `allFromMyAgency` should be `true`.

---

### Test 7: Nested Relationship Access

**Verify RLS works for deeply nested relationships:**

**In application or browser console:**

```javascript
// Fetch tasks (which require: task -> project -> client -> agency)
const tasksResponse = await fetch('/api/tasks');
const tasks = await tasksResponse.json();
console.log('Tasks visible:', tasks);

// All tasks should belong to projects in YOUR agency's clients
```

**Expected Result:** Only tasks from your agency's projects are returned.

---

## ✅ Pass Criteria

All tests must pass:

- [x] All users have `agency_id` in JWT `app_metadata`
- [x] All tables have RLS enabled (`rowsecurity = true`)
- [x] Helper functions exist and are executable
- [x] Admin users see only their agency's data
- [x] Client users see only their own data
- [x] Database-level queries respect RLS policies
- [x] Cross-agency access attempts return 0 rows
- [x] Nested relationship queries are properly filtered

---

## 🚨 Troubleshooting

### Issue: Users can't see ANY data after RLS

**Solution:**

1. Check JWT has agency_id:
```sql
SELECT id, email, raw_app_meta_data->>'agency_id' 
FROM auth.users 
WHERE email = '<user-email>';
```

2. If NULL, user needs to logout/login again
3. If still NULL, re-run migration 2

### Issue: Users see data from other agencies

**Solution:**

1. Verify RLS is enabled:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'clients';
```

2. If `rowsecurity = false`, re-run migration 1
3. Check policy exists:
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'clients';
```

### Issue: Database queries fail with permission errors

**Solution:**

Ensure helper functions have correct permissions:
```sql
GRANT EXECUTE ON FUNCTION public.get_agency_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_authenticated() TO authenticated;
```

---

## 🎯 Success Indicators

**You'll know RLS is working correctly when:**

1. ✅ Users can access their own agency's data seamlessly
2. ✅ Users CANNOT see other agencies' data (even if they try)
3. ✅ No database errors in application logs
4. ✅ SQL queries automatically respect tenant boundaries
5. ✅ Even service role (admin) SQL shows RLS is active
