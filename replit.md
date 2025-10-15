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

### Technical Implementations
- **Authentication & Authorization**: Supabase Auth, RBAC, tenant isolation, and automatic token refresh. Agency ID is stored in secure JWT `app_metadata`.
- **Row-Level Security (RLS)**: Database-level tenant isolation using Postgres RLS policies and a `auth.get_agency_id()` helper.
- **Forms**: React Hook Form with Zod validation.
- **Notifications**: Unified notification center with real-time updates and toast notifications.
- **Security**: AES-256-GCM for sensitive data, HMAC-SHA256 for CSRF protection.
- **OAuth Reliability**: Production-ready error handling, reserve-and-release rate limiting, and retry logic with exponential backoff for Google API calls.
- **AI Recommendation Engine**: Preset-driven system utilizing Google Gemini AI for strategic initiatives and task lists based on real-time connection status and competitor analysis.
- **Client Strategy Card**: AI-powered consolidated client view.
- **Metrics Sync**: Idempotent endpoint for syncing GA4/GSC data.
- **SEO Website Audit Tool**: Lighthouse-powered audits with AI summaries and recommendations.
- **Trash System**: Soft delete for strategic initiatives with 30-day retention.
- **Invoice Automation**: Node-cron for retainers and Puppeteer for PDF generation.
- **Proposal PDF Export**: Secure browser-native PDF printing with short-lived token system (64-char hex, 5-minute TTL, single-use), tenant isolation validation, and token masking in logs.
- **Client-to-Account Manager Chat**: Real-time messaging with Server-Sent Events (SSE), multi-tenant filtering, and AI-powered conversation analysis.
- **Chat with your Data**: AI-powered analytics data querying and recommendation generation.
- **Analytics Dashboard**: GA4 and GSC metrics visualization.
- **Content Co-pilot**: AI-powered content creation using Data for SEO API and Gemini AI for ideas, briefs, and optimization.
- **Performance Optimizations**: Server-side caching (in-memory, 1-hour TTL), aggregated API endpoints, frontend query optimization, table virtualization (`@tanstack/react-virtual`), code splitting, component memoization, and hover-based prefetching.
- **Developer Tools**: In-memory runtime rate limiter toggle for testing and debugging.

### Feature Specifications
- **Client Portal**: Dashboard, Projects, Strategic Initiatives, Billing, Profile, Support Chat, Chat with your Data.
- **Agency Admin Portal**: Management for Clients, Staff, Tasks & Projects, Strategic Initiatives, Invoices, User Management, Trash, SEO Website Audit Tool, Content Co-pilot, and CRM.
- **Staff Portal**: View and update assigned tasks.
- **Strategic Initiative Workflow**: A defined lifecycle from `Needs Review` to `Measured`.
- **Google Integrations**: GA4 Lead Event Configuration and Google Search Console.
- **SEO Integrations**: Data for SEO API.
- **CRM System**: Full-featured Customer Relationship Management with Companies, Contacts, and Deals modules, including CRUD operations and multi-layer tenant isolation.
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
- **OAuth Integrations**: Google OAuth (for GA4, Google Search Console)
- **AI Services**: Google Gemini AI (gemini-2.5-pro, gemini-2.5-flash)
- **SEO APIs**: Data for SEO API
- **SEO Auditing**: Google Lighthouse
- **PDF Generation**: Puppeteer
- **Scheduling**: `node-cron`