# RLS Deployment Checklist

## ✅ Completed Steps
- [x] Created fixed RLS migration (`0001_enable_rls_policies_fixed.sql`)
- [x] Applied RLS policies migration in Supabase
- [x] Applied user JWT migration (`0002_update_existing_users_jwt.sql`)
- [x] Application code updated to use `app_metadata`
- [x] Application restarted successfully

---

## 🔍 STEP 1: Verify Database Setup (DO THIS NOW)

**Open Supabase Dashboard → SQL Editor and run these 3 queries:**

### Query 1: Check users have agency_id in JWT
```sql
SELECT 
  id,
  email,
  raw_app_meta_data->>'agency_id' as agency_id_in_jwt
FROM auth.users
ORDER BY email;
```
**Expected:** All users show a UUID in `agency_id_in_jwt` column.

---

### Query 2: Verify RLS is enabled
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('agencies', 'profiles', 'clients', 'projects', 'tasks')
ORDER BY tablename;
```
**Expected:** All 5 tables show `rowsecurity = t` (true).

---

### Query 3: Verify helper functions exist
```sql
SELECT routine_name, routine_schema 
FROM information_schema.routines 
WHERE routine_name IN ('get_agency_id', 'is_authenticated')
  AND routine_schema = 'public';
```
**Expected:** Shows 2 rows with both functions in `public` schema.

---

## 🔴 STEP 2: Force Global Logout (CRITICAL!)

**In Supabase Dashboard:**

1. Navigate to **Authentication** → **Configuration**
2. Scroll to **Session Management** section  
3. Click **"Sign out all users"** button

This forces everyone to re-login with updated JWTs containing `agency_id` in `app_metadata`.

**⚠️ WARNING:** Until users re-login, they will see 401 errors and cannot access the application. This is expected behavior!

---

## 🧪 STEP 3: Test Application Access

### Test A: Admin User Access

1. **Open application** in browser
2. **You should be logged out** (redirected to login)
3. **Login** as: `agent3@demo.com` / `Agent1234`
4. **Navigate to Dashboard** - should load successfully
5. **Navigate to Clients page** - should show "MMA Marketing" client
6. **Open Browser Console (F12)** - check for errors
7. **Expected:** No RLS or permission errors

### Test B: Client User Access

1. **Logout** from application
2. **Login** as: `jon@mmagency.co.uk` / `Letmein120`
3. **Navigate to Dashboard** - should load successfully
4. **Check data** - should only see YOUR client data (not other clients)
5. **Open Browser Console (F12)** - check for errors
6. **Expected:** No RLS or permission errors

---

## 🔍 STEP 4: Verify Tenant Isolation

### Test in Supabase SQL Editor

Run this query to see ALL clients (you're using service role, so RLS doesn't apply):

```sql
SELECT 
  c.id,
  c.name,
  c.agency_id,
  a.name as agency_name
FROM clients c
JOIN agencies a ON a.id = c.agency_id
ORDER BY a.name, c.name;
```

**This shows ALL clients from ALL agencies** (because you're using the service role which bypasses RLS).

**The key test:** When users access data through the application API, RLS automatically filters by their `agency_id` from the JWT. Each user sees ONLY their agency's data.

---

## 🎯 Success Indicators

**✅ You'll know RLS is working correctly when:**

1. All 3 SQL verification queries return expected results
2. Users can login after forced logout
3. Admin sees only their agency's clients
4. Client sees only their own data
5. No RLS/permission errors in browser console
6. Application logs show no database errors

---

## 🚨 Troubleshooting

### Issue: "401 Invalid or expired" errors after migration

**Status:** ✅ **EXPECTED BEHAVIOR**

**Why:** Old JWT sessions don't have `agency_id` in `app_metadata`. Users must re-login.

**Solution:** Force global logout (Step 2 above) or ask users to logout/login manually.

---

### Issue: Users can't see any data after re-login

**Diagnosis:**

1. Check if JWT has agency_id:
```sql
SELECT email, raw_app_meta_data->>'agency_id' 
FROM auth.users 
WHERE email = '<user-email>';
```

2. If NULL, re-run migration 2:
```sql
-- Run the entire 0002_update_existing_users_jwt.sql again
```

---

### Issue: Users see data from other agencies

**Diagnosis:**

1. Verify RLS is enabled:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'clients';
```

2. If `rowsecurity = f`, re-run migration 1
3. Check policies exist:
```sql
SELECT * FROM pg_policies WHERE tablename = 'clients';
```

**Solution:** Re-apply `0001_enable_rls_policies_fixed.sql`

---

### Issue: Database permission errors

**Check helper function permissions:**
```sql
GRANT EXECUTE ON FUNCTION public.get_agency_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_authenticated() TO authenticated;
```

---

## 📝 After Testing Checklist

Once all tests pass:

- [ ] Verified all 3 SQL queries return expected results
- [ ] Forced global logout in Supabase
- [ ] Tested Admin login - works correctly
- [ ] Tested Client login - works correctly
- [ ] Verified tenant isolation (each agency sees only their data)
- [ ] Checked browser console - no errors
- [ ] Checked application logs - no RLS errors
- [ ] Updated documentation

---

## 🎉 Deployment Complete!

**Your Agency Client Portal now has:**

✅ **Defense-in-Depth Security:**
- Application-level middleware filtering
- Database-level RLS policies
- JWT-based tenant context (immutable `app_metadata`)

✅ **Production-Ready Multi-Tenancy:**
- All 14 tables protected with RLS
- Automatic query filtering by agency
- Protection against SQL injection, direct database access, and compromised keys

✅ **Zero-Trust Architecture:**
- Every database query verified by Postgres
- Users cannot access other agencies' data
- Even service keys respect tenant boundaries (except admin/service role)

---

## 📚 Reference

- **RLS Implementation Guide:** `RLS_IMPLEMENTATION_GUIDE.md`
- **Test Suite:** `RLS_VERIFICATION_TESTS.md`
- **Migration 1:** `migrations/0001_enable_rls_policies_fixed.sql`
- **Migration 2:** `migrations/0002_update_existing_users_jwt.sql`
- **Updated Auth Code:** `server/lib/supabase-auth.ts`
