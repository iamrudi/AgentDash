# Agency Client Portal

## Overview
The Agency Client Portal is a multi-tenant agency management platform designed to streamline client relationships, project management, and task automation. It provides secure, role-based portals for clients, staff, and administrators. The platform aims to enhance agency efficiency, improve client communication, and leverage AI for insightful recommendations, including a "10-second health check" dashboard and data-driven client recommendations, to foster better client relationships and operational effectiveness.

## User Preferences
I prefer concise and direct communication. When making changes, prioritize iterative development and provide clear explanations of the modifications. Before implementing any major architectural changes or introducing new external dependencies, please ask for approval. Ensure that all code adheres to modern JavaScript/TypeScript best practices.

## System Architecture
The platform is a full-stack JavaScript application utilizing React for the frontend, Express.js for the backend, and PostgreSQL (managed via Supabase) as the database with Drizzle ORM. Authentication relies on Supabase Auth with session-based tokens and a robust Role-Based Access Control (RBAC) system for Client, Staff, and Admin roles, ensuring strict tenant isolation.

### UI/UX Decisions
- **Frontend Framework**: React 18 with Wouter for routing and TanStack Query for state management.
- **Design System**: macOS-inspired aesthetic with Tailwind CSS and Shadcn/UI for styling, supporting dark mode and mobile-first responsiveness.
- **Icons**: Lucide React for consistent line-art styling.
- **Navigation**: Collapsible sidebar with icon-only mode and portal-specific branding.
- **Mobile Responsiveness**: Comprehensive support with touch targets meeting WCAG AA standards.

### Technical Implementations
- **Authentication & Authorization**: Supabase Auth with stateless JWT optimization, RBAC, and tenant isolation, including a SuperAdmin role with cross-agency access.
- **Atomic Transaction Enforcement**: Critical principle for all operations modifying multiple data stores, using `db.transaction()` with explicit verification and rollback.
- **Orphaned User Prevention**: Compensation-based transaction system and nightly cron job for cleanup of Supabase Auth users.
- **Row-Level Security (RLS)**: Database-level tenant isolation using Postgres RLS policies with idempotent migrations (safe to re-run). Covers all 14 tables with 40 policies total, using Supabase's built-in `auth.jwt()` for app_metadata access.
- **Forms**: React Hook Form with Zod validation.
- **Notifications**: Unified notification center with real-time updates.
- **Security**: AES-256-GCM for sensitive data, HMAC-SHA256 for CSRF protection.
- **OAuth Reliability**: Production-ready error handling, rate limiting, and retry logic for Google API calls, with secure context-aware redirects.
- **AI Recommendation Engine**: Preset-driven system with pluggable AI provider architecture for strategic initiatives and task lists, incorporating CRM and social metrics.
- **Client Strategy Card**: AI-powered consolidated client view.
- **Metrics Sync**: Idempotent endpoint for syncing GA4/GSC data with bidirectional lead events.
- **Trash System**: Soft delete for strategic initiatives with 30-day retention.
- **Invoice Automation**: Node-cron for retainers and Puppeteer for PDF generation.
- **Proposal PDF Export**: Secure browser-native PDF printing with short-lived tokens and tenant isolation.
- **Client-to-Account Manager Chat**: Real-time messaging with Server-Sent Events (SSE) and AI-powered conversation analysis.
- **Chat with your Data**: AI-powered analytics data querying.
- **Analytics Dashboard**: GA4 and GSC metrics visualization.
- **Performance Optimizations**: Server-side caching, aggregated API endpoints, frontend query optimization, and component memoization.
- **Task Lists & Hierarchical Tasks**: ClickUp-inspired flexible task hierarchy with robust CRUD operations and five-layer defense-in-depth security.
  - **Task List Management (Phase 2, Task 1 - Completed)**: Full CRUD operations for task lists with kanban layout, SuperAdmin authorization via project-to-agency join, defense-in-depth tenant isolation, and proper UI integration with create/edit dialogs. **Deferred**: Drag-and-drop list reordering (requires dnd-kit integration).
  - **Enhanced Task Detail Dialog (Completed)**: Full-featured modal with URL deep linking, tabbed interface (Details/Subtasks/Activity), inline editing for all task properties (status, priority, dates, assignees, description), and comprehensive testing coverage.
  - **Subtask Management (Completed)**: Complete parent-child task hierarchy with:
    - **Backend**: GET `/api/agency/tasks/:taskId/subtasks` for fetching, POST `/api/tasks/:taskId/subtasks` for creation with Staff access, auto-assignment of creator via idempotent `onConflictDoNothing`, and inheritance of parent's projectId/listId.
    - **Frontend**: Visual hierarchy indicators (CornerDownRight icon, "Subtask" label, lighter background), checkbox toggles for quick status changes, create form with Enter key support, and proper loading/empty states.
    - **Security**: Staff can only create subtasks for tasks they're assigned to; tenant isolation via `requireTaskAccess` middleware; null-safe profile handling in storage layer.
    - **Deferred**: Full inline editing for subtasks, delete functionality, drag-and-drop reordering.
  - **Activity Tracking (Completed)**: Comprehensive audit trail system tracking all task changes:
    - **Backend**: `task_activities` table with TaskActivityWithUser type, `logTaskActivity()` helper function, integrated into task updates (PATCH /api/tasks/:id), subtask creation, and assignment operations (POST/DELETE /api/agency/tasks/:taskId/assign).
    - **Frontend**: Activity tab in task detail dialog with timeline UI, formatted messages for 8 action types (status, priority, dates, description, assignees, subtasks), defensive date formatting with human-readable output (e.g., "Nov 20, 2025"), and relative timestamps.
    - **Activity Types**: status_changed, priority_changed, date_changed, description_changed, assignee_added, assignee_removed, subtask_created.
    - **Security**: Type-safe with TaskActivityWithUser[], null filtering in storage layer, try/catch error handling, tenant isolation via requireTaskAccess middleware.
  - **Task Messaging (Completed)**: Staff-to-account-manager communication system integrated into task detail dialog:
    - **Backend**: `task_messages` table with TaskMessageWithSender type, GET `/api/tasks/:taskId/messages`, POST `/api/tasks/:taskId/messages`, PATCH `/api/tasks/messages/:messageId/read` endpoints.
    - **Frontend**: Messages tab in task detail dialog with chat-style UI, 1-second polling for near real-time updates (`refetchInterval: 1000`, `refetchIntervalInBackground: true`), automatic read receipts on view, auto-scroll to newest messages, Enter-to-send functionality.
    - **Security**: All endpoints protected by requireTaskAccess middleware ensuring users can only message on tasks they're assigned to; tenant isolation via task access verification.
    - **Future Enhancement**: Consider upgrading from polling to WebSockets/SSE for true real-time message delivery.
  - **Auto-Creation Workflow (Completed)**: Automated project, task list, and task generation from approved AI recommendations:
    - **Backend** (server/routes.ts, lines 2102-2177): POST `/api/initiatives/:id/respond` with `response="approved"` triggers atomic workflow.
    - **Transaction-Based Implementation**: Wrapped in `db.transaction()` for all-or-nothing semantics:
      1. Client validation BEFORE any DB writes (returns 400 if client not found)
      2. Project creation with initiative title/observation
      3. Task list creation with required `agencyId` for RLS tenant isolation
      4. Batch task creation from `actionTasks` array (all tasks created atomically)
      5. Scoped variable handling: uses local `createdProjectId` inside transaction, only assigns to outer `projectId` after commit
    - **Invoice Generation**: Separate flow for fixed-cost initiatives or those with specified costs, uses InvoiceGeneratorService
    - **Error Handling**: Returns 500 with descriptive message on failure, preventing silent errors; defensive guards ensure IDs are set before proceeding
    - **Defensive Programming**: Explicit null checks for project.id and createdProjectId to prevent undefined state propagation
  - **Time Tracking (Completed)**: Inline editing controls for task time management:
    - **Backend**: Added `timeEstimate` (text) and `timeTracked` (numeric with z.coerce.number()) fields to tasks table, PATCH `/api/agency/tasks/:id` endpoint updated.
    - **Frontend**: `TaskTimeEstimateControl` with text input (formats: "8h", "2d", "30m") and `TaskTimeTrackedControl` with increment/decrement buttons (±0.5h per click).
    - **UI**: Inline editing in Details tab with optimistic updates, Save/Cancel controls for time estimate, defensive NaN handling for time tracked.
    - **Security**: Tenant isolation via project access validation.
  - **Task Relationships (Completed)**: Task-to-task relationship system with five-layer security:
    - **Backend**: `task_relationships` table with unique index on (sourceTaskId, relatedTaskId, relationshipType), CRUD endpoints at GET/POST `/api/tasks/:taskId/relationships` and DELETE `/api/tasks/relationships/:relationshipId`.
    - **Relationship Types**: blocks, blocked_by, relates_to, duplicates (duplicated_by removed from schema).
    - **Security**: Fail-closed tenant isolation for ALL roles including SuperAdmin - rejects if either project.agencyId is null, enforces same-agency validation before allowing creation/deletion.
    - **Frontend**: `TaskRelationships` component in task detail dialog with relationship type selector, task search, and delete functionality.
    - **Bug Fixes**: Fixed NaN bug in time tracking increment by adding proper null/undefined handling, added stable wrapper test IDs for UI components.
- **SuperAdmin Cross-Agency Access**: SuperAdmin users can view and manage all resources across all agencies, including task lists and tasks.

### Feature Specifications
- **Client Portal**: Dashboard, Projects, Strategic Initiatives, Billing, Profile, Support Chat, Chat with your Data.
- **Agency Admin Portal**: Management for Clients, Staff, Tasks & Projects, Strategic Initiatives, Invoices, User Management, Trash, AI Provider Settings, and a full CRM system.
- **Staff Portal**: View and update assigned tasks.
- **SuperAdmin Portal**: Platform-wide user and agency management, including user credential management, promotion/demotion to SuperAdmin, and comprehensive audit logging.
- **Strategic Initiative Workflow**: Defined lifecycle from `Needs Review` to `Measured`.
- **Google Integrations**: GA4 Lead Event Configuration and Google Search Console.
- **HubSpot Integration**: Agency-wide CRM integration for contacts, deals, and companies data.
- **LinkedIn Integration**: Agency-wide social media integration for organization page metrics.
- **CRM System**: Full-featured Customer Relationship Management with Companies, Contacts, and Deals modules.
- **Form Creator**: Lead capture form builder with drag-and-drop fields, public endpoints, and CRM integration.
- **AI-Powered Proposal Builder**: Professional proposal creation tool with AI content generation, templates, and secure PDF export.

### System Design Choices
- **Multi-tenancy**: Achieved through Application Layer middleware, Database Layer (Postgres RLS), and Resource-Level Protection on routes.
- **API Structure**: RESTful endpoints with role-based access.
- **Project Structure**: Separate frontend, backend, and shared codebases.

## External Dependencies
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth
- **Cloud Services**: Supabase, Google Cloud (for GA4, GSC APIs)
- **OAuth Integrations**: Google OAuth (GA4, Google Search Console), HubSpot (CRM data), LinkedIn (social media metrics)
- **AI Services**: Pluggable provider system supporting Google Gemini AI (default) and OpenAI.
- **PDF Generation**: Puppeteer
- **Scheduling**: `node-cron`