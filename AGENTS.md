# Agents.md
**Purpose:** Operating constraints for any coding agent (Codex/Replit Agent) working in this repo.  
**Non-negotiable:** Preserve the Platform’s decision/control doctrine + the primitive-oriented refactor.  
**Key outcome:** The system must implement a **full validation loop** from inputs → decisions → execution → acceptance → outcomes → learning.

---

## 0) Definitions (Shared Language)

- **Control Centre:** Decision & control plane. Owns judgement, prioritisation, scope governance, acceptance criteria, outcome interpretation.
- **Delivery Centre:** Execution engine. Executes to frozen specification. Returns outputs + metadata. No scope interpretation.
- **Client Record:** Data-plane object. The governed substrate the Intelligence Core may reason over.
- **Opportunity Artifact:** AI-produced recommendation object (NOT a task), reviewed at Opportunity Gate.
- **Initiative:** An approved opportunity with explicit intent, boundaries, success criteria.
- **Product SKU / Execution SKUs:** Composition frozen pre-execution; defines scope and acceptance criteria.
- **Acceptance Gate:** Post-execution review against predefined criteria only.
- **Learning:** Captured only from governed initiatives with interpreted outcomes.

---

## 1) Doctrine (Do Not Violate)

### 1.1 Control Centre vs Delivery Centre Separation
- Control Centre decides:
  - what work should exist
  - why it exists
  - sequencing
  - success + acceptance criteria
  - when work stops
- Delivery Centre:
  - executes only what Control Centre issued
  - does not reinterpret scope, intent, or priority
  - returns outputs + execution metadata

**Agent rule:** Never introduce flows where execution can modify intent/scope/criteria mid-flight.

### 1.2 AI Role (Hard boundary)
AI may:
- connect signals + context
- surface opportunity candidates
- explain reasoning + assumptions + confidence
AI must never:
- approve work
- define success
- alter scope
- trigger execution directly

**Agent rule:** Any LLM use must run via the **hardened AI executor** (schema validation + quotas + audits).

---

## 2) Architecture Constraints (Primitive-Oriented Rebuild)

### 2.1 Planes
- **Data plane:** persisted client state, signals, context, artifacts, outcomes, learnings, audit.
- **Control plane:** workflows, governance rules, orchestration, gating, policy.

**Agent rule:** Client Record is **data plane**. Gates/workflows are **control plane**. Do not mix.

### 2.2 Primitive Ownership (Everything maps)
Every new route/module/change must map to one or more primitives (example model):
- **P1/P2:** identity, authN/authZ, tenant scope, role gates
- **P3:** signal intake, normalisation, dedupe, freshness, attribution
- **P6:** hardened AI execution (schema in/out, quotas, retries, fail-closed)
- **P7:** audit/event ledger (append-only trace)
- **P8:** recovery/background checks (freshness enforcement, staleness alerts)

**Agent rule:** If a change cannot be assigned to a primitive, do not implement it.

---

## 3) Invariants (Must Always Hold)

### INV1 — Authentication & Authorization Required
- No unauthenticated mutation routes.
- All reads/writes enforce role gates.

### INV2 — Tenant Isolation
- No cross-agency access except explicit superadmin.
- All client records, signals, AI artifacts, decisions are agency-scoped.

### INV3 — Idempotency
- Signal ingestion and workflow triggers must be idempotent (dedupe keys, safe retries).

### INV4 — AI Hardening
All LLM calls must:
- validate **inputs** against an input schema
- enforce quotas
- validate **outputs** against an output schema
- fail closed on any schema violation or policy violation
- emit audit events

**Agent rule:** No direct LLM calls in handlers/services. Only through hardened executor.

---

## 4) Client Record = Decision Input Contract (Schema-Enforced)

### 4.1 What it is / isn’t
Client Record is a **decision memory** used for opportunity-level recommendations.

It is **not**:
- a task system
- a backlog
- a delivery tracker
- a channel-optimisation dashboard

### 4.2 Required Field Contract (Must be machine-enforced)
Every field must have a self-describing definition:
- `field_key` (stable snake_case key)
- `plane` (must be `data`)
- `primitive_owner` (P1..P8)
- `data_type` (string|enum|int|float|url|date|json)
- `allowed_values` (if enum)
- `nullable` (true/false)
- `scope` (agency|client)
- `read_roles`, `write_roles`
- `ai_exposed` (true/false) **← critical**
- `update_mode` (manual|signal|derived)
- `signal_source` (if update_mode=signal)
- `freshness_sla_days` (recommended)
- `confidence_required` (high|med|low, recommended)
- `audit_required` (true/false)

**Agent rule:** Prompt builders must pull from this schema registry, never from ad-hoc field lists.

### 4.3 AI Exposure Gate (Input minimization)
- Only fields with `ai_exposed=true` may enter AI context.
- All other fields are treated as non-readable by the AI layer (even if readable by humans).

**Agent rule:** If a field influences AI decisions, it must be explicitly marked `ai_exposed=true`.

---

## 5) FULL Validation Loop (End-to-End)

This is the complete lifecycle validation loop that must exist in the system.  
Each step must have **explicit gates**, **schemas**, **audit events**, and **tests**.

### 5.1 Gate 0 — Input Contract Validation (Client Record + Signals)
**Goal:** Ensure data feeding decisions is reliable, scoped, and fresh.
- ClientRecord updates:
  - schema-valid (type/enum/nullable)
  - role-validated (INV1)
  - tenant-scoped (INV2)
  - audited if `audit_required=true` (P7)
- Signal ingestion:
  - normalise + dedupe (INV3)
  - attribute source + timestamp (P3)
  - apply freshness policy if defined (P8)

**Required artifacts/events**
- `ClientRecordUpdated` (append-only)
- `SignalIngested` / `SignalDeduped`

**Tests**
- unauthorized write rejected
- cross-tenant access rejected
- duplicate signal does not create duplicate state changes

---

### 5.2 Gate 1 — AI Schema Gate (Recommendation Generation)
**Goal:** AI produces only a validated Opportunity Artifact; never tasks.

**Rules**
- Input to AI:
  - built strictly from `ai_exposed=true` fields + relevant signals
  - validated against an AI input schema
- Output from AI:
  - validated against an AI output schema (fail closed)
  - stored as `OpportunityArtifact` (not executable work)
  - must include:
    - `opportunity_statement`
    - `reasoning`
    - `assumptions[]`
    - `confidence` (enum)
    - `evidence_refs[]` (signals/context pointers)
    - `risks[]`
    - `suggested_success_criteria` (proposal only, not binding)

**Required artifacts/events**
- `AIRecommendationRequested`
- `AIRecommendationValidated`
- `OpportunityArtifactCreated`

**Tests**
- only `ai_exposed=true` fields appear in AI input
- invalid output schema is rejected
- AI call cannot execute without hardened executor

---

### 5.3 Gate 2 — Opportunity Gate (Human Decision Validation)
**Goal:** Strategist challenges reasoning and decides whether the opportunity becomes real.

**Rules**
- Strategist may:
  - approve / defer / reject
  - challenge assumptions
  - add missing context and request re-evaluation
- Disagreement must challenge reasoning, not force execution.
- No execution begins from an opportunity alone.

**Required artifacts/events**
- `OpportunityGateDecision` with:
  - decision (approve/defer/reject)
  - rationale
  - changed assumptions/context pointers

**Tests**
- opportunity cannot transition to initiative without human approval
- decision recorded in audit trail

---

### 5.4 Gate 3 — Initiative Definition (Intent & Success Freeze)
**Goal:** Approved opportunity becomes a bounded initiative with explicit intent and success definitions.

**Rules**
- Must include:
  - intent statement
  - constraints
  - success criteria (quant + qual)
  - boundary conditions (“must not break”)
  - evaluation horizon

**Required artifacts/events**
- `InitiativeCreated`
- `InitiativeIntentFrozen`

**Tests**
- initiative must have explicit success criteria before SKU composition

---

### 5.5 Gate 4 — SKU Composition Freeze (Scope Lock)
**Goal:** Freeze the Product SKU + required Execution SKUs before execution.

**Rules**
- Initiative → exactly one Product SKU selection
- Execution SKUs defined and governed by SOP references
- Composition is frozen:
  - no add/remove Execution SKUs downstream
  - no scope additions during execution

**Required artifacts/events**
- `ProductSKUSelected`
- `ExecutionSKUSetFrozen`

**Tests**
- post-freeze attempts to change SKU set are rejected
- execution cannot start without frozen composition

---

### 5.6 Gate 5 — Execution Handoff (Delivery Spec Validation)
**Goal:** Delivery Centre receives an unambiguous spec; cannot reinterpret.

**Rules**
- Delivery Centre receives:
  - initiative intent (read-only)
  - Product SKU + Execution SKUs (frozen)
  - acceptance criteria
  - required output formats
- Delivery Centre returns:
  - outputs
  - execution metadata (timestamps, SOP adherence, QA status, notes as learning-only)

**Required artifacts/events**
- `ExecutionHandoffIssued`
- `ExecutionOutputReturned`

**Tests**
- Delivery Centre cannot mutate initiative/scope fields
- outputs are attached to the correct initiative + tenant

---

### 5.7 Gate 6 — Acceptance Gate (Output Validation vs Criteria)
**Goal:** Strategist accepts/rejects outputs strictly against predefined acceptance criteria.

**Rules**
- Accept or reject only vs acceptance criteria.
- No “re-briefing”, no “while you’re at it”, no scope changes.
- Rejection that reveals new thinking becomes a **new opportunity**, not rework.

**Required artifacts/events**
- `AcceptanceGateDecision` (accept/reject + rationale)
- `OutputAccepted` or `OutputRejected`

**Tests**
- acceptance decision required before release/activation
- cannot add new requirements during acceptance

---

### 5.8 Gate 7 — Outcome Interpretation (Result Validation vs Intent)
**Goal:** Evaluate outcomes against the initiative’s success definitions.

**Rules**
- Compare:
  - KPI movement vs quantitative success
  - qualitative feedback vs qualitative success
  - execution quality vs acceptance criteria adherence
- Store interpretation as a Control Centre artifact.

**Required artifacts/events**
- `OutcomeReviewCompleted`
- `OutcomeInterpreted`

**Tests**
- outcome interpretation requires an approved initiative + accepted execution OR explicit rejection path recorded

---

### 5.9 Gate 8 — Learning Writeback (Validated Learning Only)
**Goal:** Prevent “ungoverned learning” from polluting future decisions.

**Rules**
- Learning can only be written when:
  - initiative was approved (Gate 2)
  - SKU set was frozen (Gate 4)
  - outcomes were interpreted (Gate 7)
- Learning must be linked to:
  - the initiative
  - the evidence/signals
  - the acceptance outcome
- Store:
  - invalidated assumptions
  - decision learnings
  - what not to do again
  - confidence in learning

**Required artifacts/events**
- `LearningCaptured`
- `AssumptionInvalidated` (if applicable)

**Tests**
- learning write rejected if prerequisites not met
- learning cannot be written directly by AI without human confirmation (optional enforcement, recommended)

---

## 6) Data Structures (Recommended Minimum)

- `ClientRecord` (data plane)
- `SignalEvent` (data plane)
- `OpportunityArtifact` (data plane)
- `Initiative` (data plane)
- `SkuComposition` (data plane; frozen)
- `ExecutionOutput` (data plane)
- `GateDecision` (data plane; audit-friendly)
- `OutcomeReview` (data plane)
- `LearningArtifact` (data plane)
- `AuditEvent` (append-only)

**Agent rule:** Do not overload ClientRecord with workflow/gate state. Use artifacts.

---

## 7) Implementation Rules for Agents (Codex/Replit)

### 7.1 Change Strategy
- Small PR-sized commits
- Introduce schema/types + tests first, then wiring
- Avoid large rewrites that bypass primitives

### 7.2 Tests Required (Minimum)
- INV1: authZ tests for read/write endpoints
- INV2: tenant isolation tests (no cross-agency leakage)
- INV3: signal ingestion idempotency
- INV4: AI schema gate tests (input + output), fail-closed behavior
- Gate progression tests:
  - opportunity cannot become initiative without Gate 2
  - execution cannot begin without Gate 4
  - release cannot happen without Gate 6
  - learning cannot be captured without Gate 7

### 7.3 No “Magic Strings”
- Field keys, enums, AI exposure flags come from schema registry
- Prompt builders are deterministic and schema-driven

---

## 8) Definition of Done (Refactor Acceptance)

A refactor is acceptable only if:
- Client Record is schema-enforced and AI exposure gated
- AI recommendations produce Opportunity Artifacts only (no tasks)
- Opportunity Gate and Acceptance Gate are enforced
- SKU composition freeze prevents downstream scope drift
- Outcome interpretation + learning writeback are gated and auditable
- INV1–INV4 have test coverage
- Tenant isolation is preserved end-to-end

---

## 9) PR Checklist (Must Pass)

- [ ] Change maps to primitive(s)
- [ ] No control-plane leakage into ClientRecord
- [ ] Role + tenant guards enforced (INV1/INV2)
- [ ] Signal ingestion idempotent (INV3)
- [ ] AI calls only via hardened executor (INV4)
- [ ] Only `ai_exposed=true` fields enter AI
- [ ] Audit events emitted where required
- [ ] Gate progression enforced (2→4→6→7→8)
- [ ] Tests updated/added accordingly
