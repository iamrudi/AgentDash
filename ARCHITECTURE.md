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

## Future Enhancements

- [ ] WebSocket-based real-time updates (replacing polling)
- [ ] Advanced reporting with export capabilities
- [ ] White-label mobile app support
- [ ] Webhook integrations for external systems
- [ ] Multi-language support (i18n)
- [ ] Advanced AI model selection per task type

---

*Last Updated: December 2024*
