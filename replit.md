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
- **Client Portal**: Dashboard, Projects, AI Recommendations (approve/reject/discuss), Billing, Profile, Support Chat.
- **Agency Admin Portal**: Dashboard, Client Messages (reply, task creation), Tasks & Projects (all clients), AI Recommendations (draft, send, manage client responses), Clients (management, GA4/GSC integration, objectives, user management), Staff (assignments).
  - **User Management**: Create/edit/delete users (clients, staff, admin), manage roles.
  - **Invoice Management**: Create, view, update status, generate PDFs for invoices; automated monthly retainer invoicing, on-demand invoicing from approved recommendations.
  - **Manual Recommendation Creation**: Admins can manually create and send recommendations with client filtering.
- **Staff Portal**: View assigned tasks, update status, prioritize.
- **AI Recommendation Workflow**: Draft → Sent → Approved/Rejected/Discussing.
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
- **PDF Generation**: Puppeteer
- **Scheduling**: node-cron