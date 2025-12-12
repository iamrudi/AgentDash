# Agency Client Portal - Architecture Documentation

## Overview

The Agency Client Portal is a multi-tenant SaaS platform designed for digital agencies to manage client relationships, projects, tasks, and strategic initiatives. The platform supports three primary user roles (Client, Staff, Admin) plus a platform-wide SuperAdmin role for governance and oversight.

---

## System Architecture

### Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Wouter, TanStack Query, Tailwind CSS, Shadcn/UI |
| Backend | Express.js, Node.js |
| Database | PostgreSQL (Supabase-hosted) with Drizzle ORM |
| Authentication | Supabase Auth with session-based JWT |
| AI Services | Google Gemini, OpenAI (pluggable provider architecture) |
| PDF Generation | Puppeteer |
| Scheduling | node-cron |

### Multi-Tenancy Model

```
┌─────────────────────────────────────────────────────────────┐
│                      SuperAdmin Layer                        │
│  (Platform-wide governance, cross-agency access)            │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                        Agency Layer                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Agency A   │  │  Agency B   │  │  Agency C   │  ...    │
│  │  ─────────  │  │  ─────────  │  │  ─────────  │         │
│  │  • Clients  │  │  • Clients  │  │  • Clients  │         │
│  │  • Staff    │  │  • Staff    │  │  • Staff    │         │
│  │  • Projects │  │  • Projects │  │  • Projects │         │
│  │  • Tasks    │  │  • Tasks    │  │  • Tasks    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

**Tenant Isolation is enforced at three levels:**
1. **Application Layer** - Middleware validates agency membership
2. **Database Layer** - PostgreSQL Row-Level Security (RLS) policies
3. **Resource Layer** - Route-level access control

---

## Role-Based Access Control (RBAC)

### User Roles

| Role | Scope | Description |
|------|-------|-------------|
| **Client** | Single client within agency | View projects, invoices, chat with account manager |
| **Staff** | Agency-wide (assigned tasks) | View/update assigned tasks, track time |
| **Admin** | Agency-wide | Full agency management, client/staff/project CRUD |
| **SuperAdmin** | Platform-wide | Cross-agency governance, system administration |

### Role Hierarchy

```
SuperAdmin
    │
    ├── Can access ALL agencies
    │
    └── Agency Admin
            │
            ├── Staff (Delivery Team)
            │
            └── Clients
```

### SuperAdmin Access Model

SuperAdmin routes use the Supabase **service role key** (`supabaseAdmin`) which **bypasses PostgreSQL RLS policies** entirely. Because RLS is not enforced for service-role queries, the following compensating controls are required:

1. **Application-layer filtering** — All `/api/superadmin/*` handlers must explicitly validate `agencyId` conditions
2. **Scope constraints** — Queries should request only the minimum data needed
3. **Audit logging** — All cross-agency operations must be logged for security review

Regular user routes continue to use the standard `supabase` client (anon key) where RLS policies are enforced automatically. This dual-client pattern ensures tenant isolation for normal operations while allowing controlled platform-wide access for SuperAdmin governance tasks.

---

## Frontend Portal Architecture

The platform provides four distinct frontend portals, each tailored for specific user roles with dedicated navigation, pages, and backend API access.

### Portal Overview Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND PORTALS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │  AGENCY PORTAL  │  │  CLIENT PORTAL  │  │ STAFF/TALENT    │             │
│  │  /agency/*      │  │  /client/*      │  │    PORTAL       │             │
│  │                 │  │                 │  │ /staff          │             │
│  │  Role: Admin    │  │  Role: Client   │  │ /staff/hours    │             │
│  │                 │  │                 │  │ /staff/settings │             │
│  │  • 16 pages     │  │  • 8 pages      │  │  • 3 pages      │             │
│  │  • Full CRUD    │  │  • Read-focused │  │  • Task-focused │             │
│  │  • All features │  │  • Self-service │  │  • Time track   │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                    │                       │
│           ▼                    ▼                    ▼                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                     TanStack Query (React Query)                        │ │
│  │              Caching • Optimistic Updates • Refetching                  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                          Express.js API                                  │ │
│  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐ │ │
│  │   │ requireAuth  │→ │ requireRole  │→ │ Resource Access Middleware   │ │ │
│  │   │  (JWT valid) │  │  (role check)│  │  (tenant isolation)          │ │ │
│  │   └──────────────┘  └──────────────┘  └──────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    PostgreSQL (Supabase) + Drizzle ORM                   │ │
│  │                    Row-Level Security (RLS) Policies                     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Agency Portal (`/agency/*`)

Full-featured admin dashboard for agency owners and managers.

| Route | Page | Description |
|-------|------|-------------|
| `/agency` | Dashboard | KPIs, client overview, recent activity |
| `/agency/clients` | Clients List | Manage client accounts and retainers |
| `/agency/clients/:id` | Client Detail | Individual client profile, metrics, projects |
| `/agency/projects` | Projects List | All agency projects with filtering |
| `/agency/projects/:id` | Project Detail | Tasks, lists, timeline, team assignments |
| `/agency/tasks` | Tasks | Agency-wide task management |
| `/agency/staff` | Staff | Team members and capacity |
| `/agency/users` | Users | User accounts and role management |
| `/agency/invoices` | Invoices | Billing and invoice management |
| `/agency/messages` | Messages | Client communication center |
| `/agency/recommendations` | AI Recommendations | Strategic insights per client |
| `/agency/integrations` | Integrations | GA4, GSC, HubSpot connections |
| `/agency/workflows` | Workflows | Automation workflow list |
| `/agency/workflow-builder/:id?` | Workflow Builder | Visual DAG editor |
| `/agency/hours` | Hours Report | Staff time tracking reports |
| `/agency/settings` | Settings | Agency configuration, branding |
| `/agency/trash` | Trash | Soft-deleted items recovery |

**Backend API Endpoints:**
- `GET /api/agency/clients` - List all clients
- `GET /api/agency/clients/:clientId` - Get single client
- `PATCH /api/agency/clients/:clientId` - Update client
- `POST /api/agency/clients/:clientId/sync-metrics` - Sync analytics
- `POST /api/agency/clients/:clientId/reset-retainer-hours` - Reset hours
- `POST /api/agency/clients/:clientId/generate-recommendations` - AI insights
- `GET /api/agency/projects` - List projects
- `POST /api/agency/projects` - Create project
- `GET /api/agency/projects/:id` - Get project detail
- `PATCH /api/agency/projects/:id` - Update project
- `GET /api/agency/tasks` - List tasks
- `POST /api/agency/tasks` - Create task
- `PATCH /api/agency/tasks/:id` - Update task
- `DELETE /api/agency/tasks/:id` - Delete task
- `GET /api/agency/staff` - List staff
- `GET/PUT /api/agency/settings` - Agency configuration
- `POST /api/invoices` - Create invoice
- `GET /api/client/invoices` - List invoices (shared)
- `GET /api/agency/metrics` - Dashboard metrics
- `GET /api/agency/integrations` - Integration status

**Layout Component:** `client/src/components/agency-layout.tsx`
**Sidebar:** `client/src/components/agency-sidebar.tsx`

---

### Client Portal (`/client/*`)

Self-service portal for agency clients to view their projects, invoices, and recommendations.

| Route | Page | Description |
|-------|------|-------------|
| `/client` | Dashboard | Project overview, recent tasks, metrics |
| `/client/projects` | Projects | Client's project list with status |
| `/client/billing` | Billing | Invoices and payment history |
| `/client/invoices/:id` | Invoice Detail | Individual invoice view |
| `/client/recommendations` | Recommendations | AI-generated strategic insights |
| `/client/reports` | Reports | Analytics and performance reports |
| `/client/profile` | Profile | Client profile and preferences |
| `/client/support` | Support | Chat with account manager, help center |

**Backend API Endpoints:**
- `GET /api/client/profile` - Client profile data
- `GET /api/client/projects` - Client's projects
- `GET /api/client/projects-with-tasks` - Projects with nested tasks
- `GET /api/client/invoices` - Client's invoices
- `GET /api/client/initiatives` - Strategic initiatives
- `GET /api/client/tasks/recent` - Recent task activity

**Layout Component:** `client/src/components/client-layout.tsx`
**Sidebar:** `client/src/components/client-sidebar.tsx`

---

### Staff/Talent Portal

Task-focused portal for agency delivery team members.

| Route | Page | Description |
|-------|------|-------------|
| `/staff` | Dashboard | Assigned tasks, daily priorities |
| `/staff/hours` | Hours | Personal time tracking and entries |
| `/staff/settings` | Settings | Profile and notification preferences |

**Backend API Endpoints:**
- `GET /api/staff/tasks` - Staff's assigned tasks (summary)
- `GET /api/staff/tasks/full` - Full task details with project info
- `GET /api/staff/notifications/counts` - Notification badge counts
- `GET /api/tasks/:taskId/messages` - Task chat messages (shared with Admin)
- `POST /api/tasks/:taskId/subtasks` - Create subtasks (shared with Admin)
- `PATCH /api/user/profile` - Profile updates

**Dashboard Page:** `client/src/pages/staff-dashboard.tsx`
**Hours Page:** `client/src/pages/staff-hours.tsx`
**Settings Page:** `client/src/pages/staff-settings.tsx`

---

### SuperAdmin Portal (`/superadmin/*`)

Platform-wide governance dashboard for system administrators.

| Route | Page | Description |
|-------|------|-------------|
| `/superadmin` | Dashboard | Cross-agency overview, health checks |
| `/superadmin/governance` | Governance | AI policies, rate limits, audit logs |

**Backend API Endpoints:**
- `GET /api/superadmin/agencies` - All agencies
- `GET /api/superadmin/users` - All platform users
- `GET /api/superadmin/audit-logs` - System audit trail
- `GET /api/superadmin/metrics` - Platform-wide metrics

---

## Backend Domain Router Architecture

As of December 2024, the monolithic `routes.ts` is being decomposed into domain-specific routers for improved maintainability.

### Domain Router Structure

```
server/routes/
├── index.ts       # Router composition and registration (5 routers mounted)
├── auth.ts        # Authentication endpoints (3 routes)
├── user.ts        # User profile endpoints (2 routes)
├── client.ts      # Client portal endpoints (10 routes)
├── agency.ts      # Agency admin endpoints (17 routes)
├── staff.ts       # Staff portal endpoints (3 routes)
├── crm.ts         # CRM endpoints (34 routes)
├── settings.ts    # Settings endpoints (2 routes)
│
│   (Planned - still in routes.ts)
├── superadmin.ts  # SuperAdmin endpoints
├── tasks.ts       # Task management
├── workflows.ts   # Workflow engine
└── intelligence.ts # AI/Intelligence
```

### Router Registration Pattern

```typescript
// server/routes/index.ts
import { Router, type Express } from 'express';
import authRoutes from './auth';
import agencyRoutes from './agency';
// ...

export function registerDomainRouter(subpath: string, router: Router): void {
  domainRegistry.push({ subpath, router });
}

registerDomainRouter('/auth', authRoutes);
registerDomainRouter('/agency', agencyRoutes);
// ...

export function mountDomainRouters(app: Express): void {
  for (const { subpath, router } of domainRegistry) {
    app.use(`/api${subpath}`, router);
  }
}
```

### Migration Status (December 2024)

| Domain | Status | Routes | Notes |
|--------|--------|--------|-------|
| auth | ✅ Mounted | 3 | Login, logout, session |
| user | ✅ Mounted | 2 | Profile get/update |
| client | ✅ Mounted | 10 | Client portal endpoints |
| agency | ✅ Mounted | 17 | Clients, projects, metrics, staff, messages |
| staff | ✅ Mounted | 3 | Tasks, notifications |
| crm | ✅ Mounted | 34 | CRM endpoints (companies, contacts, deals, proposals, forms) |
| settings | ✅ Mounted | 2 | Rate limit settings |
| superadmin | 🔴 Pending | ~15 | Platform governance |
| tasks | 🔴 Pending | ~20 | Task CRUD, subtasks, relationships |
| workflows | 🔴 Pending | ~25 | Workflow engine API |
| intelligence | 🔴 Pending | ~10 | AI, knowledge, feedback |

**Progress:** ~48% complete (71 routes mounted via domain routers, ~78 routes pending extraction)

**Stability Testing:** All mounted domain routers have cross-tenant protection validated by 18 auth middleware tests

### Security Guarantees

All extracted domain routers maintain:
- **Zod validation** on POST/PATCH request bodies
- **requireAuth** middleware for JWT validation
- **requireRole** middleware for RBAC enforcement
- **Cross-tenant protection** via agencyId injection from user context
- **Resource ownership validation** (e.g., clientId belongs to user's agency)

---

### Frontend-to-Backend Data Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        REQUEST FLOW                                       │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   React Component                                                         │
│        │                                                                  │
│        │  useQuery({ queryKey: ['/api/agency/projects'] })               │
│        ▼                                                                  │
│   ┌─────────────┐                                                        │
│   │ TanStack    │  Checks cache → If stale, fetches                     │
│   │   Query     │                                                        │
│   └──────┬──────┘                                                        │
│          │                                                                │
│          │  fetch('/api/agency/projects', { credentials: 'include' })    │
│          ▼                                                                │
│   ┌─────────────┐                                                        │
│   │ Express.js  │                                                        │
│   │   Router    │                                                        │
│   └──────┬──────┘                                                        │
│          │                                                                │
│          ▼                                                                │
│   ┌──────────────────────────────────────────────────────────────┐       │
│   │              MIDDLEWARE CHAIN                                  │       │
│   │                                                                │       │
│   │  1. requireAuth(req, res, next)                               │       │
│   │     └─ Validates JWT from session cookie                      │       │
│   │     └─ Attaches user to req.user                              │       │
│   │                                                                │       │
│   │  2. requireRole("Admin", "Staff", "SuperAdmin")               │       │
│   │     └─ Checks req.user.role against allowed roles             │       │
│   │     └─ Returns 403 if unauthorized                            │       │
│   │                                                                │       │
│   │  3. resolveAgencyContext(req, options) [in handler]           │       │
│   │     └─ SuperAdmin: may filter by agencyId via query/body      │       │
│   │     └─ Admin/Staff: uses req.user.agencyId                    │       │
│   │                                                                │       │
│   │  4. requireProjectAccess(storage) [resource-specific]         │       │
│   │     └─ Validates user's agency owns the resource              │       │
│   │     └─ Enforces tenant isolation                              │       │
│   └──────────────────────────────────────────────────────────────┘       │
│          │                                                                │
│          ▼                                                                │
│   ┌─────────────┐                                                        │
│   │  Route      │  storage.getProjects({ agencyId: req.user.agencyId }) │
│   │  Handler    │                                                        │
│   └──────┬──────┘                                                        │
│          │                                                                │
│          ▼                                                                │
│   ┌─────────────┐                                                        │
│   │ Drizzle ORM │  SELECT * FROM projects WHERE agency_id = $1          │
│   │ + RLS       │  + Row-Level Security policies                        │
│   └──────┬──────┘                                                        │
│          │                                                                │
│          ▼                                                                │
│   ┌─────────────┐                                                        │
│   │ PostgreSQL  │  Returns filtered, tenant-isolated data               │
│   │ (Supabase)  │                                                        │
│   └─────────────┘                                                        │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Role-Based API Access Matrix

| API Prefix | Client | Staff | Admin | SuperAdmin |
|------------|--------|-------|-------|------------|
| `/api/client/*` | ✅ | ❌ | ✅ | ✅ |
| `/api/staff/*` | ❌ | ✅ | ✅ | ❌ |
| `/api/agency/*` | ❌ | 🟡¹ | ✅ | 🟡³ |
| `/api/superadmin/*` | ❌ | ❌ | ❌ | ✅ |
| `/api/tasks/*` | 🟡² | ✅ | ✅ | ✅ |
| `/api/workflows/*` | ❌ | ❌ | ✅ | ✅ |

¹ Staff has read-only access to assigned projects/tasks
² Clients can view task activity on their projects
³ SuperAdmin access to agency endpoints varies by route; has full task/list CRUD but limited client/project access

---

## SuperAdmin Architecture

### Permissions Matrix

| Permission Category | Capabilities |
|---------------------|--------------|
| **Cross-Agency Visibility** | Read-only access to all agencies, clients, projects, tasks, invoices, users, and initiatives |
| **Agency Management** | Create, edit, suspend, and delete agencies; manage branding/logos, AI provider settings, integrations; set seat limits and feature toggles |
| **User Lifecycle** | Create, edit, suspend, delete users across all agencies; assign roles (Client/Admin/Staff); move users between agencies; force password resets; bulk import |
| **Security & Compliance** | Search and export audit logs; view authentication anomalies (failed logins, rate limits); monitor API key and AI provider usage; global rate-limit overrides |
| **Data & Billing Oversight** | Global reporting (hours, invoices, AR/AP); retention controls; trash/restore management; system-wide announcements; maintenance mode toggle |
| **AI Governance** | Set default AI provider; per-agency overrides; token quotas; model allow/deny lists; usage monitoring |
| **Integration Governance** | Manage shared integrations (HubSpot, LinkedIn, GA4, GSC); rotate/revoke tokens; view per-agency connection health |

### SuperAdmin Dashboard Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SuperAdmin Dashboard                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ │
│  │   Active     │ │   Active     │ │    Open      │ │  MTD        │ │
│  │   Agencies   │ │   Users      │ │   Projects   │ │  Invoices   │ │
│  │     12       │ │     156      │ │     48       │ │   $45,230   │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └─────────────┘ │
│                                                                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ │
│  │  AI Usage    │ │   Auth       │ │  Rate Limit  │ │  Storage    │ │
│  │  (calls/mo)  │ │  Anomalies   │ │    Hits      │ │   Usage     │ │
│  │    8,450     │ │     3        │ │     12       │ │   65%       │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └─────────────┘ │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│  SYSTEM HEALTH                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ API: ✅ Healthy  │ DB: ✅ Healthy  │ Cron: ✅ Running          │ │
│  │ GA4: ✅ Connected │ GSC: ✅ Connected │ HubSpot: ⚠️ Token Expiring│
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│  AGENCY OVERVIEW                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Agency Name    │ Status │ Seats │ Clients │ Last Active │ Actions│
│  ├────────────────┼────────┼───────┼─────────┼─────────────┼────────┤
│  │ MM Agency      │ Active │ 15/20 │    8    │  2 min ago  │ ⚙️ 👁️  │
│  │ Digital First  │ Active │  8/10 │    5    │  1 hr ago   │ ⚙️ 👁️  │
│  │ Creative Co    │ Paused │  3/10 │    2    │  3 days ago │ ⚙️ 👁️  │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│  RECENT AUDIT LOG                                                    │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Time     │ User           │ Action        │ Resource │ Agency  │ │
│  ├──────────┼────────────────┼───────────────┼──────────┼─────────┤ │
│  │ 2 min    │ admin@mm.co    │ user.created  │ John Doe │ MM Agency│
│  │ 15 min   │ rudi@mm.co.uk  │ project.updated│ Website  │ MM Agency│
│  │ 1 hr     │ system         │ invoice.sent  │ INV-042  │ Digital │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│  QUICK ACTIONS                                                       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ │
│  │ + Create     │ │ + Invite     │ │ 🔧 Maintenance│ │ 📢 Announce │ │
│  │   Agency     │ │   User       │ │    Mode      │ │   ment      │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └─────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### SuperAdmin API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/superadmin/overview` | GET | Platform-wide KPIs and metrics |
| `/api/superadmin/agencies` | GET/POST | List all agencies, create new agency |
| `/api/superadmin/agencies/:id` | GET/PATCH/DELETE | Agency CRUD operations |
| `/api/superadmin/users` | GET/POST | List all users across agencies |
| `/api/superadmin/users/:id` | GET/PATCH/DELETE | User CRUD, role changes, password reset |
| `/api/superadmin/audit-logs` | GET | Paginated, filterable audit log |
| `/api/superadmin/health` | GET | System health status |
| `/api/superadmin/announcements` | POST | Create system-wide announcements |
| `/api/superadmin/maintenance` | POST | Toggle maintenance mode |

### Security Controls

1. **Authentication Guard**: `requireSuperAdmin` middleware validates `profile.isSuperAdmin === true`
2. **Audit Logging**: Every SuperAdmin mutation is logged with user ID, action, resource, timestamp, and IP address
3. **Rate Limiting**: SuperAdmin endpoints have separate rate limits to prevent abuse
4. **Impersonation Safety**: Support sessions are read-only, time-limited, and fully audited

---

## Portal Architecture

### Client Portal (`/client/*`)

| Feature | Description |
|---------|-------------|
| Dashboard | Project overview, recent activity, health metrics |
| Projects | View assigned projects and progress |
| Strategic Initiatives | Review and respond to AI recommendations |
| Billing | View invoices, payment history |
| Support Chat | Real-time messaging with account manager |
| Chat with Data | AI-powered analytics querying |

### Agency Admin Portal (`/agency/*`)

| Feature | Description |
|---------|-------------|
| Dashboard | Agency-wide metrics, client health |
| Clients | Client CRUD, onboarding |
| Staff | Staff management, assignments |
| Tasks & Projects | Full task hierarchy management |
| Strategic Initiatives | AI recommendation engine |
| Invoices | Invoice generation, automation |
| CRM | Companies, Contacts, Deals |
| Hours Report | Time tracking analytics |
| Settings | Branding, AI provider, integrations |

### Staff Portal (`/staff/*`)

| Feature | Description |
|---------|-------------|
| My Tasks | Assigned tasks with detail dialogs |
| My Hours | Personal time tracking analytics |
| Settings | Profile, preferences |

### SuperAdmin Portal (`/superadmin/*`)

| Feature | Description |
|---------|-------------|
| Dashboard | Platform-wide KPIs, system health |
| Agencies | Agency management, settings |
| Users | Cross-agency user management |
| Audit Logs | Security and compliance monitoring |

---

## Data Flow Architecture

### Task Management Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Project   │────▶│  Task List  │────▶│    Task     │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
                    ┌─────────────────────────────────────┐
                    │              Subtasks               │
                    └─────────────────────────────────────┘
```

### AI Recommendation Workflow

```
┌─────────────────┐
│ AI Generates    │
│ Recommendation  │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Client Reviews  │
│ (Needs Review)  │
└────────┬────────┘
         ▼
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐
│Approve│ │Reject │
└───┬───┘ └───────┘
    ▼
┌─────────────────┐
│ Auto-Create:    │
│ • Project       │
│ • Task List     │
│ • Tasks         │
│ • Invoice (opt) │
└─────────────────┘
```

---

## Security Architecture

### Defense-in-Depth Layers

1. **Network Layer**: HTTPS, rate limiting, CORS policies
2. **Authentication Layer**: Supabase Auth, JWT validation
3. **Authorization Layer**: RBAC middleware, role checks
4. **Data Layer**: PostgreSQL RLS, tenant isolation queries
5. **Application Layer**: Input validation (Zod), output sanitization

### Encryption

| Data Type | Method |
|-----------|--------|
| Passwords | bcrypt (via Supabase Auth) |
| Sensitive Fields | AES-256-GCM |
| CSRF Tokens | HMAC-SHA256 |
| Session Data | Signed JWT |

### Audit Logging

All security-relevant actions are logged to `audit_logs` table:
- User authentication events
- SuperAdmin actions
- Data modifications
- Permission changes
- API key rotations

---

## Integration Architecture

### OAuth Integrations

| Service | Scope | Data Synced |
|---------|-------|-------------|
| Google Analytics 4 | Agency | Website metrics, lead events |
| Google Search Console | Agency | Search performance, keywords |
| HubSpot | Agency | Contacts, Companies, Deals |
| LinkedIn | Agency | Organization page metrics |

### AI Provider Architecture

```
┌─────────────────────────────────────────────┐
│           AI Provider Interface             │
│  ┌───────────────┐  ┌───────────────────┐  │
│  │ generateText()│  │ generateRecommend()│  │
│  └───────────────┘  └───────────────────┘  │
└─────────────────────────────────────────────┘
           │                    │
           ▼                    ▼
┌─────────────────┐  ┌─────────────────────┐
│  OpenAI Provider │  │  Gemini Provider   │
│  (GPT-4)         │  │  (Gemini Pro)      │
└─────────────────┘  └─────────────────────┘
```

---

## Database Schema Overview

### Core Tables

| Table | Purpose |
|-------|---------|
| `agencies` | Multi-tenant organization entities |
| `profiles` | User profiles linked to Supabase Auth |
| `clients` | Client entities per agency |
| `projects` | Projects per client |
| `task_lists` | Task groupings per project |
| `tasks` | Individual work items |
| `staff_assignments` | Task-to-staff mapping |
| `invoices` | Billing records |
| `strategic_initiatives` | AI recommendations |
| `audit_logs` | Security audit trail |

### Row-Level Security

40 RLS policies across 14 tables ensure tenant isolation at the database level, using Supabase's `auth.jwt()` for app_metadata access.

---

## Performance Optimizations

1. **Server-Side Caching**: Frequently accessed data cached in memory
2. **Aggregated APIs**: Batch endpoints reduce round trips
3. **Query Optimization**: Indexed columns, efficient joins
4. **Component Memoization**: React.memo for expensive renders
5. **Lazy Loading**: Route-based code splitting

---

## Deployment Architecture

```
┌─────────────────────────────────────────────┐
│                  Replit                      │
│  ┌─────────────────────────────────────────┐│
│  │         Application Server              ││
│  │  ┌─────────────┐  ┌─────────────────┐  ││
│  │  │   Express   │  │   Vite (Dev)    │  ││
│  │  │   Backend   │  │   React Frontend│  ││
│  │  └─────────────┘  └─────────────────┘  ││
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│              Supabase                        │
│  ┌─────────────┐  ┌─────────────────────┐  │
│  │  PostgreSQL │  │   Auth Service      │  │
│  │  Database   │  │   (JWT, OAuth)      │  │
│  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────┘
```

---

## Workflow Engine Architecture

### Overview

The platform includes a deterministic workflow orchestration engine for automated processing of signals, rule evaluation, and action execution.

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│                      Workflow Engine                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Signal    │  │    Rule     │  │   Action/Transform      │ │
│  │   Handler   │──▶│   Engine    │──▶│   Handlers             │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│         │                │                      │               │
│         ▼                ▼                      ▼               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Transaction Manager (Atomic)                    ││
│  └─────────────────────────────────────────────────────────────┘│
│         │                │                      │               │
│         ▼                ▼                      ▼               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Executions  │  │   Events    │  │   Evaluations           │ │
│  │   Table     │  │   Table     │  │   Table                 │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Step Types

| Step Type | Description |
|-----------|-------------|
| `signal` | Match incoming signals by type/source |
| `rule` | Evaluate conditions (inline or versioned rules) |
| `action` | Execute business logic (create projects, tasks, invoices) |
| `transform` | Modify execution context data |
| `notification` | Send alerts and notifications |
| `branch` | Conditional workflow branching |

### Rule Engine

The rule engine supports 16 operators:

| Category | Operators |
|----------|-----------|
| Standard | eq, neq, gt, gte, lt, lte |
| String | contains, not_contains, starts_with, ends_with |
| Collection | in, not_in, is_null, is_not_null |
| Threshold | percent_change_gt, percent_change_lt |
| Anomaly | anomaly_zscore_gt |
| Lifecycle | inactivity_days_gt, changed_to, changed_from |

### Key Guarantees

1. **Atomicity**: All step executions wrapped in database transactions
2. **Idempotency**: Duplicate inputs return cached results via content hashing
3. **Auditability**: Every step event logged with timing and results
4. **Determinism**: Identical inputs produce identical outputs

---

## Visual Workflow Builder

### Overview

A no-code visual workflow editor using React Flow (@xyflow/react) for drag-and-drop workflow creation.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  Visual Workflow Builder                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌─────────────────────┐  ┌───────────────┐  │
│  │ Step Palette │  │   React Flow Canvas  │  │  Properties   │  │
│  │              │  │                      │  │    Panel      │  │
│  │  Signal      │  │   ┌─────┐            │  │               │  │
│  │  Rule        │  │   │Node │──────┐     │  │  Name:        │  │
│  │  AI          │  │   └─────┘      │     │  │  Config:      │  │
│  │  Action      │  │        │       ▼     │  │  Variables:   │  │
│  │  Transform   │  │        ▼    ┌─────┐  │  │               │  │
│  │  Notification│  │   ┌─────┐   │Node │  │  │               │  │
│  │  Branch      │  │   │Node │   └─────┘  │  │               │  │
│  │              │  │   └─────┘            │  │               │  │
│  └──────────────┘  └─────────────────────┘  └───────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Step Types

| Step Type | Color | Description |
|-----------|-------|-------------|
| Signal | Yellow | Entry point triggers (workflow start) |
| Rule | Blue | Conditional logic evaluation |
| AI | Purple | AI-powered processing steps |
| Action | Green | Business logic operations |
| Transform | Orange | Data transformation steps |
| Notification | Pink | Alert and notification steps |
| Branch | Cyan | Conditional flow branching |

### Routes

| Route | Description |
|-------|-------------|
| `/agency/workflows` | Workflow list with CRUD operations |
| `/agency/workflow-builder/:id?` | Visual canvas editor |

### Backend API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/workflows/validate` | POST | Zod schema validation for workflow structure |
| `/api/workflows/:id/duplicate` | POST | Clone workflow with tenant isolation |

---

## Intelligence Core

The Intelligence Core provides AI-augmented decision-making across the platform. It consists of three major subsystems that work together to learn from outcomes and improve recommendation quality.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          INTELLIGENCE CORE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐    │
│  │ DURATION           │  │ CLOSED FEEDBACK    │  │ BRAND KNOWLEDGE    │    │
│  │ INTELLIGENCE       │  │ LOOP               │  │ LAYER              │    │
│  │ ─────────────────  │  │ ─────────────────  │  │ ─────────────────  │    │
│  │ • Duration Model   │  │ • Outcome Tracking │  │ • Knowledge Cats   │    │
│  │ • Resource Optim   │  │ • Quality Metrics  │  │ • Client Knowledge │    │
│  │ • Commercial Score │  │ • AI Calibration   │  │ • Ingestion Logs   │    │
│  └─────────┬──────────┘  └─────────┬──────────┘  └─────────┬──────────┘    │
│            │                       │                       │                 │
│            └───────────────────────┼───────────────────────┘                 │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        Storage Layer                                  │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐  │   │
│  │  │ Execution    │ │ Outcomes     │ │ Knowledge    │ │ Calibration │  │   │
│  │  │ History      │ │ & Metrics    │ │ Documents    │ │ Parameters  │  │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └─────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Duration Intelligence

Predicts task duration and optimizes resource allocation.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     DURATION PREDICTION PIPELINE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Task Created                                                                │
│       │                                                                      │
│       ▼                                                                      │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                   │
│  │ Heuristic   │────▶│ Assignee    │────▶│ Client      │                   │
│  │ Baseline    │     │ Offset      │     │ Adjustment  │                   │
│  │ (task type) │     │ (skill fit) │     │ (complexity)│                   │
│  └─────────────┘     └─────────────┘     └─────────────┘                   │
│       │                                         │                           │
│       └───────────┬─────────────────────────────┘                           │
│                   ▼                                                          │
│           ┌─────────────┐                                                   │
│           │ Predicted   │  + Confidence Score (0-1)                        │
│           │ Duration    │  + Sample Count                                  │
│           └─────────────┘  + Variance Factor                               │
│                   │                                                          │
│                   ▼                                                          │
│           ┌─────────────┐                                                   │
│           │ Resource    │ → Greedy allocation by skill + capacity          │
│           │ Optimizer   │ → Minimize overload + SLA breach risk            │
│           └─────────────┘                                                   │
│                   │                                                          │
│                   ▼                                                          │
│           ┌─────────────┐                                                   │
│           │ Commercial  │ → Priority scoring by revenue + risk             │
│           │ Impact      │ → SLA breach alerts                              │
│           └─────────────┘                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Services:**
- `DurationModelService` — Layered prediction with confidence scoring
- `ResourceOptimizerService` — Greedy allocation algorithm
- `CommercialImpactService` — Priority queue generation

**Tables:**
- `task_execution_history` — Completed task duration records
- `task_duration_predictions` — Prediction logs with variance
- `resource_capacity_profiles` — Staff capacity per period
- `resource_allocation_plans` — Recommended assignments
- `commercial_impact_factors` — Scoring weights

### Closed Feedback Loop

Tracks recommendation outcomes to improve AI accuracy over time.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FEEDBACK LOOP FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  AI Recommendation Generated                                                 │
│            │                                                                 │
│            ▼                                                                 │
│  ┌──────────────────┐                                                       │
│  │ Initiative       │ ← Strategic Initiative created with prediction       │
│  │ Created          │                                                       │
│  └────────┬─────────┘                                                       │
│           │                                                                  │
│           ▼                                                                  │
│  ┌──────────────────┐     ┌──────────────────┐                             │
│  │ Client Reviews   │────▶│ Accepted /       │ ← Fire-and-forget capture   │
│  │                  │     │ Rejected         │                              │
│  └──────────────────┘     └────────┬─────────┘                             │
│                                    │                                         │
│                                    ▼                                         │
│                    ┌───────────────────────────────┐                        │
│                    │     OUTCOME FEEDBACK SERVICE   │                        │
│                    │  ────────────────────────────  │                        │
│                    │  • captureOutcome()           │                        │
│                    │  • recordActualOutcome()      │                        │
│                    │  • calculateImpactVariance()  │                        │
│                    └───────────────┬───────────────┘                        │
│                                    │                                         │
│           ┌────────────────────────┼────────────────────────┐               │
│           ▼                        ▼                        ▼               │
│  ┌────────────────┐    ┌────────────────┐    ┌────────────────┐            │
│  │ Outcomes Table │    │ Quality Metrics │    │ Calibration    │            │
│  │ (acceptance %) │    │ (per rec type)  │    │ Parameters     │            │
│  └────────────────┘    └────────────────┘    └────────────────┘            │
│                                    │                                         │
│                                    ▼                                         │
│                          ┌─────────────────┐                                │
│                          │ Signal Emitter  │ → Quality threshold breaches  │
│                          └─────────────────┘                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Pattern:** Fire-and-forget integration — outcome capture never blocks client response.

**Services:**
- `OutcomeFeedbackService` — Outcome capture and variance calculation

**Tables:**
- `recommendation_outcomes` — Acceptance/rejection records
- `recommendation_quality_metrics` — Rolling quality scores
- `ai_calibration_parameters` — Confidence adjustments

### Brand Knowledge Layer

Structured knowledge ingestion for AI context assembly.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      KNOWLEDGE MANAGEMENT FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     KNOWLEDGE CATEGORIES                              │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │ Brand    │ │ Business │ │ Competitor│ │ Historical│ │ Ops      │   │   │
│  │  │ Voice    │ │ Rules    │ │ Info     │ │ Decisions │ │ Notes    │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│                    ┌───────────────────────────────┐                        │
│                    │   KNOWLEDGE INGESTION SERVICE  │                        │
│                    │  ────────────────────────────  │                        │
│                    │  • ingestKnowledge()          │                        │
│                    │  • validateAgainstSchema()    │                        │
│                    │  • detectConflicts()          │                        │
│                    │  • createVersion()            │                        │
│                    └───────────────┬───────────────┘                        │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      CLIENT KNOWLEDGE TABLE                           │   │
│  │  ┌──────────────────────────────────────────────────────────────┐    │   │
│  │  │ id │ clientId │ categoryId │ title │ content │ status │ v  │    │   │
│  │  ├──────────────────────────────────────────────────────────────┤    │   │
│  │  │ 1  │ c001     │ brand_voice│ Tone  │ Formal..│ active │ 2  │    │   │
│  │  │ 2  │ c001     │ competitor │ Comp A│ Website.│ active │ 1  │    │   │
│  │  └──────────────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│                    ┌───────────────────────────────┐                        │
│                    │   KNOWLEDGE RETRIEVAL SERVICE  │                        │
│                    │  ────────────────────────────  │                        │
│                    │  • getContextForClient()      │ → Freshness weighting  │
│                    │  • getKnowledgeByCategory()   │ → Category filtering   │
│                    │  • assembleAIContext()        │ → AI prompt enrichment │
│                    └───────────────────────────────┘                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Services:**
- `KnowledgeIngestionService` — Validation, versioning, conflict detection
- `KnowledgeRetrievalService` — Freshness-weighted retrieval

**Tables:**
- `knowledge_categories` — Category definitions with schemas
- `client_knowledge` — Versioned knowledge documents
- `knowledge_ingestion_log` — Audit trail for changes

**UI:** `/agency/knowledge` — Full CRUD with filtering, search, history

---

## Stability Testing Framework (December 2024)

### Test Infrastructure

The platform includes a comprehensive stability testing framework using Vitest for critical path validation.

```
tests/
├── utils/
│   └── test-helpers.ts       # Mock request/response/storage utilities
├── middleware/
│   ├── auth.test.ts          # 18 tests - Role/SuperAdmin/tenant isolation
│   └── maintenance.test.ts   # 8 tests - Maintenance mode bypass logic
├── sla/
│   └── sla-service.test.ts   # 18 tests - Breach detection/deadline calculation
└── setup.ts                  # Global test configuration
```

### Test Coverage Summary

| Area | Tests | Coverage |
|------|-------|----------|
| Auth Middleware | 18 | Role-based access, SuperAdmin bypass, cross-tenant rejection |
| Maintenance Middleware | 8 | SuperAdmin bypass, auth endpoint allowlist, 503 response |
| SLA Service | 18 | Deadline calculation (business hours), breach detection |
| **Total Stability Tests** | **44** | Critical path validation |

### Middleware Chain (Updated)

The production middleware chain enforces security at multiple layers:

```typescript
Request → [requestId] → [logger] → [rateLimiter] → [maintenanceMiddleware] →
          [requireAuth] → [requireRole] → [agencyContext] → [zodValidate] →
          [Route Handler] → [errorHandler] → [structuredLog]
```

**Middleware Components:**

| Middleware | Purpose | Tests |
|------------|---------|-------|
| `maintenanceMiddleware` | Block non-SuperAdmin during maintenance | 8 tests |
| `requireAuth` | Validate JWT session | 6 tests |
| `requireRole` | RBAC enforcement | 4 tests |
| `requireSuperAdmin` | Platform admin access | 3 tests |
| `agencyContext` | Tenant isolation resolution | 5 tests |

### Error-Handling Pipeline

```typescript
// Async handler wrapper with structured error handling
async (req, res, next) => {
  try {
    // Route handler logic
    const result = await storage.operation();
    res.json(result);
  } catch (error) {
    // Structured Winston logging
    logger.error('Operation failed', {
      service: 'agency-client-portal',
      userId: req.user?.id,
      path: req.path,
      error: error.message,
      stack: error.stack
    });
    
    // Standard error response
    res.status(500).json({
      error: 'internal_error',
      message: error.message
    });
  }
}
```

### Stability Guardrails

1. **Cross-Tenant Protection** — All storage methods filter by `agencyId`; tests verify rejection of cross-agency access
2. **SuperAdmin Bypass** — Tested separately to ensure platform-wide access works correctly
3. **SLA Breach Detection** — Boundary condition tests verify exact deadline behavior
4. **Maintenance Mode** — Auth endpoints remain accessible; all others blocked for non-SuperAdmin

---

## Completed Enhancements (December 2024)

- [x] WebSocket/SSE real-time updates
- [x] Visual workflow builder UI (in progress)
- [x] Signal processing pipeline for external integrations
- [x] Multi-agent architecture
- [x] SLA & escalation engine
- [x] Tenant-isolated vector stores
- [x] SuperAdmin governance dashboard
- [x] Duration Intelligence (prediction, optimization, commercial scoring)
- [x] Closed Feedback Loop (outcome tracking, quality metrics, calibration)
- [x] Brand Knowledge Layer (structured ingestion, versioning, retrieval)
- [x] **Stability Testing Framework** — 44 tests covering auth, SLA, maintenance middleware

## Future Enhancements

- [ ] Advanced reporting with export capabilities
- [ ] White-label mobile app support
- [ ] Multi-language support (i18n)
- [ ] Advanced AI model selection per task type
- [ ] Workflow version comparison UI
- [ ] Test execution mode with mock signals
- [ ] Knowledge graph visualization
- [ ] Cross-client pattern learning (with governance)

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [TECHNICAL_BRIEF.md](./TECHNICAL_BRIEF.md) | Implementation patterns, API contracts |
| [PRIORITY_LIST.md](./PRIORITY_LIST.md) | Roadmap, priorities, technical debt |
| [docs/maintenance-matrix.md](./docs/maintenance-matrix.md) | Module health scores, cleanup queue |
| [docs/frontend-backend-map.md](./docs/frontend-backend-map.md) | API integration mapping |
| [replit.md](./replit.md) | Quick reference for development |

---

*Last Updated: December 2024*
