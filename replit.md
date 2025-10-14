# Agency Client Portal

## Overview
This project is a multi-tenant agency management platform designed to streamline client relationships, project management, and task automation. It provides secure, role-based portals for clients, staff, and administrators. The platform aims to enhance agency efficiency, improve client communication, and leverage AI for insightful recommendations, ultimately fostering better client relationships and operational effectiveness with features like a "10-second health check" dashboard and data-driven client recommendations.

## User Preferences
I prefer concise and direct communication. When making changes, prioritize iterative development and provide clear explanations of the modifications. Before implementing any major architectural changes or introducing new external dependencies, please ask for approval. Ensure that all code adheres to modern JavaScript/TypeScript best practices.

## System Architecture
The platform is a full-stack JavaScript application using React for the frontend, Express.js for the backend, and PostgreSQL (managed via Supabase) as the database, with Drizzle ORM for interactions. Authentication uses Supabase Auth with session-based tokens, implementing a robust Role-Based Access Control (RBAC) system for Client, Staff, and Admin roles, ensuring strict tenant isolation.

### UI/UX Decisions
- **Frontend Framework**: React 18, Wouter for routing, TanStack Query for state management.
- **Design System**: macOS-inspired design language with Apple's refined aesthetics (October 2025)
  - **Primary Color**: Apple Blue (#0a84ff / HSL 210 100% 52%)
  - **Typography**: San Francisco system font stack (-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto)
  - **Border Radius**: macOS standards (4px/8px/12px for small/medium/large)
  - **Color Palette**: Semantic macOS colors (Indigo secondary, Orange accent, Red destructive)
- **Styling**: Tailwind CSS with Shadcn/UI, dark mode with light mode support (Tailwind dark class strategy), mobile-first responsiveness.
- **Icons**: Lucide React for consistent line-art style matching macOS aesthetic.
- **Navigation**: Collapsible sidebar with icon-only mode and portal-specific branding.

### Technical Implementations
- **Authentication & Authorization**: Supabase Auth with session tokens, RBAC, and tenant isolation, including automatic token refresh. Agency ID stored in secure JWT `app_metadata` (immutable by users).
- **Row-Level Security (RLS)**: Database-level tenant isolation with Postgres RLS policies on all 14 tables. Defense-in-depth security using `auth.get_agency_id()` helper function extracting agency context from JWT.
- **Forms**: React Hook Form with Zod validation.
- **Notifications**: Unified notification center with real-time updates and toast notifications.
- **Security**: AES-256-GCM for sensitive data, HMAC-SHA256 for CSRF protection, RLS for database-level access control.
- **OAuth Reliability (GA4/GSC)**: Production-ready error handling with user-friendly messages, reserve-and-release rate limiting (per-client hourly/daily quotas preventing concurrent bypass), and retry logic with exponential backoff (3 attempts: 1s→2s→4s delays). All Google API calls use centralized `withRateLimitAndRetry` helper ensuring consistent error parsing, quota enforcement, and transient failure recovery.
- **AI Recommendation Engine**: Google Gemini AI analyzes GA4/GSC metrics to generate strategic initiatives and task lists.
- **Client Strategy Card**: AI-powered consolidated client view with business context, goals, chat insights, and performance.
- **Metrics Sync**: Idempotent endpoint for syncing GA4/GSC data.
- **SEO Website Audit Tool**: Lighthouse-powered audits with AI summaries and actionable recommendations.
- **Trash System**: Soft delete for strategic initiatives with 30-day retention.
- **Invoice Automation**: Node-cron for retainers and Puppeteer for PDF generation.
- **Client-to-Account Manager Chat**: Real-time messaging with Server-Sent Events (SSE) for instant message delivery across browser tabs. Features include "Start New Chat" dialog for quick client selection, token-based auth via query params (EventSource limitation), multi-tenant filtering, browser auto-reconnect on connection loss, and AI-powered conversation analysis.
- **Chat with your Data**: AI-powered analytics data querying and recommendation generation.
- **Analytics Dashboard**: GA4 and GSC metrics visualization, acquisition channel analysis, and pipeline value calculation.
- **Content Co-pilot**: AI-powered content creation tool using Data for SEO API (keyword research, content gap analysis) and Gemini AI to generate content ideas, comprehensive briefs, and optimization suggestions. Credentials stored encrypted in clientIntegrations table with AES-256-GCM.

### Feature Specifications
- **Client Portal**: Dashboard (KPIs, action items), Projects, Strategic Initiatives (approve/reject/discuss), Billing, Profile, Support Chat, Chat with your Data.
- **Agency Admin Portal**: Comprehensive management for Clients, Staff, Tasks & Projects, Strategic Initiatives, Invoices, User Management, Trash, SEO Website Audit Tool, and Content Co-pilot.
- **Staff Portal**: View and update assigned tasks.
- **Strategic Initiative Workflow**: `Needs Review` → `Awaiting Approval` → `Approved` → `In Progress` → `Completed` → `Measured`.
- **Google Integrations**: GA4 Lead Event Configuration and Google Search Console (OAuth, site selection, performance metrics).
- **SEO Integrations**: Data for SEO API (credential-based auth, stored encrypted in clientIntegrations table).

### System Design Choices
- **Multi-tenancy**: Defense-in-depth tenant isolation with three layers:
  - **Application Layer**: Route middleware (`requireAuth`, `requireClientAccess`, `requireProjectAccess`, `requireTaskAccess`, `requireInitiativeAccess`, `requireInvoiceAccess`) and storage filtering by `req.user.agencyId`
  - **Database Layer**: Postgres Row-Level Security (RLS) policies on all tables using JWT `app_metadata.agency_id`
  - **Resource-Level Protection**: Tenant isolation middleware on all routes accepting projectId/taskId/initiativeId/invoiceId to prevent cross-agency access
  - Protection against application bugs, direct database access, and compromised service keys
- **API Structure**: RESTful endpoints with role-based access.
- **Project Structure**: Separate frontend, backend, and shared codebases.

### Production Readiness & Security (October 2025)
**Status**: ✅ Production-Ready (All critical security issues resolved)

**Security Fixes Implemented:**
1. **Tenant Isolation Middleware** - Added resource-level protection to 15+ routes:
   - `requireProjectAccess(storage)` - Verifies user owns project via client ownership
   - `requireTaskAccess(storage)` - Verifies user owns task via project → client chain
   - `requireInitiativeAccess(storage)` - Verifies user owns initiative via client
   - `requireInvoiceAccess(storage)` - Verifies user owns invoice via client
   - Protected routes: `/api/agency/projects/:id`, `/api/agency/tasks/:id`, `/api/initiatives/:id/*`, `/api/invoices/:invoiceId/*`

2. **Staff Authorization** - Fixed staff access denial:
   - Staff users now have agency-scoped read access to clients
   - `verifyClientAccess` updated to allow staff agency-scoped access
   - Staff cannot access clients from other agencies

3. **JWT Secret Security** - Fixed shared secret vulnerability:
   - `JWT_SECRET` now required separate from `SESSION_SECRET` in production
   - Runtime check blocks production startup if `JWT_SECRET` not set
   - Development fallback with warning if `JWT_SECRET` missing

**Deployment Documentation**: See `PRODUCTION_DEPLOYMENT.md` for complete deployment checklist, environment variables, security validation steps, and troubleshooting guide.

## External Dependencies
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth
- **Cloud Services**: Supabase, Google Cloud (for GA4, GSC APIs)
- **OAuth Integrations**: Google OAuth (for GA4, Google Search Console)
- **AI Services**: Google Gemini AI (gemini-2.5-pro, gemini-2.5-flash)
- **SEO APIs**: Data for SEO API (keyword research, content gap analysis, competitor analysis)
- **SEO Auditing**: Google Lighthouse
- **PDF Generation**: Puppeteer
- **Scheduling**: `node-cron`