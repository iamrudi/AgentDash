# Agency Client Portal

## Overview
This project is a multi-tenant agency management platform designed to streamline client relationships, project management, and task automation. It provides secure, role-based portals for clients, staff, and administrators. The platform aims to enhance agency efficiency, improve client communication, and leverage AI for insightful recommendations, ultimately fostering better client relationships and operational effectiveness with features like a "10-second health check" dashboard and data-driven client recommendations.

## User Preferences
I prefer concise and direct communication. When making changes, prioritize iterative development and provide clear explanations of the modifications. Before implementing any major architectural changes or introducing new external dependencies, please ask for approval. Ensure that all code adheres to modern JavaScript/TypeScript best practices.

## System Architecture
The platform is a full-stack JavaScript application using React for the frontend, Express.js for the backend, and PostgreSQL (managed via Supabase) as the database, with Drizzle ORM for interactions. Authentication uses JWT and bcrypt, implementing a robust Role-Based Access Control (RBAC) system for Client, Staff, and Admin roles, ensuring tenant isolation.

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
- **Authentication & Authorization**: JWT tokens, bcrypt hashing, RBAC, and tenant isolation.
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
   - `agencies` table with id, name, settings
   - `profiles.agencyId` (nullable, for Admin/Staff only)
   - `clients.agencyId` (required, foreign key)
   - Migration: "Default Agency" created, all existing data migrated

2. **Authentication Layer**:
   - JWT payload includes `agencyId` for Admin/Staff users
   - Auth middleware extracts agencyId → `req.user.agencyId`
   - Login endpoint fetches and embeds agencyId from profile

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
- ⚠️ **Security Items for Production** (not implemented yet):
  1. JWT expiration and refresh token mechanism
  2. OAuth error handling and rate limiting improvements
  3. AES-256-GCM IV reuse vulnerability fix (IV should be random per encryption, not derived from data)
  4. Multi-agency integration tests
  5. Scheduled tasks (invoices, trash cleanup) are currently global - need agency scoping decision

## External Dependencies
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: JWT, bcrypt
- **Cloud Services**: Supabase, Google Cloud (for GA4, GSC APIs)
- **OAuth Integrations**: Google OAuth (for GA4, Google Search Console)
- **AI Services**: Google Gemini AI (gemini-2.5-pro, gemini-2.5-flash)
- **SEO Auditing**: Google Lighthouse (via `lighthouse` npm package)
- **PDF Generation**: Puppeteer
- **Scheduling**: `node-cron`