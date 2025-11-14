# Task Lists Security Test Plan
## Comprehensive Defense-in-Depth Verification

This test plan verifies **5 layers of security** for the task lists feature:
1. **API Middleware** - JWT validation and agencyId extraction
2. **Route Guards** - Role-based access control
3. **Storage Layer** - agencyId filtering in WHERE clauses
4. **Storage Validation** - Explicit error throwing on unauthorized access
5. **Database RLS** - Row-Level Security policies

---

## Prerequisites

### Test User Credentials
- **SuperAdmin**: DemoAgency@demo.com / DemoAgency120#
- **Agency 1 Admin**: DemoStaff@demo.com / DemoStaff120#
- **Agency 1 Client**: brad@mmagency.co.uk / Brad120#
- **Agency 2 User**: (Create if needed for cross-agency testing)

### Setup Steps
1. ✅ Run `migrations/0001_enable_rls_policies.sql` in Supabase SQL Editor
2. ✅ Run `migrations/0009_add_task_lists_rls.sql` in Supabase SQL Editor
3. ✅ Verify server is running without errors
4. ✅ Create test data in at least 2 different agencies

---

## Test Suite 1: RLS Database-Level Isolation

### Objective
Verify that RLS policies block cross-tenant queries **even with direct SQL access**.

### Test 1.1: Agency Isolation via RLS
**Method**: Direct SQL query in Supabase SQL Editor

```sql
-- Login as Agency 1 user (DemoStaff@demo.com) in Supabase
-- This simulates authenticated user with agency_id in JWT

-- Should return only Agency 1 task lists
SELECT * FROM task_lists;

-- Should return 0 rows from other agencies
SELECT * FROM task_lists WHERE agency_id = '<agency-2-id>';
```

**Expected Result**:
- ✅ Query returns only task lists where `agency_id` matches JWT app_metadata
- ✅ No task lists from other agencies visible
- ✅ Even explicit WHERE clause for other agency returns empty result

### Test 1.2: RLS Blocks Unauthorized INSERT
```sql
-- Login as Agency 1 user
-- Try to insert task list for Agency 2

INSERT INTO task_lists (id, name, project_id, agency_id, created_at)
VALUES (
  gen_random_uuid(),
  'Malicious List',
  '<agency-2-project-id>',
  '<agency-2-id>',
  NOW()
);
```

**Expected Result**:
- ❌ INSERT fails with RLS policy violation
- ✅ Error message: "new row violates row-level security policy"

### Test 1.3: RLS Blocks Unauthorized UPDATE
```sql
-- Login as Agency 1 user
-- Try to update Agency 2 task list

UPDATE task_lists
SET name = 'Hacked'
WHERE agency_id = '<agency-2-id>';
```

**Expected Result**:
- ✅ UPDATE affects 0 rows (RLS blocks access)
- ✅ No error thrown, but nothing updated

### Test 1.4: RLS Blocks Unauthorized DELETE
```sql
-- Login as Agency 1 user
-- Try to delete Agency 2 task list

DELETE FROM task_lists
WHERE agency_id = '<agency-2-id>';
```

**Expected Result**:
- ✅ DELETE affects 0 rows (RLS blocks access)
- ✅ No data deleted from other agency

---

## Test Suite 2: API Route-Level Isolation

### Objective
Verify that API routes enforce tenant isolation through JWT extraction and storage layer filtering.

### Test 2.1: GET /api/agency/projects/:projectId/lists
**Setup**: Login as Agency 1 Admin, get Project 1 ID from Agency 1

```bash
# Should succeed - same agency
curl -X GET "http://localhost:5000/api/agency/projects/<agency-1-project-id>/lists" \
  -H "Authorization: Bearer <agency-1-admin-jwt>"
```

**Expected Result**:
- ✅ 200 OK with task lists for Project 1
- ✅ Only lists belonging to Agency 1 returned

**Cross-Tenant Attack**:
```bash
# Should fail - different agency
curl -X GET "http://localhost:5000/api/agency/projects/<agency-2-project-id>/lists" \
  -H "Authorization: Bearer <agency-1-admin-jwt>"
```

**Expected Result**:
- ✅ 403 Forbidden or empty array
- ✅ No task lists from Agency 2 visible

### Test 2.2: POST /api/agency/task-lists (Create)
**Valid Request - Same Agency**:
```bash
curl -X POST "http://localhost:5000/api/agency/task-lists" \
  -H "Authorization: Bearer <agency-1-admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test List",
    "projectId": "<agency-1-project-id>"
  }'
```

**Expected Result**:
- ✅ 201 Created
- ✅ Task list created with correct agencyId from JWT
- ✅ Response includes new task list with proper agencyId

**Attack: Agency ID Spoofing**:
```bash
curl -X POST "http://localhost:5000/api/agency/task-lists" \
  -H "Authorization: Bearer <agency-1-admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Malicious List",
    "projectId": "<agency-2-project-id>",
    "agencyId": "<agency-2-id>"
  }'
```

**Expected Result**:
- ✅ 403 Forbidden with message "Cannot create task list for another agency"
- ✅ No task list created in Agency 2

### Test 2.3: PATCH /api/agency/task-lists/:id (Update)
**Valid Request - Same Agency**:
```bash
curl -X PATCH "http://localhost:5000/api/agency/task-lists/<agency-1-list-id>" \
  -H "Authorization: Bearer <agency-1-admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated List Name"
  }'
```

**Expected Result**:
- ✅ 200 OK
- ✅ Task list updated successfully
- ✅ Response includes updated task list

**Attack: Cross-Agency Update**:
```bash
curl -X PATCH "http://localhost:5000/api/agency/task-lists/<agency-2-list-id>" \
  -H "Authorization: Bearer <agency-1-admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hacked Name"
  }'
```

**Expected Result**:
- ✅ 404 Not Found with generic message "Task list not found"
- ✅ No update performed on Agency 2 list
- ✅ No information leakage about whether list exists

**Attack: Immutable Field Tampering**:
```bash
curl -X PATCH "http://localhost:5000/api/agency/task-lists/<agency-1-list-id>" \
  -H "Authorization: Bearer <agency-1-admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Valid Update",
    "agencyId": "<agency-2-id>",
    "projectId": "<agency-2-project-id>",
    "createdAt": "2020-01-01T00:00:00Z"
  }'
```

**Expected Result**:
- ✅ 200 OK (request accepted)
- ✅ Only `name` field updated
- ✅ agencyId, projectId, createdAt silently rejected (not applied)
- ✅ Task list remains in Agency 1

### Test 2.4: DELETE /api/agency/task-lists/:id
**Valid Request - Same Agency**:
```bash
curl -X DELETE "http://localhost:5000/api/agency/task-lists/<agency-1-list-id>" \
  -H "Authorization: Bearer <agency-1-admin-jwt>"
```

**Expected Result**:
- ✅ 204 No Content
- ✅ Task list deleted successfully
- ✅ Associated tasks CASCADE deleted (if listId constraint enabled)

**Attack: Cross-Agency Delete**:
```bash
curl -X DELETE "http://localhost:5000/api/agency/task-lists/<agency-2-list-id>" \
  -H "Authorization: Bearer <agency-1-admin-jwt>"
```

**Expected Result**:
- ✅ 404 Not Found with generic message "Task list not found"
- ✅ No deletion performed on Agency 2 list
- ✅ No information leakage

---

## Test Suite 3: SuperAdmin Cross-Agency Access

### Objective
Verify that SuperAdmin users can access task lists across ALL agencies.

### Test 3.1: SuperAdmin GET All Task Lists
```bash
# Login as SuperAdmin (DemoAgency@demo.com)
curl -X GET "http://localhost:5000/api/agency/projects/<agency-2-project-id>/lists" \
  -H "Authorization: Bearer <superadmin-jwt>"
```

**Expected Result**:
- ✅ 200 OK
- ✅ Returns task lists from ANY agency (not limited by agencyId)
- ✅ SuperAdmin path in storage layer (agencyId = undefined) allows full access

### Test 3.2: SuperAdmin Create Task List for Any Agency
```bash
curl -X POST "http://localhost:5000/api/agency/task-lists" \
  -H "Authorization: Bearer <superadmin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SuperAdmin Created List",
    "projectId": "<any-agency-project-id>",
    "agencyId": "<target-agency-id>"
  }'
```

**Expected Result**:
- ✅ 201 Created
- ✅ Task list created in specified agency
- ✅ SuperAdmin can specify agencyId explicitly

### Test 3.3: SuperAdmin Update Any Task List
```bash
curl -X PATCH "http://localhost:5000/api/agency/task-lists/<any-agency-list-id>" \
  -H "Authorization: Bearer <superadmin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated by SuperAdmin"
  }'
```

**Expected Result**:
- ✅ 200 OK
- ✅ Update succeeds for task lists in ANY agency

### Test 3.4: SuperAdmin Delete Any Task List
```bash
curl -X DELETE "http://localhost:5000/api/agency/task-lists/<any-agency-list-id>" \
  -H "Authorization: Bearer <superadmin-jwt>"
```

**Expected Result**:
- ✅ 204 No Content
- ✅ Deletion succeeds for task lists in ANY agency

---

## Test Suite 4: Error Message Security

### Objective
Verify that error messages do not leak sensitive information about other agencies.

### Test 4.1: Generic 404 for Non-Existent Task List
```bash
# Try to access random UUID that doesn't exist
curl -X GET "http://localhost:5000/api/agency/task-lists/00000000-0000-0000-0000-000000000000/tasks" \
  -H "Authorization: Bearer <agency-1-admin-jwt>"
```

**Expected Result**:
- ✅ 404 Not Found
- ✅ Generic message: "Task list not found"
- ✅ Does NOT reveal if task list exists in another agency

### Test 4.2: Generic 404 for Cross-Agency Access
```bash
# Try to access task list from Agency 2
curl -X PATCH "http://localhost:5000/api/agency/task-lists/<agency-2-list-id>" \
  -H "Authorization: Bearer <agency-1-admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test"}'
```

**Expected Result**:
- ✅ 404 Not Found
- ✅ Message: "Task list not found"
- ✅ Indistinguishable from non-existent task list error
- ✅ No information about whether task list exists

### Test 4.3: Validation Errors Don't Leak Context
```bash
# Invalid data should trigger Zod validation error
curl -X POST "http://localhost:5000/api/agency/task-lists" \
  -H "Authorization: Bearer <agency-1-admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "",
    "projectId": "invalid-uuid"
  }'
```

**Expected Result**:
- ✅ 400 Bad Request
- ✅ Zod validation error (e.g., "Invalid UUID")
- ✅ No information about agency structure or other data

---

## Test Suite 5: Storage Layer Defense

### Objective
Verify that storage methods enforce agencyId filtering and throw explicit errors.

### Test 5.1: Storage Layer Blocks Cross-Agency Reads
**Test via API route that calls `getTaskListById` with wrong agency**:

```bash
# This tests that storage.getTaskListById(id, agencyId) filters correctly
curl -X GET "http://localhost:5000/api/agency/task-lists/<agency-2-list-id>/tasks" \
  -H "Authorization: Bearer <agency-1-admin-jwt>"
```

**Expected Behavior**:
1. Route calls `storage.getTaskListById(id, agencyId)`
2. Storage filters: `WHERE id = ? AND agency_id = ?`
3. Returns `undefined` (no match)
4. Route returns 404

**Verification**:
- ✅ No task list returned from other agency
- ✅ Storage layer enforces AND clause

### Test 5.2: Storage Layer Throws on Unauthorized Update
**Test that `updateTaskList` throws when 0 rows affected**:

```bash
# Try to update Agency 2 list as Agency 1 user
curl -X PATCH "http://localhost:5000/api/agency/task-lists/<agency-2-list-id>" \
  -H "Authorization: Bearer <agency-1-admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Hacked"}'
```

**Expected Behavior**:
1. Route calls `storage.updateTaskList(id, data, agencyId)`
2. Storage executes: `UPDATE task_lists SET ... WHERE id = ? AND agency_id = ?`
3. Result length = 0 (no rows affected)
4. Storage throws: "Task list not found or access denied"
5. Route catches error → 404 response

**Verification**:
- ✅ Storage throws explicit error (not silent undefined)
- ✅ Route maps to 404
- ✅ No update performed

### Test 5.3: Storage Layer Sanitizes Immutable Fields
**Verify that `updateTaskList` strips immutable fields**:

```bash
# Send request with immutable fields in payload
curl -X PATCH "http://localhost:5000/api/agency/task-lists/<agency-1-list-id>" \
  -H "Authorization: Bearer <agency-1-admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Legit Update",
    "id": "00000000-0000-0000-0000-000000000000",
    "agencyId": "<agency-2-id>",
    "projectId": "<agency-2-project-id>",
    "createdAt": "2020-01-01T00:00:00Z",
    "updatedAt": "2020-01-01T00:00:00Z"
  }'
```

**Expected Behavior**:
1. Storage destructures: `const { id: _, agencyId: __, projectId: ___, createdAt: ____, updatedAt: _____, ...sanitizedData } = data`
2. Only `{ name: "Legit Update" }` passed to UPDATE query
3. All immutable fields rejected

**Verification**:
- ✅ Check DB: only `name` field updated
- ✅ agencyId, projectId, createdAt, updatedAt unchanged
- ✅ No error thrown (silent rejection acceptable per existing pattern)

---

## Test Suite 6: End-to-End CRUD Workflows

### Objective
Verify complete CRUD workflows work correctly for authorized users.

### Test 6.1: Complete Task List Lifecycle
**As Agency 1 Admin**:

1. **Create Project**:
```bash
curl -X POST "http://localhost:5000/api/agency/projects" \
  -H "Authorization: Bearer <agency-1-admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project",
    "clientId": "<agency-1-client-id>"
  }'
```

2. **Create Task List**:
```bash
curl -X POST "http://localhost:5000/api/agency/task-lists" \
  -H "Authorization: Bearer <agency-1-admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sprint 1",
    "projectId": "<project-id-from-step-1>"
  }'
```

3. **Get Task Lists for Project**:
```bash
curl -X GET "http://localhost:5000/api/agency/projects/<project-id>/lists" \
  -H "Authorization: Bearer <agency-1-admin-jwt>"
```

4. **Update Task List**:
```bash
curl -X PATCH "http://localhost:5000/api/agency/task-lists/<list-id-from-step-2>" \
  -H "Authorization: Bearer <agency-1-admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sprint 1 - Updated"
  }'
```

5. **Delete Task List**:
```bash
curl -X DELETE "http://localhost:5000/api/agency/task-lists/<list-id>" \
  -H "Authorization: Bearer <agency-1-admin-jwt>"
```

**Expected Results**:
- ✅ All operations succeed (200/201/204)
- ✅ Data correctly associated with Agency 1
- ✅ All agencyId values match JWT context

---

## Summary Checklist

### Layer 1: API Middleware ✅
- [ ] JWT extracted from Authorization header
- [ ] agencyId available in `req.user.agencyId`
- [ ] Unauthenticated requests rejected

### Layer 2: Route Guards ✅
- [ ] requireAuth middleware blocks anonymous access
- [ ] requireRole("Admin") blocks non-admin users
- [ ] agencyId injected from JWT into storage calls

### Layer 3: Storage Filtering ✅
- [ ] All read operations filter by agencyId in WHERE clause
- [ ] All write operations enforce agencyId in WHERE clause
- [ ] SuperAdmin path (agencyId undefined) bypasses filters

### Layer 4: Storage Validation ✅
- [ ] updateTaskList throws on 0 rows affected
- [ ] deleteTaskList throws on 0 rows affected
- [ ] Immutable fields sanitized before UPDATE

### Layer 5: Database RLS ✅
- [ ] RLS enabled on task_lists table
- [ ] Policies enforce `(auth.jwt() -> 'app_metadata' ->> 'agency_id')::uuid` check
- [ ] Direct SQL queries respect tenant boundaries
- [ ] No cross-agency data visible via SQL

### Security Objectives ✅
- [ ] No cross-tenant data access via API
- [ ] No cross-tenant data access via direct SQL
- [ ] SuperAdmin can access all agencies
- [ ] Error messages don't leak information
- [ ] Immutable fields can't be tampered
- [ ] All CRUD operations work correctly for authorized users

---

## Automated Test Script (Optional)

You can create an automated test script using the provided curl commands. Example structure:

```bash
#!/bin/bash

# Configure test credentials
AGENCY_1_ADMIN_JWT="<token>"
AGENCY_2_ADMIN_JWT="<token>"
SUPERADMIN_JWT="<token>"

# Run test suites
echo "Running Security Test Suite..."

# Test 1: Cross-agency access blocked
echo "Test 1.1: Cross-agency GET..."
# curl commands...

# Test 2: Immutable field sanitization
echo "Test 2.1: Immutable field tampering..."
# curl commands...

# Generate report
echo "All tests completed. Review results above."
```

---

## Notes

1. **RLS + Application Security**: Both layers should work independently. Even if API routes are bypassed, RLS protects the database.

2. **SuperAdmin Exception**: SuperAdmin role is intentionally exempt from tenant isolation. Verify this works correctly.

3. **Error Message Consistency**: 404 responses should be identical whether resource doesn't exist or belongs to another agency.

4. **Phased Migration**: Remember `listId` is currently nullable. Once backfill is complete, re-enforce NOT NULL constraint.

5. **Performance**: RLS policies use indexes on `agency_id` for efficiency. Monitor query performance after deployment.

---

**Test Plan Version**: 1.0  
**Created**: November 14, 2025  
**For**: Task Lists Feature (Phase 1)  
**Status**: Ready for Execution
