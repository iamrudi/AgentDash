# Agency Client Portal

## Overview
The Agency Client Portal is a multi-tenant, workflow-driven operating system designed for automating client delivery, orchestrating AI systems, and enforcing deterministic operational flows for agencies. Its core purpose is to provide a robust, auditable, and reproducible platform for managing client projects and tasks. The system prioritizes strict tenant isolation, deterministic behavior, atomic transactions, and workflow lineage across all features, APIs, and automations. The project aims to serve as a comprehensive engine for agency operations, with all front-end, back-end, and AI execution layers acting as interfaces to this central engine.

## User Preferences
The system is a Workflow Engine, not a traditional app. Frontend, backend, and AI execution layers exist only as interfaces into this engine. A component is only accepted into the system if new features can be added without modifying its internal implementation. This rule guarantees long-term stability, predictable behavior, and rapid feature development. Every module (services, workflows, integrations, AI providers, UI panels) must expose explicit interfaces, handle external inputs through adapters, and never require internal rewrites to support new behaviors. If a new feature requires editing core logic, the component is rejected. All automation, rules, triggers, tasks, CRM events, and AI flows extend the Workflow Engine — not the underlying codebase. New features are implemented by adding new signal types, adding new rules, adding new DAG workflows, adding new AI prompt templates, and adding new output handlers. The core engine remains untouched. AI providers, CRM providers, integration adapters, and PDF generators must follow the same contract pattern. Refactoring is never “just new code.” Every refactor must also drive explicit cleanup and deletion work, tracked in PRIORITY_LIST.md. The system does not permit “orphaned” or “temporary” code: no undocumented feature flags, no unused endpoints, no unreachable branches, no abandoned experiments. If code is not clearly active and clearly documented and clearly referenced in TECHNICAL_BRIEF.md, then it must either be deleted, or be added as a cleanup/deletion item in PRIORITY_LIST.md. A refactor is only acceptable if new behavior is documented in TECHNICAL_BRIEF.md, cleanup/deletion work is listed in PRIORITY_LIST.md, and no new untracked legacy paths are introduced. If any of the three fails, the refactor is rejected and must be reworked.

## System Architecture
The system is fundamentally a Workflow Engine. It uses a macOS-inspired UI built with React 18, Wouter, TanStack Query, Tailwind, and Shadcn/UI, ensuring mobile-first compliance (WCAG AA). The backend is an Express.js application with deterministic service boundaries. Data persistence is handled by PostgreSQL (Supabase) with Drizzle ORM, and authentication uses stateless JWT via Supabase Auth. A pluggable AI layer supports providers like Gemini and OpenAI. PDF generation uses Puppeteer, and scheduling is managed by `node-cron`. The core is a custom deterministic workflow orchestration layer.

Key architectural guarantees include:
- **Atomicity:** All multi-table operations use `db.transaction()` to ensure no partial writes or orphaned state.
- **Tenant Isolation:** Implemented at three layers: app-level access control, PostgreSQL Row Level Security (RLS) on core tables, and route-level resource ownership enforcement.
- **Deterministic AI Execution:** AI outputs are schema-validated, idempotent, versioned, hash-tracked, logged with lineage, and replayable, preventing direct state creation outside the workflow engine.

The frontend employs React Hook Form with Zod for validation, TanStack Query for data fetching with strict caching, and dialog-driven operations. Performance is optimized through memoization, co-location of state, and batched requests.

The backend consists of modular services (Auth, Task, Project, Client, CRM, Integration, AI, Workflow Engine, Invoice/PDF, Audit Log) and middleware for authentication, authorization, payload sanitization, and schema validation. Real-time communication uses Server-Sent Events (SSE) with a polling fallback.

The Workflow Engine processes external signals from various sources (GA4, GSC, HubSpot, LinkedIn, Internal) using a Rule Engine with 16 operators for data evaluation before AI processing. The AI execution layer provides provider abstraction, retry logic, schema validation, and lineage logging. Workflow outputs include creating projects, tasks, invoices, updating initiative states, and staff notifications—all within atomic transactions.

The AI system features a provider interface (`generateText()`, `generateRecommendation()`, `generateAnalysis()`), per-agency governance for model usage, token quotas, cost ceilings, PII redaction, and prompt templates. Analytics data uses agency-isolated vector indices for "Chat With Your Data" functionality.

Integrations with GA4, GSC, HubSpot, and LinkedIn are idempotent, handle metric aggregation, anomaly detection, bi-directional sync, and include retry logic and token expiry detection. The CRM layer covers Companies, Contacts, Deals, Pipelines, Lead Sources, and a Form Creator, with all CRM operations emitting workflow signals.

The Task System supports a hierarchical structure (Projects → Lists → Tasks → Subtasks) with various relationship types, a full audit trail of activities, real-time messaging, time tracking, and robust security at five layers. Strategic Initiatives follow a lifecycle (`Draft → Needs Review → Approved → In Progress → Completed → Measured`), triggering atomic workflows upon approval.

The SuperAdmin layer provides cross-agency visibility, management of agencies and users, billing insights, AI policy governance, integration oversight, and audit log search. The SLA & Escalation Engine tracks response/resolution times, supports business hours, multi-level escalation chains, and defines breach actions. The Multi-Agent Architecture includes specialized domain agents (SEO, PPC, CRM, Reporting) and an Orchestrator for intelligent routing and collaboration, integrating seamlessly as a workflow step.

Security is multi-layered, encompassing HTTPS, CORS, rate limits, JWT auth, RBAC middleware, PostgreSQL RLS, input/output validation (Zod), and extensive audit logging. Encryption uses AES-256-GCM, bcrypt, and HMAC-SHA256. Performance optimizations include server-side caching, aggregated APIs, indexed SQL tables, lazy loading, and `React.memo` discipline.

The project is deployed on Replit, using Express for the backend, Vite for the frontend, Supabase for DB/Auth, Replit environment variables for secrets, and `node-cron` for scheduled tasks.

## External Dependencies
- **Database:** PostgreSQL (via Supabase)
- **Authentication:** Supabase Auth
- **Frontend Frameworks/Libraries:** React 18, Wouter, TanStack Query, Tailwind CSS, Shadcn/UI, React Hook Form, Zod
- **Backend Frameworks/Libraries:** Express.js, Drizzle ORM
- **AI Providers:** Gemini, OpenAI (pluggable system)
- **PDF Generation:** Puppeteer
- **Scheduler:** node-cron
- **Icons:** Lucide icons
- **Integrations:** Google Analytics 4 (GA4), Google Search Console (GSC), HubSpot, LinkedIn