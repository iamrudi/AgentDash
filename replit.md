# Agency Operational Intelligence Platform — Replit Documentation

## Purpose

This repository contains the unified **Operational Intelligence System** for marketing agencies and in-house teams. It is a **multi-tenant, workflow-driven, AI-augmented operating system** that:

- connects data from analytics, CRM, commercial systems, and internal knowledge  
- generates strategic recommendations through a central Intelligence Core  
- enables human interpretation and approval  
- converts strategy into structured projects and tasks  
- orchestrates human and AI delivery resources  
- continually learns from outcomes  

The entire platform operates on a **single deterministic workflow engine**, with front-end, back-end, and AI layers acting only as interfaces to this engine.

---

# 1. Architectural Principles

## 1.1 Core Philosophy

This system is **not a traditional application**.  
It is a **Workflow Engine** that orchestrates:

- deterministic automations  
- AI reasoning and generation  
- client delivery  
- CRM activity  
- analytics ingestion  
- multi-agent collaboration  

Every component — UI panels, backend services, integrations, AI providers — plugs into the workflow engine through **explicit contracts**.

**If a feature requires editing core logic, it is rejected.**  
All changes must be additive via:

- new signal types  
- new rules  
- new workflow DAGs  
- new AI prompt templates  
- new output handlers  

The core engine remains untouched.

## 1.2 Refactor & Cleanup Rules

Refactors must:

1. Document all new behavior in `TECHNICAL_BRIEF.md`
2. Register any cleanup/deletion work in `PRIORITY_LIST.md`
3. Introduce **zero** new untracked legacy paths

The system forbids:

- undocumented feature flags  
- unused endpoints  
- unreachable branches  
- abandoned experiments  

Inactive or undocumented code must be deleted or added to `PRIORITY_LIST.md`.

---

# 2. High-Level Architecture

📄 Source: *Architecture Documentation* :contentReference[oaicite:7]{index=7}

## 2.1 Technology Stack

| Layer | Technology |
|-------|------------|
| Backend | Express.js, Node.js |
| Frontend | React 18, Wouter, TanStack Query, Tailwind, Shadcn/UI |
| Database | PostgreSQL (Supabase) with Drizzle ORM |
| Auth | Supabase Auth (JWT session) |
| AI Engine | Pluggable providers: OpenAI, Gemini |
| Integrations | GA4, GSC, HubSpot, LinkedIn |
| Workflow Engine | Custom deterministic orchestration layer |
| Scheduling | node-cron |
| PDF | Puppeteer |
| Replit | Hosting + env vars |

---

# 3. Multi-Tenancy & Access Model

The system supports four portals:

- **Agency Portal** (`/agency`)  
- **Client Portal** (`/client`)  
- **Staff Portal** (`/staff`)  
- **SuperAdmin Portal** (`/superadmin`)  

Multi-tenancy is enforced at three layers:

1. **App Layer:** role-based access middleware  
2. **Database Layer:** PostgreSQL Row-Level Security (RLS)  
3. **Resource Layer:** route-level ownership checks  

This ensures **strict tenant isolation** and shared infrastructure.

---

# 4. Intelligence Core

The Intelligence Core is composed of:

### 4.1 AI Provider Layer
- Unified interface:
  - `generateText()`
  - `generateRecommendation()`
  - `generateAnalysis()`
- Provider implementations (OpenAI, Gemini)
- Per-agency governance:
  - model policy  
  - token quotas  
  - cost ceilings  
  - PII redaction  
- Deterministic AI execution:
  - schema validation  
  - idempotency  
  - output hashing  
  - lineage logging  

### 4.2 Multi-Agent Architecture
Specialist agents:
- SEO, PPC, CRM, Reporting  
An **Orchestrator Agent** coordinates reasoning and routes tasks into workflows.

### 4.3 Tenant-Isolated Vector Memory
Stores:
- analytics summaries  
- CRM signals  
- content history  
- strategic notes  
- task outcomes  

Used for:
- contextual retrieval  
- brand knowledge modeling  
- improved recommendation quality  

---

# 5. Workflow Engine

The heart of the system.

## 5.1 Step Types
- **Signal** — triggers (analytics, CRM, internal)  
- **Rule** — evaluate conditions with 16 operators  
- **AI** — call intelligence core  
- **Action** — create/update resources  
- **Transform** — modify context  
- **Notification** — staff/client alerts  
- **Branch** — conditional logic  

## 5.2 Guarantees
- **Determinism** — identical inputs → identical outputs  
- **Atomicity** — all steps run inside database transactions  
- **Idempotency** — input hashing prevents duplicates  
- **Auditability** — every step logged, timestamped, replayable  

## 5.3 Data Tables
- workflow_executions  
- workflow_events  
- rule_evaluations  

---

# 6. Strategic Initiatives (Human-in-the-loop AI)

Lifecycle:  
**Draft → Needs Review → Approved → In Progress → Completed → Measured** :contentReference[oaicite:8]{index=8}

Upon approval, workflows generate:

- projects  
- task lists  
- tasks  
- optional invoices  

This fulfills the “interpret → challenge → approve → deliver → learn” loop from your vision.

---

# 7. Task, Project & CRM System

Hierarchy:  
**Projects → Task Lists → Tasks → Subtasks** :contentReference[oaicite:9]{index=9}

Features:
- real-time messaging  
- time tracking  
- audit history  
- staff assignments  

CRM entities:  
**Companies, Contacts, Deals, Pipelines, Lead Sources, Forms** — all emitting workflow signals.

---

# 8. Integrations & Data Engine

Supported integrations (OAuth-based):

- GA4  
- Google Search Console  
- HubSpot  
- LinkedIn  

Each sync produces **signals** into the workflow engine.  
Capabilities:  
- metric aggregation  
- anomaly detection  
- retry logic  
- token expiry detection  

---

# 9. Portals & User Interfaces

### 9.1 Agency Portal
Full admin interface:
- clients  
- projects  
- staff  
- tasks  
- initiatives  
- invoices  
- workflows  
- settings  

### 9.2 Client Portal
Read-focused:
- dashboard  
- projects  
- invoices  
- strategic recommendations  
- reporting  
- support  

### 9.3 Staff Portal
Task-focused:
- my tasks  
- hours  
- settings  

### 9.4 SuperAdmin Portal
Platform governance:
- agencies  
- users  
- audit logs  
- AI usage & model policies  
- system health  

---

# 10. Security Model

Defense-in-depth:

- HTTPS, CORS, rate limits  
- JWT authentication  
- RBAC middleware  
- PostgreSQL RLS  
- Zod validation  
- AES-256-GCM encryption  
- HMAC-SHA256 signatures  
- full audit logging  

The SuperAdmin layer has strict read/write separation and fully audited actions.

---

# 11. Visual Workflow Builder

Drag-and-drop DAG builder using **React Flow**:

- step palette  
- canvas  
- node linking  
- properties panel (WIP)  
- validation endpoint  
- duplicate workflow action  

Routes:  
- `/agency/workflows`  
- `/agency/workflow-builder/:id?`

---

# 12. Deployment (Replit)

The platform runs on Replit using:

- Express backend  
- Vite dev server for frontend  
- Supabase (DB + Auth)  
- env vars for secrets  
- node-cron for scheduled tasks  

---

# 13. Recent Changes (December 2024)

- Workflow builder UI (Priority 15)  
- Enhanced analytics ingestion  
- SLA & escalation engine  
- Vector memory isolation  
- Multi-agent system  
- SuperAdmin governance  

---

# 14. Future Enhancements

- Workflow version comparison  
- Test execution sandbox  
- Advanced reporting  
- Mobile app support  
- i18n support  
- AI task-type model selection  

---

# 15. Getting Started

1. Clone repository  
2. Configure Replit secrets  
3. Start backend: `npm run dev`  
4. Start frontend: Vite auto-serves React  
5. Run cron tasks automatically via node-cron  

---

*Last Updated: December 2024*
