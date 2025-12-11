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

# 5. Workflow Engine (Core) ✅ IMPLEMENTED

**Status**: Priorities 1-5 Complete (December 2024)

## Implementation Files
- `server/workflow/engine.ts` - WorkflowEngine class with step execution
- `server/workflow/rule-engine.ts` - RuleEngine with 16 operators
- `shared/schema.ts` - Workflow and rule table definitions
- `scripts/test-workflow.ts` - Regression test suite

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

## Rules Engine ✅ IMPLEMENTED
Rules run before AI with 16 operators:
- **Standard**: eq, neq, gt, gte, lt, lte
- **String**: contains, not_contains, starts_with, ends_with
- **Collection**: in, not_in, is_null, is_not_null
- **Threshold**: percent_change_gt, percent_change_lt
- **Anomaly**: anomaly_zscore_gt (Z-score calculation)
- **Lifecycle**: inactivity_days_gt, changed_to, changed_from

Rules are versioned (draft → published → deprecated) and auditable.
12 API endpoints for rule CRUD with Zod validation.

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

# 12. SLA & Escalation Engine ✅ IMPLEMENTED (December 2024)

## Implementation Files
- `server/sla/sla-service.ts` - SlaService class with breach detection and escalation
- `server/sla/sla-cron.ts` - Automated monitoring every 5 minutes
- `server/sla/sla-routes.ts` - API endpoints for SLA CRUD and management
- `shared/schema.ts` - SLA tables (sla_definitions, sla_breaches, escalation_chains)

## Schema
- **sla_definitions**: Agency-scoped SLA policies with response/resolution times
- **sla_breaches**: Tracked breach records with lifecycle (detected → acknowledged → escalated → resolved)
- **sla_breach_events**: Full audit trail of breach state changes
- **escalation_chains**: Multi-level escalation with profile assignment and actions

## Features
- Response time and resolution time tracking
- Business hours support with configurable start/end times
- Multi-level escalation chains with automatic reassignment
- Breach actions: notify (in-app/email), reassign, escalate, pause_billing
- Full breach lifecycle management with audit trail
- Manual scan trigger for immediate breach detection
- Per-client and per-project SLA policies

## Security
- All endpoints enforce strict agency-scoped queries
- Update endpoints use validated schemas to prevent field tampering
- No query parameter overrides allowed for agencyId
- Parameterized queries prevent SQL injection

## API Endpoints
- `GET/POST /api/sla/definitions` - List/create SLA definitions
- `GET/PATCH/DELETE /api/sla/definitions/:id` - Single SLA operations
- `GET/POST /api/sla/definitions/:id/escalations` - Escalation chain management
- `GET /api/sla/breaches` - List breaches with filtering
- `GET /api/sla/breaches/:id` - Breach details with events
- `POST /api/sla/breaches/:id/acknowledge` - Acknowledge breach
- `POST /api/sla/breaches/:id/resolve` - Resolve breach
- `POST /api/sla/scan` - Trigger manual breach scan
- `GET /api/sla/check/:resourceType/:resourceId` - Check SLA compliance

---

# 13. Security Model

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

## 17.7 Refactor-Driven Cleanup & Deletion

Refactoring is never “just new code.”  
Every refactor must also drive explicit cleanup and deletion work, tracked in PRIORITY_LIST.md.

### 17.7.1 Refactor Rules

For any change that alters behaviour, structure, or ownership of code:

1. **Identify obsolete code paths**
   - legacy modules
   - unused functions
   - dead feature flags
   - duplicated logic
   - abandoned experiments

2. **Decide in the same change:**
   - **Delete now**: remove obsolete code in the same PR where possible, or  
   - **Schedule deletion**: if immediate removal is risky, mark clearly as deprecated and schedule removal as a task.

3. **Update PRIORITY_LIST.md**
   - Add explicit tasks for:
     - code cleanup
     - module deletion
     - migration completion
   - Each task must include:
     - module / area
     - scope of cleanup or deletion
     - dependency notes
     - owner (or role)
     - deadline / sprint

4. **Update TECHNICAL_BRIEF.md**
   - Document:
     - what was refactored
     - what is now considered deprecated
     - which behaviours moved to new components
     - when old paths are expected to be removed
     - impact on workflows and integrations

### 17.7.2 No Zombie Code Policy

The system does not permit “orphaned” or “temporary” code:

- no undocumented feature flags
- no unused endpoints
- no unreachable branches
- no abandoned experiments

If code is not:
- clearly active **and**
- clearly documented **and**
- clearly referenced in TECHNICAL_BRIEF.md,

then it must either:
- be deleted, or  
- be added as a cleanup/deletion item in PRIORITY_LIST.md.

### 17.7.3 Refactor Acceptance Test

A refactor is only acceptable if all three are true:

1. New behaviour is documented in TECHNICAL_BRIEF.md  
2. Cleanup/deletion work is listed in PRIORITY_LIST.md  
3. No new untracked legacy paths are introduced

If any of the three fails, the refactor is **rejected** and must be reworked.

---

---
