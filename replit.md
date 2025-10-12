# Agency Client Portal

## Overview
This project is a multi-tenant agency management platform designed to streamline client relationships, project management, and task automation. It provides secure, role-based portals for clients, staff, and administrators. The platform aims to enhance agency efficiency, improve client communication, and leverage AI for insightful recommendations, ultimately fostering better client relationships and operational effectiveness.

## Recent Updates
- **SEO Website Audit Tool (Oct 12, 2025)**: Added comprehensive SEO audit tool for agency admins powered by Google Lighthouse and AI. Admins can enter any URL to receive detailed audit results covering SEO, performance, accessibility, and best practices. Features AI-generated summary and top 5 actionable recommendations using Gemini 2.5-flash. Integrated into agency sidebar with dedicated `/agency/seo-audit` page.
- **Trash System for Initiatives (Oct 12, 2025)**: Implemented soft delete system for strategic initiatives. Deleted initiatives are moved to trash with 30-day retention period before automatic permanent deletion. Admins can restore or manually delete items from trash. Automated cleanup runs daily at 2:00 AM.
- **GSC Data Display Fix (Oct 12, 2025)**: Fixed Google Search Console metrics not displaying in Agency Portal Dashboard. The issue was a data structure mismatch where the code tried to access GA4-style `metricValues` arrays instead of GSC's direct properties (`clicks`, `impressions`, `ctr`, `position`). Fixed in both `agency-dashboard.tsx` and `agency/index.tsx`. CTR is now correctly calculated as `(totalClicks / totalImpressions) * 100` to ensure accurate weighted average.
- **Chat with your Data UI Enhancement (Oct 12, 2025)**: Converted "Chat with your Data" from popup Dialog modal to right-hand Sheet sidebar for improved UX. Sidebar slides in from the right, full width on mobile (max-w-2xl on desktop), with scrollable content.

## User Preferences
I prefer concise and direct communication. When making changes, prioritize iterative development and provide clear explanations of the modifications. Before implementing any major architectural changes or introducing new external dependencies, please ask for approval. Ensure that all code adheres to modern JavaScript/TypeScript best practices.

## System Architecture
The platform is a full-stack JavaScript application using React for the frontend, Express.js for the backend, and PostgreSQL (managed via Supabase) as the database, with Drizzle ORM for interactions. Authentication uses JWT and bcrypt, implementing a robust Role-Based Access Control (RBAC) system for Client, Staff, and Admin roles, ensuring tenant isolation.

### UI/UX Decisions
- **Frontend Framework**: React 18
- **Routing**: Wouter
- **State Management**: TanStack Query
- **Styling**: Tailwind CSS with Shadcn/UI
- **Theming**: Dark-first design with light mode support, automatic time-based system theme (6 AM-6 PM = light, otherwise dark), theme switcher in user profile dropdown with Light/Dark/System options
- **Responsiveness**: Mobile-first design
- **Typography**: Geist Sans for UI text, Geist Mono for code
- **Primary Color**: Vibrant Green (HSL 150 76% 42%)
- **Color Palette**: Modern dark theme with deep blue-black background (HSL 224 71% 4%), subtle green accents, card glow effects on hover
- **Navigation Layout**: Collapsible sidebar with icon-only mode (Cmd/Ctrl + B shortcut), "mmagency" branding with portal-specific badge below (Client Portal/Agency Portal)
- **User Profile**: Header-based profile dropdown with avatar (user initials), displays name/email, profile link, theme selector submenu, and logout option

### Technical Implementations
- **Authentication**: JWT tokens, bcrypt hashing, no role self-selection on signup.
- **Authorization**: Role-based access control, tenant isolation.
- **Forms**: React Hook Form with Zod validation.
- **Notifications**: Toast notifications, real-time notification badges.
- **Data Fetching**: Real-time with TanStack Query.
- **Security**: AES-256-GCM encryption for sensitive OAuth tokens, HMAC-SHA256 for CSRF protection.
- **Multi-Event GA4 Tracking**: Supports comma-separated GA4 event names for conversion tracking with OR filter logic.
- **Invoice Automation**: Node-cron scheduler for monthly retainers, Puppeteer for PDF generation.
- **AI Recommendation Engine**: Google Gemini AI (gemini-2.5-pro) analyzes client GA4/GSC metrics to auto-generate strategic initiatives. Properly separates GA4 paid channel data (sessions, conversions, spend) from GSC organic search data (clicks, impressions, avgPosition) to ensure accurate AI analysis. Validates that at least one integration (GA4 or GSC) is connected before generating recommendations.
- **Metrics Sync Endpoint**: POST `/api/agency/clients/:clientId/sync-metrics` endpoint fetches latest analytics data from GA4/GSC APIs and stores in database. Implements idempotency using date-range deletion (via Drizzle gte/lte helpers) before inserting new metrics to prevent duplicates on repeated syncs.
- **SEO Website Audit Tool**: Lighthouse-powered SEO audits with AI-generated insights. Analyzes SEO, performance, accessibility, and best practices. Uses Puppeteer + Lighthouse for comprehensive audits and Gemini 2.5-flash for actionable recommendations. Admin-only via POST `/api/seo/audit` endpoint.
- **Trash System**: Soft delete functionality for strategic initiatives. Deleted items stored with `deletedAt` timestamp, retained for 30 days before automatic permanent deletion. Daily cron job (2:00 AM) purges items older than 30 days. Admins can restore or manually delete from trash view.

### Feature Specifications
- **Client Portal**: Dashboard, Projects, Strategic Initiatives (approve/reject/discuss), Billing, Profile, Support Chat, Chat with your Data AI assistant.
- **Agency Admin Portal**: Dashboard, Client Messages, Tasks & Projects, Strategic Initiatives (draft, send, manage client responses, track impact), Clients (management, GA4/GSC integration, objectives, user management), Staff (assignments). Includes user management, invoice management (create, view, update, PDF generation, automated monthly retainers, on-demand from initiatives), Trash (soft-deleted initiatives with 30-day retention), and SEO Website Audit Tool (Lighthouse-powered audits with AI insights).
- **Staff Portal**: View assigned tasks, update status, prioritize.
- **Strategic Initiative Workflow**: Needs Review → Awaiting Approval → Approved → In Progress → Completed → Measured.
- **Client-to-Account Manager Chat System**: Real-time messaging.
- **Chat with your Data**: AI-powered feature allowing both clients and admins to ask questions about analytics data and generate strategic recommendations. Uses Gemini 2.5-flash for cost-effective analysis.
  - **Client Workflow**: Client asks question → AI generates recommendation → Client clicks "Request Action" → Creates initiative with status "Needs Review" for agency approval
  - **Admin Workflow**: Admin asks question → AI generates recommendation → Admin clicks "Request Action" → Creates initiative with status "Draft" → Admin can edit/review → Admin sends to client → Status changes to "Awaiting Approval" for client response
- **Analytics Dashboard**: GA4 and GSC metrics visualization (Recharts), date range picker with comparison, acquisition channels visualization.
- **GA4 Lead Event Configuration**: Admins configure GA4 lead event names (single or multiple comma-separated) for accurate conversion tracking and pipeline value calculation.
- **Google Search Console Integration**: OAuth for GSC, site selection, and performance metrics. GSC API returns data with structure `{rows: [{keys: string[], clicks: number, impressions: number, ctr: number, position: number}]}` - dashboard aggregates using direct property access (not GA4-style metricValues).
- **Pipeline Value Calculation**: Based on GA4 conversions and Lead Value, with a fallback to a legacy formula.

### System Design Choices
- **Multi-tenancy**: Strict tenant isolation at database and API levels.
- **API Structure**: RESTful endpoints with role-based access.
- **Project Structure**: Separate client (frontend), server (backend), and shared codebases.

## External Dependencies
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: JWT, bcrypt
- **Cloud Services**: Supabase, Google Cloud (for GA4, GSC APIs)
- **OAuth Integrations**: Google OAuth (for GA4, Google Search Console)
- **AI Services**: Google Gemini AI (gemini-2.5-pro for strategic recommendations, gemini-2.5-flash for SEO audit summaries and chat)
- **SEO Auditing**: Google Lighthouse (via lighthouse npm package)
- **PDF Generation**: Puppeteer (requires Chromium system package)
- **Scheduling**: node-cron (invoice automation at 9:00 AM daily, trash cleanup at 2:00 AM daily)