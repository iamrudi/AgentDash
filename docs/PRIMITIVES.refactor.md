# Core Primitives Catalog

This catalog reframes AgentDash around 8 core primitives.

## P1. Identity & Tenant Context

- **Definition**: Resolve authenticated principal, role, and tenant scope (`agencyId` / `clientId`) for every protected request.
- **Responsibilities**: Token verification, role extraction, superadmin detection, tenant attachment.
- **Non-responsibilities**: Business policy decisions, domain validation.
- **Main modules**: `server/middleware/supabase-auth.ts`, `server/middleware/agency-context.ts`, `server/routes/auth.ts`.
- **Key invariants**: No protected handler executes without a principal; agency context must exist for agency-scoped operations.
- **Happy path**: `requireAuth` verifies token -> sets `req.user` -> `resolveAgencyContext` computes scope.
- **Failure path**: Missing/invalid token, missing role, or missing agency association returns 401/403.

## P2. Capability Gating (Role + Resource Access)

- **Definition**: Enforce “who can do what to which tenant-owned object.”
- **Responsibilities**: Role checks (`requireRole`), object access checks (`requireClientAccess`, `requireTaskAccess`, etc).
- **Non-responsibilities**: Workflow orchestration, AI decisions.
- **Main modules**: `server/middleware/supabase-auth.ts`, route handlers in `server/routes/*.ts`.
- **Key invariants**: Cross-agency access denied unless superadmin; client users only access owned client resources.
- **Happy path**: Admin on matching agency passes guard and proceeds.
- **Failure path**: Cross-agency object lookup causes `403 Access denied`.

## P3. Signal Intake & Attribution

- **Definition**: Normalize heterogeneous incoming events into canonical workflow signals with source, urgency, payload metadata, and dedup hash.
- **Responsibilities**: Source/urgency validation, payload normalization, canonical hash computation, adapter-specific mapping.
- **Non-responsibilities**: Rule decisioning, execution side effects.
- **Main modules**: `server/workflow/signal-normalizer.ts`, `server/workflow/signal-adapters.ts`, `server/workflow/signal-router.ts`, `server/routes/signals.ts`.
- **Key invariants**: Unknown sources/urgencies rejected; same canonical payload maps to same dedup hash.
- **Happy path**: `/signals/:source/ingest` -> adapter -> normalizer -> dedup-aware insert -> route match list.
- **Failure path**: Invalid source/urgency throws; malformed payload rejected by route validation.

## P4. Policy Evaluation (Versioned Rules)

- **Definition**: Evaluate published rule versions against contextual signal/client/project data and persist evaluation outputs.
- **Responsibilities**: Operator execution, condition logic (`all`/`any`), evaluation recording.
- **Non-responsibilities**: Mutation execution, persistence side effects beyond evaluation logs.
- **Main modules**: `server/workflow/rule-engine.ts`, `server/routes/rule-engine.ts`, `server/storage.ts` (rule versions/audits/evaluations).
- **Key invariants**: Only published rule version is evaluated; every evaluation emits persisted condition result set.
- **Happy path**: Rule version published -> evaluation computes condition results -> matched result persisted.
- **Failure path**: No published version => non-match with `noPublishedVersion`.

## P5. Deterministic Execution Runtime

- **Definition**: Execute workflow graphs with step handlers inside transaction-scoped lifecycle and idempotency checks.
- **Responsibilities**: Input hash idempotency, execution state machine, event logging, step transitions, failure marking.
- **Non-responsibilities**: Authentication, route-level policy checks.
- **Main modules**: `server/workflow/engine.ts`, `server/routes/workflows.ts`.
- **Key invariants**: Duplicate `(workflowId,inputHash)` returns existing execution; status progression is persisted (`pending/running/completed/failed`).
- **Happy path**: `execute` creates execution -> runs steps -> `completeExecution`.
- **Failure path**: Step failure -> `failExecution` -> terminal failed execution record.

## P6. AI Guarded Executor

- **Definition**: A single boundary for model calls that enforces quota, output schema, caching, and execution telemetry.
- **Responsibilities**: Quota checks, provider dispatch, schema validation, execution + usage tracking.
- **Non-responsibilities**: Business prompt semantics, workflow branching logic.
- **Main modules**: `server/ai/hardened-executor.ts`, `server/ai/provider.ts`, `server/governance/quota-service.ts`.
- **Key invariants**: No successful AI result without quota allowance and schema validation.
- **Happy path**: Quota pass -> provider call -> schema pass -> usage increment -> success record.
- **Failure path**: Quota exceeded or schema fail -> execution marked failed and returned as error.

## P7. Audit/Event Ledger

- **Definition**: Persist append-oriented records for control-plane and execution observability.
- **Responsibilities**: Store audits/events/evaluations/executions/usage for forensic and operational tracing.
- **Non-responsibilities**: Access control decisions themselves.
- **Main modules**: `shared/schema.ts` tables (`audit_logs`, `workflow_events`, `workflow_rule_audits`, `workflow_rule_evaluations`, `ai_executions`, `governance_audit_logs`), writes in `server/workflow/engine.ts`, `server/routes/rule-engine.ts`, `server/ai/hardened-executor.ts`, `server/governance/governance-routes.ts`.
- **Key invariants**: Critical admin and workflow/AI actions leave persisted trace artifacts.
- **Happy path**: Rule publish/update creates audit; workflow step emits event; AI call logs execution.
- **Failure path**: Errors still persist failed statuses when available.

## P8. Operational Recovery & Background Enforcement

- **Definition**: Scheduled loops and retry paths that heal or enforce lifecycle constraints over time.
- **Responsibilities**: Invoice/trash/orphan/SLA schedulers, retrying failed signals, health checks.
- **Non-responsibilities**: Interactive request authorization.
- **Main modules**: `server/index.ts`, `server/services/invoiceScheduler.ts`, `server/services/trashCleanupScheduler.ts`, `server/jobs/orphan-cleanup.ts`, `server/sla/sla-cron.ts`, `server/workflow/signal-router.ts`.
- **Key invariants**: Background jobs are registered at startup; failed signals can be re-queued with incremented retry count.
- **Happy path**: Scheduler runs and records successful heartbeat/updates.
- **Failure path**: Job errors recorded; failed signals moved back to `pending` through retry API.

---

## Cross-Primitive Note: Auth Stack Split

Current implementation has two parallel auth primitives in practice:
- Supabase token verification for most API routes (`server/middleware/supabase-auth.ts`)
- Local JWT verification for realtime (`server/realtime/realtime-routes.ts`, `server/realtime/websocket-server.ts`, `server/lib/jwt.ts`)

This is a core modernization target in `docs/REBUILD_PLAN.md`.


---

## Client Record Contract Mapping (Primitive Ownership)

The Client Record field catalog is the authoritative mapping between schema and primitives:

- **P1/P2 (Identity + Capability Gating)**: `read_roles`, `write_roles`, `scope`
- **P3 (Signal Intake & Attribution)**: `update_mode=signal`, `signal_source`, `freshness_sla_days`, dedup when applicable
- **P6 (AI Guarded Executor)**: `ai_exposed=true` fields only; enforce input+output schemas
- **P7 (Audit/Event Ledger)**: `audit_required=true` emits append-oriented audit records on mutation
- **P8 (Operational Recovery)**: enforce `freshness_sla_days` and `context review horizon` via scheduled checks (staleness flags, reminders)

This ensures the Client Record is refactor-proof: every field has a boundary, owner, and enforcement path.