# Agency Client Portal

## Overview
This project is a multi-tenant agency management platform designed to streamline client relationships, project management, and task automation. It provides secure, role-based portals for clients, staff, and administrators. The platform aims to enhance agency efficiency, improve client communication, and leverage AI for insightful recommendations, ultimately fostering better client relationships and operational effectiveness.

## User Preferences
I prefer concise and direct communication. When making changes, prioritize iterative development and provide clear explanations of the modifications. Before implementing any major architectural changes or introducing new external dependencies, please ask for approval. Ensure that all code adheres to modern JavaScript/TypeScript best practices.

## System Architecture
The platform is a full-stack JavaScript application using React for the frontend, Express.js for the backend, and PostgreSQL (managed via Supabase) as the database, with Drizzle ORM for interactions. Authentication uses JWT and bcrypt, implementing a robust Role-Based Access Control (RBAC) system for Client, Staff, and Admin roles, ensuring tenant isolation.

### UI/UX Decisions
- **Frontend Framework**: React 18
- **Routing**: Wouter
- **State Management**: TanStack Query
- **Styling**: Tailwind CSS with Shadcn/UI
- **Theming**: Full dark mode support, system preference detection
- **Responsiveness**: Mobile-first design
- **Typography**: Inter font family
- **Primary Color**: Professional Blue (HSL 221 83% 53%)

### Technical Implementations
- **Authentication**: JWT tokens, bcrypt hashing, no role self-selection on signup.
- **Authorization**: Role-based access control, tenant isolation.
- **Forms**: React Hook Form with Zod validation.
- **Notifications**: Toast notifications, real-time notification badges.
- **Data Fetching**: Real-time with TanStack Query.
- **Security**: AES-256-GCM encryption for sensitive OAuth tokens, HMAC-SHA256 for CSRF protection.
- **Multi-Event GA4 Tracking**: Supports comma-separated GA4 event names for conversion tracking with OR filter logic.
- **Invoice Automation**: Node-cron scheduler for monthly retainers, Puppeteer for PDF generation.

### Feature Specifications
- **Client Portal**: Dashboard, Projects, Strategic Initiatives (approve/reject/discuss), Billing, Profile, Support Chat.
- **Agency Admin Portal**: Dashboard, Client Messages, Tasks & Projects, Strategic Initiatives (draft, send, manage client responses, track impact), Clients (management, GA4/GSC integration, objectives, user management), Staff (assignments). Includes user management and invoice management (create, view, update, PDF generation, automated monthly retainers, on-demand from initiatives).
- **Staff Portal**: View assigned tasks, update status, prioritize.
- **Strategic Initiative Workflow**: Needs Review → Awaiting Approval → Approved → In Progress → Completed → Measured.
- **Client-to-Account Manager Chat System**: Real-time messaging.
- **Analytics Dashboard**: GA4 and GSC metrics visualization (Recharts), date range picker with comparison, acquisition channels visualization.
- **GA4 Lead Event Configuration**: Admins configure GA4 lead event names (single or multiple comma-separated) for accurate conversion tracking and pipeline value calculation.
- **Google Search Console Integration**: OAuth for GSC, site selection, and performance metrics.
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
- **PDF Generation**: Puppeteer (requires Chromium system package)
- **Scheduling**: node-cron