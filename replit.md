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

### 2025-10-10: Complete User Management System
- **User Management Dashboard**: Admins have a dedicated section to view and edit all users
  - Comprehensive table showing: Name, Email, Role, Company, Created date
  - Visual role indicators with colored badges (Admin: default, Staff: secondary, Client: outline)
  - User icons differentiate between Admin (Shield), Staff (UserCog), Client (Building)
  - **Role Filter**: Dropdown to filter users by Admin, Staff, Client, or view all
  - **Create User**: Button to add new staff/admin users directly from User Management page
  - **Delete User**: Trash icon button with confirmation dialog for safe user deletion
- **Edit User Roles**: Admins can change any user's role
  - Edit dialog with role dropdown (Client, Staff, Admin)
  - Real-time UI updates after role changes
  - Proper query invalidation ensures immediate visual feedback
- **API Endpoints**:
  - GET /api/agency/users - Retrieve all users with profiles and client information
  - PATCH /api/agency/users/:userId/role - Update user role
  - DELETE /api/agency/users/:userId - Delete user (prevents self-deletion, cascades to related records)
- **Security**: All endpoints protected by requireAuth and requireRole("Admin") middleware, cascade deletes configured in schema
- **Navigation**: User Management accessible from agency sidebar with UserCog icon

### 2025-10-10: Admin User Management - Create Clients, Staff, and Admin Users
- **Client Creation**: Admins can create new client users with company information
  - Form includes: Company name, contact full name, email, password
  - Automatically creates user account, profile with Client role, and client record
  - Accessible from Clients page with "Create Client" button
- **Staff and Admin Creation**: Admins can create staff members and administrators
  - Form includes: Role selector (Staff/Admin), full name, email, password
  - Creates user account and profile with selected role
  - Accessible from Staff page with "Create User" button
- **Form Validation**: All forms use react-hook-form with Zod schema validation
  - Email validation (valid email format required)
  - Password minimum length (6 characters)
  - All fields required with inline error messages
  - Client-side and server-side validation consistency
- **API Endpoints**:
  - POST /api/agency/clients/create-user - Create client users with schema validation
  - POST /api/agency/users/create - Create staff/admin users with schema validation
- **Security**: All endpoints protected by requireAuth and requireRole("Admin") middleware

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

### 2025-10-10: Invoice Management System for Admins
- **Invoice Management Page**: Complete admin interface for managing client invoices
  - Comprehensive table displaying: Invoice #, Client, Amount, Due Date, Status, Created Date, Actions
  - Visual status badges: Paid (blue/default), Pending (gray/secondary), Overdue (red/destructive)
  - Amounts formatted with dollar sign and 2 decimal places
  - Client filter to view invoices for specific clients or all
- **Create Invoice**: Full invoice creation workflow
  - Form fields: Client selector, Invoice Number, Amount, Due Date, Status
  - Validates with insertInvoiceSchema via react-hook-form and Zod
  - Creates invoice with selected client association
  - Shows success toast and updates table immediately
- **Update Invoice Status**: Quick status change functionality
  - "Change Status" button in Actions column
  - Dropdown selector with options: Pending, Paid, Overdue
  - Real-time status updates with proper validation
  - Immediate UI feedback with toast notifications
- **API Endpoints**:
  - POST /api/invoices - Create invoice (Admin only, validates with Zod, returns InvoiceWithClient)
  - PATCH /api/invoices/:invoiceId/status - Update status (Admin only, validates with z.enum, checks existence, returns InvoiceWithClient)
  - GET /api/client/invoices - Fetch all invoices (returns InvoiceWithClient[])
- **Data Architecture**:
  - InvoiceWithClient type: Invoice & { client: Client } for consistent frontend display
  - Storage methods return persisted records for state consistency
  - Zod validation on both client and server with detailed error messages
- **Technical Implementation**:
  - TanStack Query with proper cache invalidation after mutations
  - Awaited invalidation ensures UI updates before dialogs close
  - Comprehensive error handling with field-level validation feedback
- **Security**: All invoice endpoints protected by requireAuth and requireRole("Admin") middleware

### 2025-10-10: Frictionless Invoicing System - Core Schema and Automation
- **Database Schema Modernization**: Updated invoice system with comprehensive fields
  - **Clients Table**: Added retainerAmount (numeric) and billingDay (integer) for automated monthly invoicing
  - **Invoices Table**: Renamed amount→totalAmount, added issueDate (date), pdfUrl (text), updated status enum to "Draft" | "Due" | "Paid" | "Overdue"
  - **Invoice Line Items Table**: New table with invoiceId, description, quantity (integer), unitPrice (numeric), lineTotal (numeric), optional projectId/taskId for tracking billable work
- **Automated Invoice Generation**: Node-cron scheduler for monthly retainer invoicing
  - Runs daily at 9:00 AM checking clients' billing day
  - Prevents duplicate invoices for the same month
  - Auto-creates line items for monthly retainer fees
  - Generates unique invoice numbers: INV-CLIENTID-YYYYMMDD-XXX
- **On-Demand Invoice Generation**: Create invoices from approved recommendations
  - POST /api/recommendations/:id/generate-invoice - Converts approved recommendation to invoice
  - Automatically creates line item from recommendation details
  - 30-day payment terms by default
- **Professional PDF Generation**: Puppeteer-based invoice PDF creation
  - POST /api/invoices/:invoiceId/generate-pdf - Generates and stores PDF
  - Professional HTML template with company branding
  - Formatted currency, dates, and status badges
  - Resource-safe with guaranteed browser cleanup (try/finally pattern)
- **PDF Storage & Serving**: Local file system storage with public URLs
  - PDFs saved to public/invoices directory
  - Static file serving at /invoices/:filename
  - Sanitized filenames for security
  - Invoice pdfUrl updated automatically
- **API Endpoints**:
  - POST /api/recommendations/:id/generate-invoice - Generate invoice from recommendation (Admin only)
  - POST /api/invoices/:invoiceId/generate-pdf - Generate PDF for invoice (Admin only)
  - GET /api/invoices/:invoiceId/line-items - Fetch invoice line items
  - POST /api/invoices/:invoiceId/line-items - Create line items with Zod validation (Admin only)
  - GET /invoices/:filename - Serve invoice PDF files (static)
- **Technical Architecture**:
  - InvoiceGeneratorService: Handles retainer and recommendation-based invoice creation
  - InvoiceScheduler: Cron-based automation for monthly invoicing
  - PDFGeneratorService: Puppeteer-based PDF generation with professional template
  - PDFStorageService: File system management for invoice PDFs
- **Security**: All protected endpoints require authentication and Admin role, browser process cleanup guaranteed