# Agency Client Portal

## Overview
The Agency Client Portal is a multi-tenant agency management platform designed to streamline client relationships, project management, and task automation. It provides secure, role-based portals for clients, staff, and administrators. The platform aims to enhance agency efficiency, improve client communication, and leverage AI for insightful recommendations, including a "10-second health check" dashboard and data-driven client recommendations, to foster better client relationships and operational effectiveness.

## User Preferences
I prefer concise and direct communication. When making changes, prioritize iterative development and provide clear explanations of the modifications. Before implementing any major architectural changes or introducing new external dependencies, please ask for approval. Ensure that all code adheres to modern JavaScript/TypeScript best practices.

## System Architecture
The platform is a full-stack JavaScript application utilizing React for the frontend, Express.js for the backend, and PostgreSQL (managed via Supabase) as the database with Drizzle ORM. Authentication relies on Supabase Auth with session-based tokens and a robust Role-Based Access Control (RBAC) system for Client, Staff, and Admin roles, ensuring strict tenant isolation.

### UI/UX Decisions
- **Frontend Framework**: React 18 with Wouter for routing and TanStack Query for state management.
- **Design System**: macOS-inspired aesthetic (Apple Blue primary color, San Francisco font, macOS standard border-radius) with Tailwind CSS and Shadcn/UI for styling, supporting dark mode and mobile-first responsiveness.
- **Icons**: Lucide React for consistent line-art styling.
- **Navigation**: Collapsible sidebar with icon-only mode and portal-specific branding.
- **Mobile Responsiveness**: 
  - Sidebar renders as Sheet overlay on mobile (<768px) with auto-close on navigation
  - Touch targets meet WCAG AA standards (44x44px minimum)
  - useIsMobile hook with lazy initialization for accurate viewport detection
  - Responsive touch-friendly navigation with proper dismissal UX

### Technical Implementations
- **Authentication & Authorization**: Supabase Auth with stateless JWT optimization, RBAC, and tenant isolation. Agency ID and role stored in secure `app_metadata` (immutable by users). OAuth race condition resolved at root cause via stateless authentication - agencyId always available in token. AuthProvider `authReady` flag provides additional safety layer. Backward compatible fallback to profile table for legacy users.
- **Row-Level Security (RLS)**: Database-level tenant isolation using Postgres RLS policies and a `auth.get_agency_id()` helper.
- **Forms**: React Hook Form with Zod validation.
- **Notifications**: Unified notification center with real-time updates and toast notifications.
- **Security**: AES-256-GCM for sensitive data, HMAC-SHA256 for CSRF protection.
- **OAuth Reliability**: Production-ready error handling, reserve-and-release rate limiting, and retry logic with exponential backoff for Google API calls. Context-aware OAuth redirects with secure `returnTo` validation (prevents open redirect vulnerabilities).
- **AI Recommendation Engine**: Preset-driven system with pluggable AI provider architecture (OpenAI or Gemini) for strategic initiatives and task lists based on real-time connection status, competitor analysis, HubSpot CRM data, and LinkedIn social metrics. Agency-level provider preference stored in database with in-app settings UI toggle. Falls back to AI_PROVIDER environment variable if not set. Provider selection cached per agency for performance. Automatically incorporates HubSpot contacts, deals, and companies data plus LinkedIn engagement metrics when configured.
- **Client Strategy Card**: AI-powered consolidated client view.
- **Metrics Sync**: Idempotent endpoint for syncing GA4/GSC data with bidirectional lead events sync between client.leadEvents and integration.ga4LeadEventName to ensure conversion tracking works correctly across all update paths.
- **Trash System**: Soft delete for strategic initiatives with 30-day retention.
- **Invoice Automation**: Node-cron for retainers and Puppeteer for PDF generation.
- **Proposal PDF Export**: Secure browser-native PDF printing with short-lived token system (64-char hex, 5-minute TTL, single-use), tenant isolation validation, and token masking in logs.
- **Client-to-Account Manager Chat**: Real-time messaging with Server-Sent Events (SSE), multi-tenant filtering, and AI-powered conversation analysis.
- **Chat with your Data**: AI-powered analytics data querying and recommendation generation.
- **Analytics Dashboard**: GA4 and GSC metrics visualization.
- **Performance Optimizations**: Server-side caching (in-memory, 1-hour TTL), aggregated API endpoints, frontend query optimization, table virtualization (`@tanstack/react-virtual`), code splitting, component memoization, and hover-based prefetching.
- **Developer Tools**: In-memory runtime rate limiter toggle for testing and debugging.

### Feature Specifications
- **Client Portal**: Dashboard, Projects, Strategic Initiatives, Billing, Profile, Support Chat, Chat with your Data.
- **Agency Admin Portal**: Management for Clients, Staff, Tasks & Projects, Strategic Initiatives, Invoices, User Management, Trash, and AI Provider Settings. Full CRM system available at agency level for managing Companies, Contacts, Deals, Forms, and Proposals.
- **Staff Portal**: View and update assigned tasks.
- **Strategic Initiative Workflow**: A defined lifecycle from `Needs Review` to `Measured`.
- **Google Integrations**: GA4 Lead Event Configuration and Google Search Console.
- **HubSpot Integration**: Agency-wide CRM integration for contacts, deals, and companies data. Enriches AI recommendations with real-time CRM insights for sales pipeline analysis, lead nurturing, and conversion optimization.
- **LinkedIn Integration**: Agency-wide social media integration for organization page metrics and post engagement data. Enriches AI recommendations with social selling strategies, thought leadership insights, and professional network growth tactics.
- **CRM System**: Full-featured Customer Relationship Management with Companies, Contacts, and Deals modules at agency level, including CRUD operations and multi-layer tenant isolation.
- **Form Creator**: Lead capture form builder with drag-and-drop fields, public endpoints for submissions, auto-creation of CRM records, honeypot bot detection, embed options, API documentation, and automatic production URL adaptation (uses VITE_PUBLIC_URL env variable or falls back to current domain).
- **AI-Powered Proposal Builder**: Professional proposal creation tool with reusable templates, AI content generation (Gemini AI), merge tags, Markdown support, integration with CRM deals, workflow states, and secure PDF export.

### System Design Choices
- **Multi-tenancy**: Achieved through a three-layer approach: Application Layer middleware, Database Layer (Postgres RLS), and Resource-Level Protection on routes.
- **API Structure**: RESTful endpoints with role-based access.
- **Project Structure**: Separate frontend, backend, and shared codebases.
- **Production Readiness**: All critical security issues resolved, including tenant isolation middleware, staff authorization fixes, and robust JWT secret security.

## External Dependencies
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth
- **Cloud Services**: Supabase, Google Cloud (for GA4, GSC APIs)
- **OAuth Integrations**: Google OAuth (for GA4, Google Search Console), HubSpot (CRM data integration via API token), LinkedIn (social media metrics via API token)
- **AI Services**: Pluggable AI provider system supporting:
  - Google Gemini AI (gemini-2.5-pro, gemini-2.5-flash) - Default
  - OpenAI (gpt-4o, gpt-4o-mini)
  - Configured per-agency via Settings UI or globally via `AI_PROVIDER` environment variable (values: "gemini" or "openai")
  - Agency preferences stored in `agency_settings` table with cache invalidation
- **PDF Generation**: Puppeteer
- **Scheduling**: `node-cron`