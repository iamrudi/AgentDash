# Supabase Migration Readiness Assessment
## Agency Client Portal - October 12, 2025

---

## Executive Summary

**Feasibility Score: MEDIUM-HIGH (75/100)**

Your Agency Client Portal is **moderately well-positioned** for migration to Supabase. The database schema is fully compatible with PostgreSQL, making data migration straightforward. However, significant refactoring is required for authentication (custom JWT → Supabase Auth) and file storage (local filesystem → Supabase Storage). Approximately 40% of API endpoints are simple CRUD operations that could leverage Supabase's auto-generated APIs, while the remaining 60% contain essential business logic that must remain in your Express backend.

**Estimated Migration Effort: 40-60 developer hours**

---

## 1. Database & Schema Analysis

### ✅ Drizzle Schema Compatibility: **FULLY COMPATIBLE**

**Finding:** Your schema defined in `shared/schema.ts` is 100% compatible with Supabase's PostgreSQL database.

**Evidence:**
- Uses standard PostgreSQL types: `uuid`, `text`, `varchar`, `timestamp`, `numeric`, `integer`, `date`, `jsonb`
- No proprietary Neon-specific features detected
- All relationships use standard foreign keys with proper cascade rules
- Uses standard PostgreSQL functions: `gen_random_uuid()`, `defaultNow()`
- Indexes are properly defined using standard PostgreSQL syntax

**Schema Overview:**
- **14 tables** with proper relational structure
- **13 indexes** for query optimization
- **1 unique composite index** (client_integrations)
- **JSONB fields** for structured AI data (observationInsights, actionTasks)
- **Proper cascade rules** for data integrity

**No Migration Blockers Identified**

---

### ✅ Migration Path: **STRAIGHTFORWARD**

**Current Setup:**
```typescript
// drizzle.config.ts
export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
```

**Migration Steps:**
1. **Create Supabase Project** → Get new PostgreSQL connection string
2. **Update DATABASE_URL** → Point to Supabase database
3. **Run Drizzle Push** → `npx drizzle-kit push` to sync schema
4. **Data Migration** (if needed) → Use `pg_dump` from Neon + `pg_restore` to Supabase

**Existing Migration:**
- You have 1 migration file: `0000_elite_lockheed.sql`
- This can be used as a baseline or regenerated for Supabase

**Recommendation:** Start with a fresh Supabase project and use `drizzle-kit push` to create the schema from your TypeScript definitions. This is cleaner than importing old migrations.

---

### ✅ Data Dependencies: **NO BLOCKERS**

**Analysis of PostgreSQL Features Used:**
- ✅ UUID generation via `gen_random_uuid()` - **Supported by Supabase**
- ✅ JSONB data type - **Fully supported**
- ✅ Timestamps with `defaultNow()` - **Standard PostgreSQL**
- ✅ Foreign key constraints with cascade - **Standard PostgreSQL**
- ✅ Composite indexes - **Supported**
- ✅ Text search capabilities (if needed in future) - **Supported via pg_trgm**

**No Proprietary Extensions Detected**

Your schema uses only standard PostgreSQL features that are fully supported by Supabase's managed PostgreSQL offering.

---

## 2. Authentication System Refactoring Analysis

### ⚠️ Code Impact Assessment: **HIGH REFACTORING EFFORT**

**Current Custom Auth System:**

1. **Backend Auth Components:**
   - `server/lib/jwt.ts` - Custom JWT generation/verification
   - `server/middleware/auth.ts` - Custom auth middleware with RBAC
   - `server/routes.ts` - `/api/auth/signup` and `/api/auth/login` endpoints
   - Custom password hashing with bcryptjs
   - 7-day JWT tokens stored in Authorization headers

2. **Frontend Auth Components:**
   - `client/src/lib/auth.ts` - localStorage-based auth state
   - `client/src/lib/queryClient.ts` - Bearer token injection
   - Login/signup pages with custom form handling

**Refactoring Scope:**

| Component | Current Implementation | Supabase Equivalent | Effort |
|-----------|----------------------|---------------------|---------|
| User Signup | Custom endpoint with bcrypt | `supabase.auth.signUp()` | Medium |
| User Login | Custom JWT generation | `supabase.auth.signInWithPassword()` | Medium |
| Session Management | localStorage + JWT | Supabase session cookies | High |
| Auth Middleware | Custom JWT verification | Supabase JWT verification | Medium |
| Password Storage | bcrypt hashed in `users` table | Supabase auth.users | High |
| Token Refresh | Manual 7-day expiry | Automatic refresh tokens | Low |

**Estimated Lines of Code to Modify:** ~500-700 lines across 8-10 files

---

### 🔧 Role-Based Access Control (RBAC) Adaptation

**Current Implementation:**
- `profiles.role` column stores: 'Admin', 'Client', 'Staff'
- `requireRole()` middleware checks JWT payload
- Tenant isolation via `clientId` in JWT payload
- Manual role verification on every protected route

**Supabase Approach:**

**Option 1: User Metadata (Recommended for your use case)**
```typescript
// Store role in Supabase user metadata
await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      role: 'Client',
      full_name: fullName
    }
  }
});

// Access role from JWT
const { data: { user } } = await supabase.auth.getUser();
const role = user?.user_metadata?.role;
```

**Option 2: Separate Profiles Table (Your current approach)**
- Keep your existing `profiles` table
- Link via `user_id` to Supabase's `auth.users`
- Continue using your current RBAC middleware with slight modifications

**Recommended Hybrid Approach:**
1. Migrate to Supabase Auth for authentication
2. Keep your `profiles` table for extended user data and role management
3. Update `requireAuth` middleware to verify Supabase JWTs instead of custom JWTs
4. Maintain your existing `requireRole()` middleware logic

**Adaptation Required in `server/middleware/auth.ts`:**
```typescript
// BEFORE (Custom JWT)
const payload = verifyToken(token);

// AFTER (Supabase JWT)
const { data: { user }, error } = await supabase.auth.getUser(token);
if (error || !user) {
  return res.status(401).json({ message: "Invalid token" });
}

// Continue with existing profile lookup for role/clientId
const [profile] = await db.select().from(profiles)
  .where(eq(profiles.userId, user.id)).limit(1);
```

**Tenant Isolation:** Your existing tenant isolation logic can remain unchanged - you'll still query the `profiles` and `clients` tables to determine `clientId`.

---

### 🎨 Client-Side Impact

**Files Requiring Modification:**

1. **`client/src/lib/auth.ts`** (MAJOR REFACTOR)
   - Replace localStorage JWT with Supabase session
   - Update `setAuthUser()`, `getAuthUser()`, `clearAuthUser()`
   - Add Supabase client initialization

2. **`client/src/lib/queryClient.ts`** (MODERATE REFACTOR)
   - Replace `getAuthHeaders()` to use Supabase session token
   - Supabase automatically handles token refresh

3. **Login/Signup Pages** (MODERATE REFACTOR)
   - Replace custom API calls with Supabase auth methods
   - Error handling changes (Supabase error format differs)

**Before (Custom Auth):**
```typescript
// Login
const res = await apiRequest("POST", "/api/auth/login", { email, password });
const data = await res.json();
setAuthUser(data);
```

**After (Supabase Auth):**
```typescript
// Login
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password
});
if (error) throw error;

// Still need to fetch profile/role from your profiles table
const profileRes = await fetch('/api/client/profile');
const profile = await profileRes.json();
setAuthUser({ user: data.user, profile });
```

**Key Changes:**
- Replace 8-10 auth-related API calls with Supabase SDK calls
- Supabase session persists automatically (no manual localStorage needed)
- Protected routes can use `supabase.auth.getSession()` instead of custom token check

---

## 3. File & PDF Storage Migration Plan

### 📁 Current Method: **LOCAL FILESYSTEM (NOT SCALABLE)**

**Current Implementation (`server/services/pdfStorage.ts`):**
- PDFs saved to `public/invoices/` directory
- Files served via Express static middleware
- No cloud backup or redundancy
- **Critical Issue:** Files will be lost on Replit redeployments

**Current Flow:**
1. Puppeteer generates PDF buffer
2. `pdfStorage.savePDF()` writes to `/public/invoices/{invoiceNumber}.pdf`
3. Returns local URL: `/invoices/{filename}.pdf`
4. URL stored in `invoices.pdfUrl` column

---

### ☁️ Supabase Storage Solution: **RECOMMENDED MIGRATION**

**Proposed Architecture:**

**Storage Bucket Setup:**
```typescript
// Create public bucket for invoice PDFs (one-time setup)
await supabase.storage.createBucket('invoices', {
  public: true,
  fileSizeLimit: 10485760, // 10MB max
  allowedMimeTypes: ['application/pdf']
});
```

**Refactored `pdfStorage.ts`:**
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Server-side only
);

export class PDFStorageService {
  async savePDF(invoiceNumber: string, pdfBuffer: Buffer): Promise<string> {
    const filename = `${invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    const filePath = `invoices/${filename}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('invoices')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true // Overwrite if exists
      });

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('invoices')
      .getPublicUrl(filePath);

    console.log(`PDF saved to Supabase Storage: ${publicUrl}`);
    return publicUrl;
  }

  async deletePDF(pdfUrl: string): Promise<void> {
    // Extract path from full URL
    const filename = pdfUrl.split('/').pop();
    const filePath = `invoices/${filename}`;

    const { error } = await supabase.storage
      .from('invoices')
      .remove([filePath]);

    if (error) console.error('Error deleting PDF:', error);
  }

  async pdfExists(pdfUrl: string): Promise<boolean> {
    const filename = pdfUrl.split('/').pop();
    const filePath = `invoices/${filename}`;

    const { data, error } = await supabase.storage
      .from('invoices')
      .list('invoices', {
        search: filename
      });

    return !error && data.length > 0;
  }
}
```

**Migration Steps:**
1. Install `@supabase/supabase-js` package
2. Create Supabase Storage bucket via dashboard or API
3. Refactor `PDFStorageService` class (above code)
4. Update environment variables with Supabase credentials
5. **Data Migration:** Upload existing PDFs from `/public/invoices/` to Supabase Storage
6. Update `invoices.pdfUrl` in database to new Supabase URLs

**Benefits:**
- ✅ Persistent storage (survives redeployments)
- ✅ Automatic CDN distribution
- ✅ Built-in access controls
- ✅ 1GB free storage (Supabase free tier)

**Estimated Effort:** 4-6 hours (including testing and data migration)

---

## 4. API Endpoint & Business Logic Review

### 📊 Endpoint Classification (96 Total Routes Analyzed)

#### **Category A: Simple CRUD - Replaceable with Supabase API (~35 endpoints)**

These endpoints perform basic database operations with minimal logic:

**Client Management (8 endpoints):**
- `GET /api/agency/clients` - List all clients
- `GET /api/agency/clients/:clientId` - Get client details
- `PATCH /api/agency/clients/:clientId` - Update client
- `GET /api/client/profile` - Get current user's client profile
- `GET /api/agency/clients/:clientId/objectives` - Get client objectives
- `POST /api/agency/clients/:clientId/objectives` - Create objective
- `PATCH /api/agency/objectives/:id` - Update objective
- `DELETE /api/agency/objectives/:id` - Delete objective

**Projects & Tasks (12 endpoints):**
- `GET /api/agency/projects` - List all projects
- `POST /api/agency/projects` - Create project
- `GET /api/agency/projects/:id` - Get project details
- `PATCH /api/agency/projects/:id` - Update project
- `POST /api/agency/tasks` - Create task
- `PATCH /api/agency/tasks/:id` - Update task
- `DELETE /api/agency/tasks/:id` - Delete task
- `GET /api/client/projects` - List client projects
- `GET /api/staff/tasks` - List staff tasks
- `POST /api/agency/tasks/:taskId/assign` - Assign staff
- `DELETE /api/agency/tasks/:taskId/assign/:staffProfileId` - Unassign staff
- `GET /api/client/tasks/recent` - Get recent tasks

**Invoices (7 endpoints):**
- `POST /api/invoices` - Create invoice
- `PATCH /api/invoices/:invoiceId/status` - Update status
- `GET /api/client/invoices` - List invoices
- `GET /api/client/invoices/:invoiceId` - Get invoice details
- `GET /api/invoices/:invoiceId/line-items` - Get line items
- `POST /api/invoices/:invoiceId/line-items` - Create line items

**Initiatives (8 endpoints):**
- `GET /api/agency/initiatives` - List initiatives
- `GET /api/client/initiatives` - List client initiatives
- `POST /api/initiatives` - Create initiative
- `PATCH /api/initiatives/:id` - Update initiative
- `DELETE /api/initiatives/:id` - Soft delete
- `POST /api/initiatives/:id/restore` - Restore from trash
- `GET /api/initiatives/trash` - List deleted initiatives
- `DELETE /api/initiatives/:id/permanent` - Permanent delete

**Recommendation:** These could potentially use Supabase's auto-generated REST API with Row-Level Security (RLS) policies for tenant isolation.

---

#### **Category B: Essential Business Logic - Must Remain in Express (~61 endpoints)**

These endpoints contain complex logic, external API integrations, or computations that cannot be replicated with database operations alone:

**🤖 AI & Analytics (15 endpoints):**
- `POST /api/agency/clients/:clientId/generate-recommendations` - Gemini AI analysis
- `POST /api/ai/analyze-data` - On-demand AI chat
- `POST /api/ai/request-action` - Convert AI response to initiative
- `GET /api/analytics/ga4/:clientId/*` - Google Analytics 4 data fetching
- `GET /api/analytics/gsc/:clientId/*` - Google Search Console data
- `GET /api/analytics/outcome-metrics/:clientId` - Pipeline calculations
- `POST /api/agency/clients/:clientId/sync-metrics` - Idempotent metrics sync

**🔐 OAuth & Integrations (16 endpoints):**
- `GET /api/oauth/google/initiate` - OAuth flow initiation
- `GET /api/oauth/google/callback` - OAuth callback handling
- `GET /api/integrations/ga4/:clientId/properties` - Fetch GA4 properties
- `POST /api/integrations/ga4/:clientId/property` - Save integration
- `PATCH /api/integrations/ga4/:clientId/lead-event` - Update config
- `DELETE /api/integrations/ga4/:clientId` - Disconnect
- Similar endpoints for GSC (6 endpoints)

**📄 Invoice & PDF Generation (5 endpoints):**
- `POST /api/invoices/:invoiceId/generate-pdf` - Puppeteer PDF generation
- `POST /api/initiatives/:id/generate-invoice` - Create invoice from initiative
- **Cron Job:** Monthly retainer invoice generation (not an endpoint, but essential)

**🔍 SEO Audit Tool (2 endpoints):**
- `POST /api/seo/audit` - Lighthouse audit execution
- `POST /api/seo/audit/create-initiative` - Convert audit to initiative

**👥 User Management (8 endpoints):**
- `POST /api/auth/signup` - Custom signup logic
- `POST /api/auth/login` - Custom login with multi-table joins
- `POST /api/agency/clients/create-user` - Create client user (multi-table transaction)
- `POST /api/agency/users/create` - Create staff/admin user
- `PATCH /api/agency/users/:userId/role` - Update user role
- `DELETE /api/agency/users/:userId` - Delete user (cascade logic)
- `GET /api/agency/users` - List users with profile joins

**💬 Messaging & Notifications (10 endpoints):**
- `POST /api/agency/messages/:clientId` - Send message + create notification
- `POST /api/client/messages` - Send message + create notification
- `PATCH /api/agency/messages/:id/read` - Mark read
- `GET /api/notifications/*` - Complex notification filtering
- `POST /api/notifications/mark-all-read` - Bulk update

**⚙️ Complex State Management (5 endpoints):**
- `POST /api/initiatives/:id/send` - Send to client + create notification
- `POST /api/initiatives/:id/respond` - Client response handling + notification
- `POST /api/agency/initiatives/mark-viewed` - Batch mark as viewed
- `GET /api/client/projects-with-tasks` - Complex aggregation query
- `GET /api/agency/clients/:clientId/retainer-hours` - Retainer calculations

---

### 🎯 Recommendation: Hybrid Architecture

**Keep Your Express Backend For:**
1. All AI/ML operations (Gemini API calls)
2. External API integrations (GA4, GSC, OAuth)
3. PDF generation (Puppeteer)
4. Complex business logic (invoice generation, retainer calculations)
5. Custom authentication flows (until fully migrated to Supabase Auth)
6. Messaging system with notification creation
7. SEO audit tool

**Potentially Migrate to Supabase Direct Access:**
1. Simple client/project/task CRUD (with RLS policies)
2. Basic invoice listing/viewing (non-PDF operations)
3. Objective management
4. Notification listing (read-only queries)

**Effort Savings:** By keeping your Express backend, you avoid rewriting 60+ endpoints and can focus migration efforts on auth and storage.

---

## 5. Overall Migration Summary

### 📈 Feasibility Score: **MEDIUM-HIGH (75/100)**

**Score Breakdown:**
- Database Migration: 95/100 (Excellent - fully compatible)
- Schema Portability: 100/100 (Perfect - standard PostgreSQL)
- Auth Refactoring: 60/100 (Moderate effort required)
- File Storage Migration: 80/100 (Straightforward with Supabase Storage)
- API Restructuring: 70/100 (Most logic can remain in Express)

---

### ⚠️ Primary Blockers & Risks

#### **1. Authentication System Refactoring (HIGH COMPLEXITY)**
**Risk Level:** 🔴 HIGH  
**Impact:** Affects all 96 API endpoints and every frontend page

**Challenges:**
- Replacing custom JWT logic across 8-10 files
- Migrating password hashes from `users.password` to Supabase's auth system
- Updating all frontend components that rely on `localStorage` auth state
- Ensuring zero authentication downtime during migration
- Testing all RBAC flows (Admin, Client, Staff roles)

**Mitigation:**
- Create a feature flag system to run old and new auth in parallel
- Migrate users gradually (start with test accounts)
- Implement comprehensive integration tests before production migration

---

#### **2. Data Migration & Downtime Management (MEDIUM COMPLEXITY)**
**Risk Level:** 🟡 MEDIUM  
**Impact:** Potential data loss or service interruption

**Challenges:**
- Moving production data from Neon to Supabase while maintaining referential integrity
- Coordinating database cutover with minimal downtime
- Migrating OAuth tokens (encrypted with ENCRYPTION_KEY environment variable)
- Ensuring existing PDF URLs remain accessible during storage migration

**Mitigation:**
- Perform full `pg_dump` backup before migration
- Use database replication for zero-downtime migration (if Neon supports CDC)
- Keep old Neon database active for 30 days as rollback option
- Implement URL redirects for old PDF paths

---

#### **3. Environment Variable & Configuration Changes (LOW COMPLEXITY)**
**Risk Level:** 🟢 LOW  
**Impact:** Application won't start without proper Supabase credentials

**New Environment Variables Required:**
```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ... # For client-side
SUPABASE_SERVICE_ROLE_KEY=eyJ... # For server-side admin operations

# Keep existing (still needed for Express backend)
DATABASE_URL=postgresql://... # Now pointing to Supabase
JWT_SECRET=... # Can be deprecated after full Supabase Auth migration
SESSION_SECRET=...
ENCRYPTION_KEY=... # Still needed for OAuth tokens
GEMINI_API_KEY=...
```

**Migration Checklist:**
- [ ] Update `drizzle.config.ts` with new Supabase DATABASE_URL
- [ ] Add Supabase SDK to both frontend and backend
- [ ] Configure Supabase Auth settings (email verification, password requirements)
- [ ] Set up Supabase Storage buckets
- [ ] Update deployment configuration (Replit Secrets)

---

### 🚀 Recommended First Step

**IMMEDIATE ACTION: Set Up Staging Environment**

**Step 1: Create Supabase Project**
1. Go to https://supabase.com/dashboard
2. Create new project: `agency-portal-staging`
3. Note down: Project URL, Anon Key, Service Role Key

**Step 2: Migrate Database Schema (30 minutes)**
```bash
# Update .env with Supabase DATABASE_URL
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres

# Push schema to Supabase
npx drizzle-kit push
```

**Step 3: Seed Test Data**
```bash
# Create test admin user
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@agency.com","password":"test123","fullName":"Test Admin","role":"Admin"}'
```

**Step 4: Test Core Functionality**
- [ ] Login works with test user
- [ ] Create a client
- [ ] Create a project and task
- [ ] Generate an initiative

**Step 5: Implement Supabase Storage (4 hours)**
- Refactor `PDFStorageService` to use Supabase Storage
- Test invoice PDF generation
- Verify PDF URLs are accessible

**Step 6: Parallel Auth Implementation (8-12 hours)**
- Install `@supabase/supabase-js` in both client and server
- Implement Supabase Auth alongside existing auth (feature flag)
- Test login flow with new Supabase Auth
- Compare session behavior with existing JWT system

---

## Migration Roadmap (Phased Approach)

### **Phase 1: Infrastructure Setup (Week 1)**
- [ ] Create Supabase production project
- [ ] Migrate database schema via Drizzle
- [ ] Set up Supabase Storage buckets
- [ ] Configure environment variables
- **Estimated Effort:** 8 hours

### **Phase 2: File Storage Migration (Week 1-2)**
- [ ] Refactor `PDFStorageService`
- [ ] Upload existing PDFs to Supabase Storage
- [ ] Update `invoices.pdfUrl` references
- [ ] Test PDF generation and access
- **Estimated Effort:** 6 hours

### **Phase 3: Authentication Migration (Week 2-3)**
- [ ] Implement Supabase Auth in parallel with existing auth
- [ ] Update frontend auth components
- [ ] Migrate middleware to verify Supabase JWTs
- [ ] Migrate existing users to Supabase Auth
- [ ] Test all role-based access scenarios
- **Estimated Effort:** 20 hours

### **Phase 4: Data Migration (Week 3)**
- [ ] Export production data from Neon
- [ ] Import into Supabase (with encrypted OAuth tokens)
- [ ] Verify data integrity
- [ ] Run smoke tests on all features
- **Estimated Effort:** 6 hours

### **Phase 5: Validation & Cutover (Week 4)**
- [ ] Run comprehensive integration tests
- [ ] Monitor error rates and performance
- [ ] Decommission old Neon database (after 30-day buffer)
- [ ] Remove deprecated auth code
- **Estimated Effort:** 10 hours

**Total Estimated Effort: 40-60 developer hours** (1-2 weeks for a single developer)

---

## Cost-Benefit Analysis

### **Current State (Neon + Custom Auth):**
- Monthly cost: ~$20-30/month (Neon)
- Scalability: Limited (local file storage)
- Maintenance: High (custom auth, manual backups)

### **After Supabase Migration:**
- Monthly cost: $0-25/month (free tier covers most needs)
- Scalability: High (cloud storage, auto-scaling DB)
- Maintenance: Medium (managed auth, automated backups)
- Added benefits: Built-in realtime, automatic API generation, Row-Level Security

**ROI:** Positive within 3-6 months due to reduced maintenance overhead and improved scalability.

---

## Appendix: Technical Specifications

### **Database Schema Summary**
- Total Tables: 14
- Total Indexes: 13
- Foreign Keys: 12 relationships
- JSONB Fields: 2 (observationInsights, actionTasks)
- Soft Delete Fields: 1 (deletedAt in initiatives)

### **Authentication Flow Changes**

**Current (Custom JWT):**
```
1. User submits email/password
2. Server verifies bcrypt hash
3. Server generates JWT with { userId, email, role }
4. Frontend stores JWT in localStorage
5. Every request includes `Authorization: Bearer <token>`
6. Middleware verifies JWT signature
```

**After (Supabase Auth):**
```
1. User submits email/password
2. Supabase verifies password
3. Supabase returns session with access_token + refresh_token
4. Frontend stores session in Supabase client (auto-managed)
5. Every request includes Supabase session token
6. Middleware verifies Supabase JWT + fetches role from profiles table
```

### **File Storage Changes**

**Current:**
- Location: `/public/invoices/`
- Access: Express static middleware
- Persistence: ❌ Lost on redeployment

**After:**
- Location: Supabase Storage (bucket: `invoices`)
- Access: Public URLs via CDN
- Persistence: ✅ Permanent cloud storage

---

## Conclusion

Your Agency Client Portal is **well-suited for Supabase migration** with a few areas requiring focused refactoring effort. The database schema is perfect, the business logic can remain in Express, and the main challenges are authentication and file storage - both of which have clear migration paths.

**Recommended Next Steps:**
1. Create a Supabase staging project this week
2. Migrate the database schema (1 hour)
3. Implement Supabase Storage for PDFs (4-6 hours)
4. Begin parallel auth implementation (8-12 hours)
5. Plan production cutover for 3-4 weeks from now

**Success Metrics:**
- Zero data loss during migration
- <1 hour of downtime during database cutover
- All existing features work identically post-migration
- Authentication flows fully transitioned to Supabase Auth
- All PDFs accessible from Supabase Storage

---

**Assessment Prepared By:** AI Solutions Architect  
**Date:** October 12, 2025  
**Repository:** Agency Client Portal (Full-Stack JavaScript)  
**Target Platform:** Supabase (PostgreSQL + Auth + Storage)
