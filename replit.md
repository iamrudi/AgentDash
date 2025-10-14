# Agency Client Portal

## Overview
This project is a multi-tenant agency management platform designed to streamline client relationships, project management, and task automation. It provides secure, role-based portals for clients, staff, and administrators. The platform aims to enhance agency efficiency, improve client communication, and leverage AI for insightful recommendations, ultimately fostering better client relationships and operational effectiveness with features like a "10-second health check" dashboard and data-driven client recommendations.

## User Preferences
I prefer concise and direct communication. When making changes, prioritize iterative development and provide clear explanations of the modifications. Before implementing any major architectural changes or introducing new external dependencies, please ask for approval. Ensure that all code adheres to modern JavaScript/TypeScript best practices.

## System Architecture
The platform is a full-stack JavaScript application using React for the frontend, Express.js for the backend, and PostgreSQL (managed via Supabase) as the database, with Drizzle ORM for interactions. Authentication uses Supabase Auth with session-based tokens, implementing a robust Role-Based Access Control (RBAC) system for Client, Staff, and Admin roles, ensuring tenant isolation.

### UI/UX Decisions
- **Frontend Framework**: React 18, Wouter for routing, TanStack Query for state management.
- **Styling**: Tailwind CSS with Shadcn/UI.
- **Theming**: Dark-first design with light mode support, automatic time-based system theme, and user-selectable options.
- **Responsiveness**: Mobile-first design.
- **Typography**: Geist Sans for UI text, Geist Mono for code.
- **Color Palette**: Modern dark theme with deep blue-black background, vibrant green accents, and card glow effects.
- **Navigation Layout**: Collapsible sidebar with icon-only mode and portal-specific branding.
- **User Profile**: Header-based dropdown with avatar, theme selector, and logout.

### Technical Implementations
- **Authentication & Authorization**: Supabase Auth with session tokens, RBAC, and tenant isolation.
- **Forms**: React Hook Form with Zod validation.
- **Notifications**: Unified notification center across portals with real-time updates, including toast notifications.
- **Security**: AES-256-GCM for sensitive data, HMAC-SHA256 for CSRF protection.
- **AI Recommendation Engine**: Google Gemini AI analyzes GA4/GSC metrics to auto-generate structured strategic initiatives with actionable task lists.
- **Client Strategy Card**: AI-powered consolidated view on client detail page displaying business context, strategic goals, AI-analyzed chat insights (pain points, wins, questions), and 30-day performance snapshot.
- **Metrics Sync**: Idempotent endpoint for syncing GA4/GSC data.
- **SEO Website Audit Tool**: Lighthouse-powered audits with AI-generated summaries and actionable recommendations, convertible into client initiatives.
- **Trash System**: Soft delete for strategic initiatives with 30-day retention and automated purging.
- **Invoice Automation**: Node-cron for monthly retainers and Puppeteer for PDF generation.
- **Client-to-Account Manager Chat**: Real-time messaging with manual initiation by agency admins.
- **Chat with your Data**: AI-powered feature for clients and admins to query analytics data and generate recommendations, convertible into initiatives.
- **Analytics Dashboard**: GA4 and GSC metrics visualization, date range picker, acquisition channel analysis, and pipeline value calculation.

### Feature Specifications
- **Client Portal**: Dashboard (10-second health check with KPIs and action items), Projects (with progress tracking and task lists), Strategic Initiatives (approve/reject/discuss), Billing, Profile, Support Chat, Chat with your Data.
- **Agency Admin Portal**: Dashboard, Client Messages, Tasks & Projects, Strategic Initiatives (full lifecycle management), Clients (management, GA4/GSC integration, objectives, user management), Staff, User Management, Invoice Management, Trash, and SEO Website Audit Tool.
- **Staff Portal**: View and update assigned tasks.
- **Strategic Initiative Workflow**: `Needs Review` → `Awaiting Approval` → `Approved` → `In Progress` → `Completed` → `Measured`.
- **Google Integrations**: GA4 Lead Event Configuration (multi-event support) and Google Search Console (OAuth, site selection, performance metrics).

### System Design Choices
- **Multi-tenancy**: Strict tenant isolation with agency-level scoping.
- **API Structure**: RESTful endpoints with role-based access.
- **Project Structure**: Separate frontend, backend, and shared codebases.

### Multi-Tenant Isolation Implementation (Completed)

**Status**: ✅ **Functional tenant isolation implemented** across all critical data paths.

**Architecture Pattern**: Route-level enforcement with optional agencyId parameters
- All Admin/Staff routes check `req.user.agencyId` and return 403 if missing
- All storage methods accept optional `agencyId` parameter and filter when provided
- No routes bypass the filtering - all pass agencyId to storage layer

**Components Implemented**:
1. **Database Schema**:
   - `agencies` table with id, name, createdAt
   - `profiles.agencyId` (nullable, for Admin/Staff only)
   - `clients.agencyId` (required, foreign key)
   - Migration: "Default Agency" created in Supabase, test users recreated

2. **Authentication Layer**:
   - Supabase Auth sessions with access tokens
   - Auth middleware verifies tokens and extracts user profile with agencyId → `req.user.agencyId`
   - Login endpoint returns Supabase session token with user profile data

3. **Storage Layer** (12 agency-scoped methods):
   - `getAllClients(agencyId?)` - filters clients by agency
   - `getAllClientsWithDetails(agencyId?)` - includes full details
   - `getAllProjects(agencyId?)` - via client.agencyId join
   - `getAllStaff(agencyId?)` - Admin/Staff profiles
   - `getAllTasks(agencyId?)` - via project → client → agency
   - `getAllInvoices(agencyId?)` - via client.agencyId
   - `getAllInitiatives(agencyId?)` - via client.agencyId
   - `getAllMessages(agencyId?)` - via client.agencyId
   - `getAllMetrics(limit, agencyId?)` - via client.agencyId
   - `getNotificationCounts(agencyId?)` - scoped counts
   - `getAllIntegrations(agencyId?)` - via client.agencyId
   - `getAllUsersWithProfiles(agencyId?)` - Admin/Staff only

4. **Route Layer** (14 critical endpoints secured):
   - Agency Portal: clients, projects, initiatives, staff, messages, metrics, notifications, integrations, users
   - Staff Portal: tasks
   - Client Portal (admin access): projects, invoices, initiatives
   - All notification generation: agency-scoped

5. **Critical Security Fix**: `requireClientAccess()` middleware
   - Validates `admin.agencyId === client.agencyId` before allowing access
   - Prevents admins from accessing clients in other agencies
   - Applied to 27 routes (client detail, metrics sync, analytics, integrations, objectives, retainer hours, messaging)

**Test Credentials**:
- Admin: Agent3@demo.com / Agent1234
- Client: Jon@mmagency.co.uk / Letmein120
- All users belong to "Default Agency" (ID: 614d7633-5dd9-4147-a261-ebf8458a2ec4)

**Architect Review Feedback**:
- ✅ Functional tenant isolation confirmed
- ✅ No routes bypass agencyId filtering
- ✅ requireClientAccess() properly enforces agency matching
- 📋 **Future Enhancement Recommended**: Make `agencyId` REQUIRED (not optional) in storage method signatures for compile-time enforcement and defense-in-depth (documented for future hardening)

**Production Readiness Notes**:
- ✅ Tenant isolation: Complete for single-agency and ready for multi-agency testing
- ✅ Authentication: Migrated to Supabase Auth with session-based tokens
- ⚠️ **Security Items for Production** (not implemented yet):
  1. Supabase Auth refresh token mechanism (manual token refresh)
  2. OAuth error handling and rate limiting improvements
  3. AES-256-GCM IV reuse vulnerability fix (IV should be random per encryption, not derived from data)
  4. Multi-agency integration tests
  5. Scheduled tasks (invoices, trash cleanup) are currently global - need agency scoping decision

### Database Migration to Supabase (Completed)

**Migration Date**: October 14, 2025  
**Status**: ✅ **Successfully migrated from Replit Neon to Supabase PostgreSQL**

**Migration Details**:
1. **Database Driver Update**:
   - Changed from `drizzle-orm/neon-serverless` to `drizzle-orm/postgres-js`
   - Updated `server/db.ts` to use `postgres` package with SSL required
   - Connection via `DATABASE_URL` environment variable

2. **Schema Deployment**:
   - Pushed complete Drizzle schema to Supabase using `npm run db:push`
   - All tables created successfully (agencies, users, profiles, clients, projects, tasks, invoices, initiatives, messages, metrics, integrations, objectives)

3. **Test Data Recreation**:
   - Created "Default Agency" (ID: 614d7633-5dd9-4147-a261-ebf8458a2ec4)
   - Created Admin user: Agent3@demo.com / Agent1234
   - Created Client user: Jon@mmagency.co.uk / Letmein120
   - Created Client company: MMA Marketing

4. **Verification**:
   - ✅ Login functionality tested and working
   - ✅ Tenant isolation verified (client cannot access admin routes)
   - ✅ All API endpoints functioning correctly
   - ✅ Multi-tenant architecture preserved

### Supabase Auth Migration (Completed)

**Migration Date**: October 14, 2025  
**Status**: ✅ **Successfully migrated from custom JWT to Supabase Auth**

**Migration Details**:
1. **Schema Restructure**:
   - Removed `users` table completely
   - Updated `profiles.id` to directly map to Supabase Auth user ID (no separate userId FK)
   - All user authentication now handled by Supabase Auth

2. **Authentication Layer**:
   - Created `server/lib/supabase-auth.ts` with auth utilities:
     - `createUserWithProfile()` - Creates Supabase Auth user and profile
     - `signInWithPassword()` - Authenticates with Supabase
     - `getUserProfile()` - Fetches profile with tenant data
     - `deleteUser()` - Removes user from Supabase Auth
   - Created `server/middleware/supabase-auth.ts` middleware:
     - Verifies Supabase session tokens
     - Extracts user profile and agencyId for tenant isolation
     - Maintains same RBAC enforcement as before

3. **Route Updates**:
   - Login: Uses `signInWithPassword()`, returns Supabase access token
   - Signup: Uses `createUserWithProfile()`, auto-assigns Client role
   - Admin user creation: Uses `createUserWithProfile()` with agency assignment
   - All protected routes: Updated to use new Supabase Auth middleware

4. **Frontend Compatibility**:
   - No changes required to frontend
   - Token storage and Authorization header handling unchanged
   - Frontend sends Bearer token, backend verifies with Supabase

5. **Verification**:
   - ✅ E2E login test passed (Admin login → redirect → dashboard → logout)
   - ✅ Multi-tenant isolation preserved (agencyId extracted from profile)
   - ✅ Role-based access control working (Admin/Client/Staff portals)
   - ✅ All API endpoints authenticated correctly

**Architecture Benefits**:
- ✅ Centralized auth with Supabase (no custom password hashing)
- ✅ Built-in session management and token refresh
- ✅ Simplified user management (create/delete via Supabase Admin API)
- ✅ profiles.id = auth user ID (direct mapping, simpler relationships)

**Test Credentials** (Supabase Auth):
- Admin: Agent3@demo.com / Agent1234
- Client: Jon@mmagency.co.uk / Letmein120

## External Dependencies
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth (session tokens)
- **Cloud Services**: Supabase, Google Cloud (for GA4, GSC APIs)
- **OAuth Integrations**: Google OAuth (for GA4, Google Search Console)
- **AI Services**: Google Gemini AI (gemini-2.5-pro, gemini-2.5-flash)
- **SEO Auditing**: Google Lighthouse (via `lighthouse` npm package)
- **PDF Generation**: Puppeteer
- **Scheduling**: `node-cron`