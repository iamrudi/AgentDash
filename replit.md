# Agency Client Portal

A comprehensive multi-tenant agency management platform with role-based access control, featuring three distinct portals for managing client relationships, projects, tasks, invoices, and AI-powered recommendations.

## Overview

This is a fullstack JavaScript application built with React, Express, PostgreSQL (Supabase), and TypeScript. The platform enables agencies to manage multiple clients while providing each client with secure, isolated access to their own data.

## Architecture

### Technology Stack
- **Frontend**: React 18, Wouter (routing), TanStack Query, Shadcn/UI, Tailwind CSS
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL via Supabase
- **ORM**: Drizzle ORM
- **Authentication**: JWT with bcrypt password hashing
- **State Management**: React Query for server state, localStorage for auth

### Database Schema
- **users**: Authentication credentials
- **profiles**: User profile information with role assignment
- **clients**: Company information for client accounts
- **projects**: Client projects with status tracking
- **tasks**: Project tasks with priority and due dates
- **staff_assignments**: Links staff members to tasks
- **invoices**: Client billing with payment status
- **recommendations**: AI-powered suggestions for clients
- **daily_metrics**: Performance tracking data

## Security Implementation

### Authentication & Authorization
- **JWT Tokens**: Signed 7-day expiring tokens with server-side verification
- **Password Security**: Bcrypt hashing with salt rounds
- **Role-Based Access Control**: Three roles with distinct permissions
  - **Client**: Can only view own data (projects, invoices, recommendations)
  - **Staff**: Can manage assigned tasks
  - **Admin**: Full access to all client data and management features

### Security Features
- ✅ No role self-selection (signup always creates Client role)
- ✅ Tenant isolation (clients cannot see other clients' data)
- ✅ Signed JWT tokens (prevents token tampering)
- ✅ Protected API endpoints with role verification
- ✅ Secure password hashing with bcrypt

### Important Security Notes
- **JWT Secret**: Set `JWT_SECRET` environment variable in production
- **Default Secret**: Uses "development_secret_key_change_in_production" if not set
- **Admin/Staff Provisioning**: Must be created manually (no self-service signup)

## User Roles & Access

### Client Portal (`/client`)
- View own projects with status and descriptions
- Access invoices with payment status
- See AI-powered recommendations
- Track performance metrics
- **Restricted to**: Client role (and Admin for oversight)

### Agency Admin Portal (`/agency`)
- Manage all clients across the platform
- View aggregated metrics and performance
- Create and manage projects for any client
- Generate recommendations for clients
- **Restricted to**: Admin role only

### Staff Portal (`/staff`)
- View assigned tasks across projects
- Update task status and progress
- See task priorities and due dates
- **Restricted to**: Staff role (and Admin)

## Test Accounts

The following accounts are seeded in the database for testing:

```
Admin Account:
Email: admin@agency.com
Password: admin123

Client Account:
Email: client@company.com
Password: client123
Company: Acme Corporation

Staff Account:
Email: staff@agency.com
Password: staff123
```

## API Endpoints

### Authentication (Public)
- `POST /api/auth/signup` - Create new client account
- `POST /api/auth/login` - Authenticate and receive JWT token

### Client Portal (Client, Admin)
- `GET /api/client/projects` - Get client's projects (tenant-isolated)
- `GET /api/client/invoices` - Get client's invoices (tenant-isolated)
- `GET /api/client/recommendations` - Get client's recommendations (tenant-isolated)

### Agency Portal (Admin Only)
- `GET /api/agency/clients` - Get all clients
- `GET /api/agency/projects` - Get all projects
- `POST /api/agency/projects` - Create new project
- `GET /api/agency/metrics` - Get all metrics
- `POST /api/agency/recommendations` - Create recommendation

### Staff Portal (Staff, Admin)
- `GET /api/staff/tasks` - Get staff's assigned tasks
- `PATCH /api/tasks/:id` - Update task status

## Frontend Features

### Design System
- **Primary Color**: Professional Blue (HSL 221 83% 53%)
- **Typography**: Inter font family
- **Components**: Shadcn/UI component library
- **Dark Mode**: Full theme support with system preference detection
- **Responsive**: Mobile-first design approach

### Key Features
- Real-time data fetching with TanStack Query
- Form validation with React Hook Form + Zod
- Toast notifications for user feedback
- Loading states and error handling
- Protected routes with role-based redirects
- Theme toggle (light/dark mode)

## Development

### Running the Application
```bash
npm run dev
```
This starts both the Express backend and Vite frontend on port 5000.

### Database Management
```bash
npm run db:push       # Push schema changes
npm run db:studio     # Open Drizzle Studio
npx tsx server/seed.ts # Seed test data
```

### Project Structure
```
client/
  src/
    pages/           # Route components
    components/      # Reusable UI components
    lib/            # Utilities and clients
server/
  routes.ts         # API endpoint definitions
  storage.ts        # Database operations
  middleware/       # Auth middleware
  lib/             # Server utilities
shared/
  schema.ts         # Shared types and schemas
```

## Production Deployment

### Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string (auto-configured by Supabase)
- `JWT_SECRET` - Strong secret for JWT signing (REQUIRED in production)
- `SESSION_SECRET` - Session signing secret
- `ENCRYPTION_KEY` - 32-byte base64 encryption key for OAuth tokens (REQUIRED)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID for GA4 integration
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `NODE_ENV` - Set to "production"

### Pre-Deployment Checklist
1. Set strong JWT_SECRET in environment
2. Ensure DATABASE_URL points to production database
3. Configure Google OAuth credentials:
   - Create OAuth 2.0 Client ID in Google Cloud Console
   - Enable Google Analytics Data API
   - Add authorized redirect URI: `https://your-domain.com/api/oauth/google/callback`
   - Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables
4. Generate ENCRYPTION_KEY: `openssl rand -base64 32`
5. Review and update CORS settings if needed
6. Test all authentication flows
7. Verify tenant isolation is working
8. Check that admin/staff accounts are provisioned

## Recent Changes

### 2025-10-10: GA4 OAuth Integration Complete
- **Database Schema Extended**: Added `client_integrations` and `client_objectives` tables
- **Token Encryption**: AES-256-GCM encryption for OAuth tokens with IV and auth tag storage
- **OAuth Security**: HMAC-SHA256 signed state parameters prevent CSRF and token fixation
- **Agency Portal**: Client detail page with GA4 integration management and property selection
- **Client Portal**: OAuth authorization flow with connection banners and status display
- **API Endpoints**: 
  - GET /api/client/profile - Client info for authenticated users
  - GET /api/integrations/ga4/:clientId - Integration status
  - GET /api/oauth/google/initiate - OAuth flow initiation
  - GET /api/oauth/google/callback - OAuth callback handler
  - GET /api/integrations/ga4/:clientId/properties - Fetch GA4 properties
  - POST /api/integrations/ga4/:clientId/property - Save selected property

### 2025-10-10: Security Hardening Complete
- Implemented JWT-based authentication with signed tokens
- Eliminated role self-selection vulnerability (signup restricted to Client role)
- Added comprehensive tenant isolation (users only see their own data)
- Applied role-based authorization to all API endpoints
- Fixed login JSON parsing issue
- Completed end-to-end security testing
- All critical security vulnerabilities resolved

## Future Enhancements

Potential areas for expansion:
- Email notifications for invoice due dates
- Real-time collaboration features
- Advanced analytics dashboard
- File upload for project attachments
- Audit logging for compliance
- Two-factor authentication
- API rate limiting
- Webhook integrations

## Troubleshooting

### Login Issues
- Ensure JWT_SECRET is set in production
- Check that passwords are properly hashed
- Verify database connection

### Access Denied Errors
- Confirm user has correct role assigned
- Check ProtectedRoute configuration
- Verify JWT token is being sent in headers

### Data Not Appearing
- For Clients: Ensure they have a client record linked to their profile
- For Staff: Verify staff_assignments exist for their tasks
- For Admins: Check that endpoints return all data (not tenant-scoped)
