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
- **Multi-tenancy**: Strict tenant isolation.
- **API Structure**: RESTful endpoints with role-based access.
- **Project Structure**: Separate frontend, backend, and shared codebases.

## External Dependencies
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: JWT, bcrypt
- **Cloud Services**: Supabase, Google Cloud (for GA4, GSC APIs)
- **OAuth Integrations**: Google OAuth (for GA4, Google Search Console)
- **AI Services**: Google Gemini AI (gemini-2.5-pro, gemini-2.5-flash)
- **SEO Auditing**: Google Lighthouse (via `lighthouse` npm package)
- **PDF Generation**: Puppeteer
- **Scheduling**: `node-cron`