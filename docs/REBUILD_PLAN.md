# Rebuild / Modernization Plan (Primitive-First, Low-Risk)

Goal: Re-center architecture around primitives in `docs/PRIMITIVES.md` without disruptive big-bang refactors.

## Phase 0 — No Behavior Change (Docs + Tests)

- **Scope**:
  - Freeze primitive contracts and invariants in docs.
  - Add/expand targeted tests around invariant boundaries (auth, tenant guards, idempotency, AI gate failure behavior).
  - Add route inventory snapshot (modular vs legacy monolith).
- **Concrete targets**:
  - `docs/ARCHITECTURE.md`, `docs/PRIMITIVES.md`, `docs/INVARIANTS.md`
  - `tests/middleware/*`, workflow and signal route tests (new targeted test files)
- **Exit criteria**:
  - INV1..INV5 have executable tests.
  - No runtime behavior changes.
  - Route inventory snapshot is documented in `docs/ROUTE_INVENTORY.md`.

## Phase 1 — Harden Boundaries (Small Refactors)

- **Scope**:
  - Unify auth primitive usage across ingress boundaries.
  - Remove implicit request-shape mutation patterns where possible and formalize request context object.
  - Normalize route-level agency checks to one helper path.
- **Concrete changes**:
  1. Replace realtime legacy auth (`server/middleware/auth.ts` + `server/lib/jwt.ts` usage in `server/realtime/*`) with `server/middleware/supabase-auth.ts`-compatible verification.
  2. Keep one canonical tenant resolver (`server/middleware/agency-context.ts`) for admin/superadmin branching.
  3. Add explicit “policy boundary” middleware for control-plane routes (`/api/workflows`, `/api/signals`, `/api/workflow-rules`, `/api/governance`).
- **Exit criteria**:
  - No route uses legacy JWT auth path.
  - Realtime and HTTP share one principal model.
  - Tenant checks proven by cross-agency tests.

## Phase 2 — Unify Execution Model (Reduce Duplication)

- **Scope**:
  - Move remaining high-risk monolithic route logic from `server/routes.ts` into modular domain routers/services.
  - Ensure side effects happen via primitive services (SignalRouter, WorkflowEngine, HardenedAIExecutor, storage service boundaries).
- **Concrete changes**:
  1. Create a strict `application service` layer for multi-step operations currently embedded in route handlers.
  2. Decompose `server/routes.ts` by domain and remove duplicate handlers already present in `server/routes/*.ts`.
  3. Ensure workflow execution/event writes remain centralized in `server/workflow/engine.ts`.
  4. Ensure AI calls only occur through `server/ai/hardened-executor.ts`.
- **Exit criteria**:
  - `server/routes.ts` reduced to compatibility shims or removed.
  - No duplicate endpoint ownership between monolith and modular routers.
  - Primitive boundaries are explicit in imports and tests.

## Phase 3 — Platformization (Control Plane + Ops)

- **Scope**:
  - Build operator-facing visibility and governance atop existing event/audit primitives.
  - Add policy dashboards and operational SLO reporting.
- **Concrete changes**:
  1. Control-plane dashboards for rule publish history, workflow failure trends, quota burn-down, integration health.
  2. Add retention + archival jobs for event tables (`workflow_events`, `ai_executions`, `workflow_rule_evaluations`, governance logs).
  3. Introduce explicit policy bundles/versioning and migration utilities for safe rollout per agency.
- **Exit criteria**:
  - Platform operators can answer “who changed what, when, and what failed next” from dashboards.
  - Event volume remains manageable via retention policies.

### Status (2026-02-10)
- Ops dashboards: added summary, trends, AI usage, quota warnings/burndown, workflow failures, rule publishes, integration health.
- Retention: added plan/preview, count estimates, dry-run execution path, scheduled dry-run job, archive handler hook.
- Policy bundles: added schema plus read/write endpoints for bundles and versions.

---

## Sequencing & Risk Controls

- Keep each phase independently releasable with feature flags.
- Use shadow-read / dual-write only where required; prefer read-only instrumentation first.
- For auth boundary migrations, release behind endpoint-level toggles and keep immediate rollback path.

## What We’re Not Solving in This Rebuild

- Full event-sourcing rewrite of all domain entities.
- Immediate replacement of all historical tables or schema redesign.
- Zero-downtime migration across every route in one release train.

## How Contributors Extend Safely During Rebuild

- Add new capabilities as primitive-compliant modules:
  - **Ingress** through authenticated route + tenant resolver.
  - **Decisioning** through rule/signal primitives.
  - **AI** through hardened executor only.
  - **Persistence** through typed storage/services and append-oriented event logs.
- For every new side effect, document:
  - Trigger boundary
  - Authorization boundary
  - Idempotency strategy
  - Failure/compensation strategy
  - Audit/event emission point


---

## Workstream: Client Record Schema Contract (Supports AI Recommendations)

Add this as a first-class modernization thread because it directly impacts safe AI behavior:

### Phase 0 (Docs + Tests)
- Document the Client Record field catalog as a **Decision-Input Contract** (required columns, ai_exposed gating).
- Add tests:
  - Selecting AI inputs only from `ai_exposed=true`
  - Tenant isolation on Client Record reads/writes
  - Audit emission on `audit_required=true` fields

### Phase 1 (Boundary Hardening)
- Implement a typed Client Record accessor that:
  - validates writes against `data_type/allowed_values/nullable`
  - emits audit events (P7) when configured
  - supports signal-based updates through P3 normalization

### Phase 2 (Execution Model Unification)
- Route any recommendation generation through Control Plane workflows:
  - `client_record_updated` signal -> rule evaluation -> workflow -> AI step
- Remove any direct “AI recommend” route that bypasses workflow engine and hardened executor.

### Phase 3 (Ops + Governance)
- Add dashboards for:
  - staleness / freshness SLA breaches
  - AI input coverage (which fields are actually used)
  - top invalidated assumptions + learnings per client
