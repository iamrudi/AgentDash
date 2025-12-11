# Agency Client Portal — Engineering Architecture (Replit Edition)

## Purpose
Multi-tenant, workflow-driven agency OS for automating client delivery, orchestrating AI systems, and enforcing deterministic operational flows.  
All features, APIs, and automations must uphold:
- strict tenant isolation  
- deterministic behaviour  
- atomic transactions  
- auditability  
- reproducibility  
- workflow lineage

Replit is the execution surface; the architecture is engine-first.

---

# 1. Architecture Model

## Core Principle
The system is a **Workflow Engine**, not a traditional app.  
Frontend, backend, and AI execution layers exist only as interfaces into this engine.

## Components
- **Frontend**: React 18, Wouter, TanStack Query, Tailwind, Shadcn/UI  
- **Backend**: Express.js with deterministic service boundaries  
- **Database**: PostgreSQL (Supabase), Drizzle ORM  
- **Auth**: Supabase Auth (stateless JWT)  
- **AI Layer**: Pluggable provider system (Gemini, OpenAI)  
- **PDF**: Puppeteer  
- **Scheduler**: node-cron  
- **Workflow Engine**: custom deterministic orchestration layer

---

# 2. Mandatory Engineering Guarantees

## Atomicity
All multi-table operations must run inside `db.transaction()`.  
No partial writes. No orphaned state.  
Every initiative → project → task workflow is fully atomic.

## Tenant Isolation
Three layers:
1. **App**: requireAgencyAccess, requireTaskAccess  
2. **DB**: RLS on all 14 core tables, 40+ policies  
3. **Resource**: route-level ownership enforcement  

SuperAdmin bypass is read-only unless explicitly escalated.

## Deterministic AI Execution
AI output must be:
- schema validated  
- idempotent  
- versioned  
- hash-tracked  
- logged with lineage  
- replayable  

AI cannot create state without passing through the workflow engine.

---

# 3. Frontend Architecture

- macOS-inspired UI  
- Sidebar with icon-only mode  
- Mobile-first compliance (WCAG AA)  
- Lucide icons  
- React Hook Form + Zod  
- TanStack Query with strict caching and stale-time rules  
- Dialog-driven operations (task detail, strategic initiative review)  
- Hierarchical task system (parent → subtask → subtask…)

Performance constraints:
- memoize expensive components  
- co-locate state near usage  
- batch requests with aggregated endpoints  

---

# 4. Backend Architecture

## Services
- Auth Service  
- Task Service (CRUD, subtasks, assignments, activities, messages)  
- Project Service  
- Client Service  
- CRM Service  
- Integration Service (HubSpot, GA4, GSC, LinkedIn)  
- AI Service  
- Workflow Engine  
- Invoice/PDF Service  
- Audit Log Service  

## Middleware
- requireAuth  
- requireAgencyAccess  
- requireTaskAccess  
- requireSuperAdmin  
- payload sanitisation  
- schema validation  

## Messaging
SSE for real-time client chat + task messaging.  
Polling fallback at 1s interval where required.

---

# 5. Workflow Engine (Core)

## Inputs (Signals)
All external data and app events normalize to:
{
source,
type,
payload,
urgency,
clientId,
agencyId,
timestamp
}

Sources include GA4, GSC, HubSpot, LinkedIn, Internal.

## Rules Engine
Rules run before AI:
- ranking drop thresholds  
- PPC anomaly detection  
- lead lifecycle changes  
- inactivity triggers  

Rules are versioned and auditable.

## AI Execution Layer
- provider abstraction  
- retry logic  
- schema validation  
- idempotent writes using hashing  
- lineage logging  

## Workflow Output
- create projects  
- create task lists  
- batch-create tasks  
- create invoices  
- update initiative state  
- notify staff  

All inside one atomic transaction.

---

# 6. AI Systems

## Provider Interface
generateText()
generateRecommendation()
generateAnalysis()

## Governance
Per-agency controls:
- model allow/deny  
- token quotas  
- cost ceilings  
- PII redaction  
- prompt templates  
- embedding isolation  

## Chat With Your Data
Analytics embedding storage (GA4 / GSC)  
Vector indices are isolated per agency.

---

# 7. Integration Architecture

## GA4 / GSC
- idempotent sync  
- metric aggregation  
- anomaly detection feeding the signal engine  

## HubSpot
- bi-directional sync  
- deal lifecycle triggers  
- contact updates → workflows  

## LinkedIn
- page metrics ingestion  
- engagement drops → signals  

Each integration implements retries, token expiry detection, and backoff.

---

# 8. CRM Layer

Modules:
- Companies  
- Contacts  
- Deals  
- Pipelines  
- Lead Sources  
- Form Creator (public endpoints)  

All CRM operations emit workflow signals.

---

# 9. Task System

## Structure
- Projects → Lists → Tasks → Subtasks  
- Relationship types: blocks, blocked_by, relates_to, duplicates  
- Activities: full audit trail  
- Messaging: internal task chat  

## Capabilities (Completed)
- CRUD for lists/tasks/subtasks  
- Five-layer security  
- Activity tracking (8 event types)  
- Real-time task messaging  
- Time tracking with validated increments  
- Task hours analytics  
- Relationship system with strict RLS controls  
- Auto-create workflow for initiatives  

---

# 10. Strategic Initiatives

Lifecycle:
`Draft → Needs Review → Approved → In Progress → Completed → Measured`

Approved initiative → atomic workflow:
1. create project  
2. create lists  
3. batch-create tasks  
4. optional invoice  
5. notify staff  

All changes logged to audit tables.

---

# 11. SuperAdmin Layer

Capabilities:
- cross-agency visibility  
- agency CRUD  
- user lifecycle management  
- billing insights  
- AI quotas + policies  
- integration governance  
- audit log search + filters  
- platform health metrics  
- read-only impersonation  

SuperAdmin mutations are fully logged.

---

# 12. Security Model

Layers:
1. HTTPS, CORS, rate limits  
2. JWT auth via Supabase  
3. RBAC middleware  
4. PostgreSQL RLS  
5. Input validation (Zod)  
6. Output sanitisation  
7. Audit logging for all sensitive operations  

Encryption:
- AES-256-GCM  
- bcrypt (Supabase)  
- HMAC-SHA256  

---

# 13. Performance Optimisation

- server-side caching  
- aggregated API endpoints  
- indexed SQL tables  
- lazy route loading  
- React.memo discipline  
- reduced query waterfalls  
- agency-isolated vector indexes  
- materialized views for analytics workloads  

---

# 14. Deployment (Replit)

- Express backend  
- Vite frontend  
- Supabase for DB/Auth  
- Secrets in Replit env vars  
- Cron tasks via node-cron  
- Workflow jobs handled as background tasks  
- Logs via Replit inspector  

---

# 15. Future Enhancements (Planned)

- WebSockets for real-time updates  
- Workflow builder UI  
- Webhook system  
- Multi-language support  
- Native mobile shell  
- Model routing per workflow type  

# 16. Maintainability & Extensibility Standard

A component is only accepted into the system if **new features can be added without modifying its internal implementation**.  
This rule guarantees long-term stability, predictable behaviour, and rapid feature development.

## 16.1 Architectural Constraints

### 1. Components must be open for extension, closed for modification
Every module (services, workflows, integrations, AI providers, UI panels) must:
- expose explicit interfaces
- handle external inputs through adapters
- never require internal rewrites to support new behaviours

If a new feature requires editing core logic, the component is rejected.

### 2. Workflow Engine as the primary extension point
All automation, rules, triggers, tasks, CRM events, and AI flows extend the Workflow Engine — not the underlying codebase.

New features are implemented by:
- adding new signal types  
- adding new rules  
- adding new DAG workflows  
- adding new AI prompt templates  
- adding new output handlers  

The core engine remains untouched.

### 3. Provider Architecture Everywhere
AI providers, CRM providers, integration adapters, and PDF generators must follow the same contract pattern:


---
