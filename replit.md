# Agency Client Portal

## Overview

This project is a multi-tenant agency management platform designed to streamline client relationships, project management, and task automation. It provides distinct, secure, role-based portals for clients, staff, and administrators. The platform aims to enhance agency efficiency, improve client communication, and leverage AI for insightful recommendations, ultimately fostering better client relationships and operational effectiveness.

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
- **Notifications**: Toast notifications, real-time notification badges across portals (client, agency admin, staff) with auto-refresh.
- **Data Fetching**: Real-time with TanStack Query.
- **Security**: AES-256-GCM encryption for sensitive OAuth tokens, HMAC-SHA256 for CSRF protection.

### Feature Specifications
- **Client Portal**: Dashboard, Projects, Strategic Initiatives (approve/reject/discuss), Billing, Profile, Support Chat.
- **Agency Admin Portal**: Dashboard, Client Messages (reply, task creation), Tasks & Projects (all clients), Strategic Initiatives (draft, send, manage client responses, track impact), Clients (management, GA4/GSC integration, objectives, user management), Staff (assignments).
  - **User Management**: Create/edit/delete users (clients, staff, admin), manage roles.
  - **Invoice Management**: Create, view, update status, generate PDFs for invoices; automated monthly retainer invoicing, on-demand invoicing from approved initiatives.
  - **Manual Initiative Creation**: Admins can manually create and send initiatives with client filtering.
- **Staff Portal**: View assigned tasks, update status, prioritize.
- **Strategic Initiative Workflow**: Needs Review → Awaiting Approval → Approved → In Progress → Completed → Measured.
- **Client-to-Account Manager Chat System**: Real-time messaging.

### System Design Choices
- **Multi-tenancy**: Strict tenant isolation at database and API levels.
- **API Structure**: RESTful endpoints with role-based access.
- **Project Structure**: Separate client (frontend), server (backend), and shared codebases.
- **Invoice Automation**: Node-cron scheduler for monthly retainers, Puppeteer for PDF generation, local file system for PDF storage.

## External Dependencies

- **Database**: PostgreSQL (via Supabase)
- **Authentication**: JWT, bcrypt
- **Cloud Services**: Supabase
- **OAuth Integrations**: Google OAuth (for GA4 integration)
- **PDF Generation**: Puppeteer (requires Chromium system package)
- **Scheduling**: node-cron

## Recent Changes

### 2025-10-10: Strategic Initiatives System Transformation
**Evolved from Recommendations to Strategic Initiatives**
- Database migration: Renamed `recommendations` table to `initiatives` with backward compatibility
- Added impact measurement fields: triggerMetric, baselineValue, startDate, implementationDate, measuredImprovement
- Added initiativeId foreign key to tasks table for linking tasks to strategic initiatives
- Updated status workflow: Needs Review → Awaiting Approval → Approved → In Progress → Completed → Measured
- Backend API migration: All `/api/recommendations/*` endpoints renamed to `/api/initiatives/*`
- Frontend updates: Agency and Client portals now use initiatives API endpoints
- Invoice generation: Seamlessly works with approved initiatives (no changes needed)
- Storage layer: All recommendation methods renamed to initiative methods for consistency

**Technical Architecture**
- One initiative → Many tasks relationship via initiativeId
- Impact tracking: Baseline metrics → Implementation → Measured improvement
- Maintains full compatibility with existing invoice system
- Database schema uses ALTER TABLE for safe data preservation

### 2025-10-10: Frictionless Invoicing System
**Automated Invoice Generation & PDF Creation**
- Monthly retainer invoicing via node-cron scheduler (runs daily at 9:00 AM)
- On-demand invoice generation from approved initiatives
- Professional PDF generation with Puppeteer (resource-safe with guaranteed browser cleanup)
- PDF storage in local file system with static serving
- Database schema: retainerAmount/billingDay on clients, totalAmount/issueDate/pdfUrl on invoices, invoice_line_items table

**Client Portal Enhancements**
- Billing page with invoice table, payment instructions, PDF download
- Detailed invoice view with line items breakdown at /client/invoices/:id
- Secure authorization - clients can only view their own invoices

**Agency Portal Enhancements**
- Master billing dashboard with financial metrics (Total Revenue, Outstanding, Total Invoices, Overdue)
- Client filter for per-client invoice management
- PDF generation and view actions in invoice table
- System dependency: Chromium installed for Puppeteer