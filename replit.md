# Agency Client Portal

## Overview
This project is a multi-tenant agency management platform designed to streamline client relationships, project management, and task automation. It provides secure, role-based portals for clients, staff, and administrators. The platform aims to enhance agency efficiency, improve client communication, and leverage AI for insightful recommendations, ultimately fostering better client relationships and operational effectiveness with features like a "10-second health check" dashboard and data-driven client recommendations.

## User Preferences
I prefer concise and direct communication. When making changes, prioritize iterative development and provide clear explanations of the modifications. Before implementing any major architectural changes or introducing new external dependencies, please ask for approval. Ensure that all code adheres to modern JavaScript/TypeScript best practices.

## System Architecture
The platform is a full-stack JavaScript application using React for the frontend, Express.js for the backend, and PostgreSQL (managed via Supabase) as the database, with Drizzle ORM for interactions. Authentication uses Supabase Auth with session-based tokens, implementing a robust Role-Based Access Control (RBAC) system for Client, Staff, and Admin roles, ensuring strict tenant isolation.

### UI/UX Decisions
- **Frontend Framework**: React 18, Wouter for routing, TanStack Query for state management.
- **Styling**: Tailwind CSS with Shadcn/UI, dark-first design with light mode support, and mobile-first responsiveness.
- **Typography**: Geist Sans for UI text, Geist Mono for code.
- **Navigation**: Collapsible sidebar with icon-only mode and portal-specific branding.

### Technical Implementations
- **Authentication & Authorization**: Supabase Auth with session tokens, RBAC, and tenant isolation, including automatic token refresh.
- **Forms**: React Hook Form with Zod validation.
- **Notifications**: Unified notification center with real-time updates and toast notifications.
- **Security**: AES-256-GCM for sensitive data, HMAC-SHA256 for CSRF protection.
- **OAuth Reliability (GA4/GSC)**: Production-ready error handling with user-friendly messages, reserve-and-release rate limiting (per-client hourly/daily quotas preventing concurrent bypass), and retry logic with exponential backoff (3 attempts: 1s→2s→4s delays). All Google API calls use centralized `withRateLimitAndRetry` helper ensuring consistent error parsing, quota enforcement, and transient failure recovery.
- **AI Recommendation Engine**: Google Gemini AI analyzes GA4/GSC metrics to generate strategic initiatives and task lists.
- **Client Strategy Card**: AI-powered consolidated client view with business context, goals, chat insights, and performance.
- **Metrics Sync**: Idempotent endpoint for syncing GA4/GSC data.
- **SEO Website Audit Tool**: Lighthouse-powered audits with AI summaries and actionable recommendations.
- **Trash System**: Soft delete for strategic initiatives with 30-day retention.
- **Invoice Automation**: Node-cron for retainers and Puppeteer for PDF generation.
- **Client-to-Account Manager Chat**: Real-time messaging initiated by agency admins.
- **Chat with your Data**: AI-powered analytics data querying and recommendation generation.
- **Analytics Dashboard**: GA4 and GSC metrics visualization, acquisition channel analysis, and pipeline value calculation.

### Feature Specifications
- **Client Portal**: Dashboard (KPIs, action items), Projects, Strategic Initiatives (approve/reject/discuss), Billing, Profile, Support Chat, Chat with your Data.
- **Agency Admin Portal**: Comprehensive management for Clients, Staff, Tasks & Projects, Strategic Initiatives, Invoices, User Management, Trash, and SEO Website Audit Tool.
- **Staff Portal**: View and update assigned tasks.
- **Strategic Initiative Workflow**: `Needs Review` → `Awaiting Approval` → `Approved` → `In Progress` → `Completed` → `Measured`.
- **Google Integrations**: GA4 Lead Event Configuration and Google Search Console (OAuth, site selection, performance metrics).

### System Design Choices
- **Multi-tenancy**: Strict tenant isolation enforced at the route and storage layers, with `req.user.agencyId` used for all data filtering. `requireClientAccess()` middleware prevents cross-agency access.
- **API Structure**: RESTful endpoints with role-based access.
- **Project Structure**: Separate frontend, backend, and shared codebases.

## External Dependencies
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth
- **Cloud Services**: Supabase, Google Cloud (for GA4, GSC APIs)
- **OAuth Integrations**: Google OAuth (for GA4, Google Search Console)
- **AI Services**: Google Gemini AI (gemini-2.5-pro, gemini-2.5-flash)
- **SEO Auditing**: Google Lighthouse
- **PDF Generation**: Puppeteer
- **Scheduling**: `node-cron`