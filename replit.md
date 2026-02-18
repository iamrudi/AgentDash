# Agency Operational Intelligence Platform

## Overview

This project is a multi-tenant, workflow-driven, AI-augmented operational intelligence system designed for marketing agencies and in-house teams. Its primary purpose is to integrate diverse data sources (analytics, CRM, commercial systems, internal knowledge), generate strategic recommendations via an "Intelligence Core," facilitate human review and approval, and then convert these strategies into structured projects and tasks. The platform orchestrates both human and AI resources for delivery and continually learns from outcomes to refine its processes. The core vision is to provide a unified operating system that streamlines agency operations, enhances strategic decision-making, and improves client delivery through intelligent automation and human-in-the-loop workflows.

## User Preferences

I prefer detailed explanations.
I want an iterative development process.
I expect clear communication regarding progress and any challenges.
Before making major architectural changes or significant code refactors, please ask for approval and provide a brief explanation of the proposed changes and their impact.
I like clean, well-documented code.
I prefer to see a plan before significant implementation begins.
Do not make changes to files outside the explicitly defined scope of a task without prior discussion.

## System Architecture

The system is built around a "Workflow Engine" that acts as the central orchestrator, managing deterministic automations, AI reasoning, client delivery, CRM activities, and analytics ingestion. All components—UI, backend services, integrations, and AI providers—interface with this engine via explicit contracts. The architecture is designed to be additive; changes must extend functionality through new signals, rules, workflows, AI prompt templates, or output handlers, without altering core logic.

The platform employs a multi-tenancy model with four distinct portals: Agency, Client, Staff, and SuperAdmin. Multi-tenancy is enforced at the app layer (role-based access), database layer (PostgreSQL Row-Level Security), and resource layer (route-level ownership checks) to ensure strict tenant isolation.

The Intelligence Core integrates a pluggable AI provider layer (OpenAI, Gemini) for generating text, recommendations, and analysis, with per-agency governance for model policy, token quotas, and PII redaction. It features a multi-agent architecture where specialist agents (SEO, PPC, CRM, Reporting) are coordinated by an Orchestrator Agent. Tenant-isolated vector memory stores contextual data for improved AI recommendations. The system includes predictive duration modeling, resource optimization, and commercial impact services (Duration Intelligence). It also incorporates a closed feedback loop for outcome tracking and AI calibration, and a Brand Knowledge Layer for formalized knowledge ingestion.

The Workflow Engine defines various step types: Signal, Rule, AI, Action, Transform, Notification, and Branch. It guarantees determinism, atomicity (via database transactions), idempotency (input hashing), and full auditability. Strategic initiatives follow a lifecycle from Draft to Measured, generating projects, task lists, and tasks upon approval.

The system includes comprehensive task, project, and CRM functionalities with a hierarchy of Projects → Task Lists → Tasks → Subtasks, supporting real-time messaging, time tracking, and staff assignments. A Visual Workflow Builder provides a drag-and-drop interface for creating and managing workflows.

### Technology Stack:

-   **Backend:** Express.js, Node.js
-   **Frontend:** React 18, Wouter, TanStack Query, Tailwind, Shadcn/UI
-   **Database:** PostgreSQL (Supabase) with Drizzle ORM
-   **Authentication:** Supabase Auth (JWT session)
-   **AI Engine:** Pluggable interface for OpenAI, Gemini
-   **Workflow Engine:** Custom deterministic orchestration layer
-   **Scheduling:** node-cron
-   **PDF Generation:** Puppeteer
-   **Deployment:** Replit

### UI/UX Decisions:

The UI consists of four distinct portals:
-   **Agency Portal:** Full administrative interface for managing clients, projects, staff, tasks, initiatives, invoices, workflows, and settings.
-   **Client Portal:** Read-focused interface for dashboards, projects, invoices, strategic recommendations, reporting, and support.
-   **Staff Portal:** Task-focused interface for managing personal tasks, hours, and settings.
-   **SuperAdmin Portal:** Platform governance for managing agencies, users, audit logs, AI usage, and system health.
-   **Visual Workflow Builder:** Drag-and-drop interface using React Flow for designing workflows.

## External Dependencies

-   **Supabase:** Provides PostgreSQL database, Drizzle ORM integration, and user authentication (Supabase Auth).
-   **OpenAI:** External AI provider for text generation, recommendations, and analysis.
-   **Google Gemini:** External AI provider for text generation, recommendations, and analysis.
-   **Google Analytics 4 (GA4):** Data integration for analytics signals.
-   **Google Search Console (GSC):** Data integration for search performance signals.
-   **HubSpot:** CRM integration for customer data and signals.
-   **LinkedIn:** Social media and professional networking integration.
-   **Replit:** Hosting environment for the platform.

---

## Testing Credentials & Seed Data

**ALWAYS use these details for testing. Do NOT guess credentials.**

### Login Credentials

| Role | Email | Password | Name | Agency |
|------|-------|----------|------|--------|
| **Admin** (primary test account) | `amy@mmagency.co.uk` | `Amy120#` | Amy Bull | Default Agency |
| Admin | karen@mmagency.co.uk | Karen123!@# | Karen | Default Agency |
| SuperAdmin | rudi@mmagency.co.uk | Rudi123!@# | Rudi | None (platform-wide) |
| Client | brad@mmagency.co.uk | — | brad | Default Agency |
| Staff | staff@mmagency.co.uk | — | Staff | Default Agency |

**Primary test account for e2e tests:** `amy@mmagency.co.uk` / `Amy120#` (Admin role)

### Agency & Client IDs

| Entity | ID | Name |
|--------|-----|------|
| Agency | `614d7633-5dd9-4147-a261-ebf8458a2ec4` | Default Agency |
| Client (existing) | `32e126d0-d59b-4d91-89cb-0f293f4ec71a` | MMagency.co.uk |
| Client (test/mock) | `f1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c` | TechFlow Solutions |

### Test Client: TechFlow Solutions

**Company:** TechFlow Solutions — B2B SaaS workflow automation for mid-market enterprises
**Contact:** Sarah Chen (sarah@techflowsolutions.com)
**Business Context:** Manufacturing & logistics focus, 4.2M ARR targeting 6.5M, 14-day free trial model, 18K avg deal size
**Retainer:** 3,500/month, 40 hours, billing day 25

#### Seeded Client Records (16 total across 6 categories)

| Category | Count | Example Titles |
|----------|-------|----------------|
| KPI Targets | 5 | Monthly Organic Traffic Target, Lead Conversion Rate Target, Monthly Qualified Leads Target, Customer Acquisition Cost Target, Annual Revenue Growth Target |
| Business Goals | 3 | Expand into DACH Market, Launch Partner Referral Programme, Achieve G2 Category Leader Status |
| Brand Voice | 2 | Core Brand Voice Guidelines, Content Pillar Strategy |
| Competitive Landscape | 2 | Primary Competitor: AutomateHQ, Secondary Competitor: FlowForge Enterprise |
| Industry Context | 2 | Manufacturing Digital Transformation Trend, B2B SaaS Buyer Journey Shift |
| Business Constraints | 2 | Marketing Budget Constraint, GDPR and Data Compliance Requirements |

### Knowledge Category IDs (Default Agency)

| Category | ID |
|----------|-----|
| KPI Targets | `3b6554e2-1d99-41a9-9adc-b7534d5d23fb` |
| Business Goals | `26e2a55f-0cdb-4c2e-9f8d-cf2711493f3b` |
| Brand Voice | `823a131a-c662-44da-9b31-56572eda62dd` |
| Competitive Landscape | `52892d26-c79d-4f5f-9d79-05d06d577553` |
| Industry Context | `5a2af431-56cb-45d7-ab1b-5acf05e5eaa2` |
| Business Constraints | `b4240fc8-fd85-477d-bb93-1f445244b57f` |

### DB Schema Patches Applied

- `account_manager_profile_id` column added to `clients` table (was in Drizzle schema but missing from DB)
- `embedding_max_tokens` column added to `agency_settings` table (was in Drizzle schema but missing from DB)
- `embedding_token_limit`, `embedding_token_used`, `embedding_request_limit`, `embedding_request_used` columns added to `agency_quotas` table (were in Drizzle schema but missing from DB)
- `request_type` column added to `ai_usage_tracking` table (was in Drizzle schema but missing from DB)
- `embedding_token_limit`, `embedding_token_used`, `embedding_request_limit`, `embedding_request_used`, `ai_request_limit`, `ai_request_used` columns added to `agency_settings` table (were in Drizzle schema but missing from DB)