# Agency Client Portal

## Overview

This project is a multi-tenant agency management platform designed to streamline client relationships, project management, and task automation. It provides distinct portals for clients, staff, and administrators, ensuring secure, role-based access to their specific data and functionalities. The platform aims to enhance agency efficiency, improve client communication, and leverage AI for insightful recommendations.

## User Preferences

I prefer concise and direct communication. When making changes, prioritize iterative development and provide clear explanations of the modifications. Before implementing any major architectural changes or introducing new external dependencies, please ask for approval. Ensure that all code adheres to modern JavaScript/TypeScript best practices.

## System Architecture

The platform is a full-stack JavaScript application utilizing React for the frontend, Express.js for the backend, and PostgreSQL (managed via Supabase) as the database. Drizzle ORM is used for database interactions. Authentication is handled with JWT and bcrypt for password hashing, implementing a robust Role-Based Access Control (RBAC) system with Client, Staff, and Admin roles.

### UI/UX Decisions
- **Frontend Framework**: React 18
- **Routing**: Wouter
- **State Management**: TanStack Query for server state
- **Styling**: Tailwind CSS with Shadcn/UI component library
- **Theming**: Full dark mode support with system preference detection
- **Responsiveness**: Mobile-first design approach
- **Typography**: Inter font family
- **Primary Color**: Professional Blue (HSL 221 83% 53%)

### Technical Implementations
- **Authentication**: JWT tokens (7-day expiry), bcrypt hashing, no role self-selection on signup.
- **Authorization**: Role-based access control, tenant isolation ensuring clients only view their own data.
- **Forms**: React Hook Form with Zod for validation.
- **Notifications**: Toast notifications for user feedback.
- **Data Fetching**: Real-time data fetching and cache invalidation with TanStack Query.
- **Security**: AES-256-GCM encryption for sensitive OAuth tokens, HMAC-SHA256 signed state parameters for CSRF protection.

### Feature Specifications
- **Client Portal**: Dashboard (KPIs, objectives), Projects, AI Recommendations, Billing (invoices), Profile, Support (chat with account manager).
- **Agency Admin Portal**: Dashboard (overview metrics), Client Messages (reply, task creation), Tasks & Projects (all clients), AI Recommendations (send to client), Clients (management, GA4/GSC integration, objectives), Staff (assignments).
- **Staff Portal**: View assigned tasks, update status, prioritize tasks.
- **AI Recommendation Workflow**: Draft, Sent, Approved/Rejected/Discussing statuses with client feedback.
- **Client-to-Account Manager Chat System**: Real-time messaging with historical view.

### System Design Choices
- **Multi-tenancy**: Achieved through strict tenant isolation at the database and API level.
- **API Structure**: Clearly defined RESTful API endpoints for authentication, client, agency, and staff portals, with role-based access enforcement.
- **Project Structure**: Organized separation of client (frontend), server (backend), and shared (schemas/types) codebases.

## External Dependencies

- **Database**: PostgreSQL (via Supabase)
- **Authentication**: JWT (JSON Web Tokens), bcrypt
- **Cloud Services**: Supabase (for database hosting)
- **OAuth Integrations**: Google OAuth (for GA4 integration)

## Recent Changes

### 2025-10-10: Notification Badge System
- **Real-time Sidebar Notifications**: Agency portal sidebar displays notification badges for:
  - Client Messages: Shows count of unread messages from clients
  - AI Recommendations: Shows count of client responses not yet viewed by admin
- **Database Schema**: Added `responseViewedByAdmin` field to recommendations table
- **API Endpoints**:
  - GET /api/agency/notifications/counts - Returns unread message and unviewed response counts
  - POST /api/agency/recommendations/mark-viewed - Marks all recommendation responses as viewed
- **Smart State Management**:
  - Notifications refresh every 10 seconds automatically
  - When admin views recommendations page, responses are marked as viewed and badge clears
  - When client responds to a recommendation, `responseViewedByAdmin` resets to notify admin
- **User Experience**: Clear visual indicators ensure account managers never miss client messages or recommendation responses

### 2025-10-10: AI Recommendation Approval Workflow
- **Complete Edit & Send Workflow**: Account managers can edit Draft recommendations and send them to clients
- **Client Response Actions**: Clients can Approve, Reject, or Discuss sent recommendations with feedback
- **State Transitions**: Draft → Sent → Approved/Rejected/Discussing
- **Real-time Updates**: React Query cache invalidation ensures both portals reflect changes immediately