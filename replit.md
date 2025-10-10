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

### 2025-10-10: Complete Notification Badge System Across All Portals
- **Client Portal Notifications**: Sidebar displays badges for:
  - Support: Shows count of unread messages from admin/account manager
  - Recommendations: Shows count of new recommendations (status="Sent", not yet acted upon)
- **Agency Admin Portal Notifications**: Sidebar displays badges for:
  - Client Messages: Shows count of unread messages from clients
  - AI Recommendations: Shows count of client responses not yet viewed by admin
- **Staff Portal Notifications**: Sidebar displays badges for:
  - My Tasks: Shows count of new pending task assignments
- **Database Schema**: Added `responseViewedByAdmin` field to recommendations table
- **API Endpoints**:
  - GET /api/client/notifications/counts - Returns { unreadMessages, newRecommendations }
  - GET /api/agency/notifications/counts - Returns { unreadMessages, unviewedResponses }
  - GET /api/staff/notifications/counts - Returns { newTasks, highPriorityTasks }
  - POST /api/agency/recommendations/mark-viewed - Marks all recommendation responses as viewed
  - POST /api/test/create-user - Development-only endpoint for creating users with specific roles (testing)
- **Smart State Management**:
  - Notifications refresh every 10 seconds automatically via React Query polling
  - When admin views recommendations page, responses are marked as viewed and badge clears
  - When client responds to a recommendation, `responseViewedByAdmin` resets to notify admin
  - Badges appear next to sidebar menu items only when count > 0
- **Technical Implementation**:
  - TanStack Query with 10-second refetch interval for real-time updates
  - Role-based notification counts using existing database fields
  - Security: All endpoints protected by requireAuth and requireRole middleware
- **User Experience**: Clear visual indicators across all portals ensure no messages, recommendations, or tasks are missed

### 2025-10-10: Manual AI Recommendation Creation & Client Filtering
- **Manual Recommendation Creation**: Admins can now create recommendations manually via dialog form
  - Client selector to target specific clients
  - All standard fields: title, observation, proposed action, cost, impact
  - Creates recommendations with "Draft" status for review before sending
- **Universal Client Filter**: Reusable filter component added to all agency pages
  - Dashboard: Filter all metrics, projects, messages by client
  - Client Messages: View messages from specific clients or all
  - AI Recommendations: Filter recommendations by client
  - Tasks & Projects: View projects for specific clients
  - Clients: Quick filter to specific client
  - Google Integrations: Filter integration status by client
- **Google Integrations Management Page**: New page for viewing and managing Google service connections
  - Displays GA4 (Google Analytics 4) connection status per client
  - Shows Google Search Console connection status per client
  - Visual indicators for connected/disconnected state
  - Connect/Reconnect buttons for OAuth flow initiation (placeholder)
  - Client filter for quick navigation
- **API Enhancements**:
  - POST /api/recommendations - Create manual recommendations
  - GET /api/agency/integrations - Fetch all client integrations (tokens excluded for security)
- **Security**: Integration tokens remain server-side, only status metadata exposed to frontend

### 2025-10-10: AI Recommendation Approval Workflow
- **Complete Edit & Send Workflow**: Account managers can edit Draft recommendations and send them to clients
- **Client Response Actions**: Clients can Approve, Reject, or Discuss sent recommendations with feedback
- **State Transitions**: Draft → Sent → Approved/Rejected/Discussing
- **Real-time Updates**: React Query cache invalidation ensures both portals reflect changes immediately