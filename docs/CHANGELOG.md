# Changelog

Tracks refactoring and modernization work with dates, completion status, and planned work.

## 2026-02-10

Format: each item includes what changed, why it was done, and why it matters.

### Completed
- [x] Added ops summary and policy bundle listing endpoints: `server/governance/governance-routes.ts`.
  Why: Provide minimal Phase 3 visibility hooks without altering runtime behavior.
  Matters: Enables operator insight into rule publishes, workflow failures, and AI usage.
- [x] Added ops trends endpoint (rule publishes + workflow failures): `server/governance/governance-routes.ts`.
  Why: Provide time-series visibility for control-plane rule changes and workflow failures.
  Matters: Helps operators detect regressions and incident patterns over time.
- [x] Added policy bundle versions endpoint: `server/governance/governance-routes.ts`.
  Why: Provide read-only access to bundle history for operational review.
  Matters: Enables safe inspection of policy changes without execution coupling.
- [x] Expanded retention job plan to include archive/delete intent: `server/jobs/retention-job.ts`.
  Why: Surface whether retention policies imply archive or delete without performing actions.
  Matters: Prepares safe rollout of archival workflows and clarifies cleanup intent.
- [x] Added retention cleanup plan preview endpoint: `server/routes/retention-policies.ts`.
  Why: Provide operators a safe, read-only view of retention actions.
  Matters: Enables validation before destructive cleanup runs.
- [x] Added AI usage summary endpoint: `server/governance/governance-routes.ts`.
  Why: Provide coarse visibility into AI usage by provider/model.
  Matters: Supports Phase 3 ops reporting without altering execution behavior.
- [x] Added workflow failure summary endpoint: `server/governance/governance-routes.ts`.
  Why: Surface top workflows with failures in a time window.
  Matters: Helps triage instability without touching execution logic.
- [x] Added policy bundle/versioning schema + migration: `shared/schema.ts`, `migrations/0012_add_policy_bundles.sql`.
  Why: Establish data model for policy bundles without execution coupling.
  Matters: Enables safe versioning and rollout in later phases.
- [x] Added retention cleanup scaffolding (dry-run plan): `server/jobs/retention-job.ts`.
  Why: Prepare for retention jobs without destructive side effects.
  Matters: Supports P8 operational recovery and compliance planning.
- [x] Added retention job test: `tests/retention-job.test.ts`.
  Why: Validate retention plan generation deterministically.
  Matters: Prevents regressions in cleanup scheduling logic.
- [x] Added SkuCompositionService and migrated SKU composition endpoints: `server/application/sku/sku-composition-service.ts`, `server/domain/sku/schemas.ts`, `server/routes/sku-compositions.ts`.
  Why: Centralize SKU validation and audit emission in an application service.
  Matters: Keeps scope-freeze artifacts governed and consistent.
- [x] Added SKU composition route tests (delegation + invalid payload): `tests/sku-compositions-route.test.ts`.
  Why: Ensure route delegates and fails closed on schema violations.
  Matters: Prevents regressions in scope freeze handling.
- [x] Added InitiativeIntentService and migrated intent endpoint: `server/application/initiatives/initiative-intent-service.ts`, `server/domain/initiatives/schemas.ts`, `server/routes/initiative-intents.ts`.
  Why: Move intent creation validation and audit emission into an application service.
  Matters: Keeps control-plane intent artifacts governed and consistent.
- [x] Added initiative intent route tests (delegation + invalid payload): `tests/initiative-intents-route.test.ts`.
  Why: Ensure route delegates and fails closed on schema violations.
  Matters: Prevents regressions in intent capture.
- [x] Added GateDecisionService and migrated gate decision endpoint: `server/application/gates/gate-decision-service.ts`, `server/domain/gates/schemas.ts`, `server/routes/opportunities.ts`.
  Why: Move gate decision validation, tenancy checks, and audit emission into an application service.
  Matters: Keeps control-plane artifacts governed and consistent across routes.
- [x] Added gate decision route tests (delegation, tenant 403, invalid payload 400): `tests/gate-decisions-route.test.ts`.
  Why: Ensure non-breaking behavior and fail-closed validation.
  Matters: Prevents regressions in gate enforcement.
- [x] Added application service layer pattern for Opportunity Artifacts: `server/application/opportunities/opportunity-service.ts`, `server/domain/opportunities/schemas.ts`.
  Why: Separate orchestration from routes and make AI generation explicit and testable.
  Matters: Enforces Control Centre boundaries and consistent AI gating for Opportunity Artifacts.
- [x] Migrated `/api/opportunities` to use the service layer (manual + AI modes): `server/routes/opportunities.ts`.
  Why: Remove inline persistence and route-local AI logic.
  Matters: Centralizes validation, AI gating, and audit emission.
- [x] Added tests for service and route delegation: `tests/opportunity-service.test.ts`, `tests/opportunities-route.test.ts`.
  Why: Prove route-to-service delegation and fail-closed AI schema handling.
  Matters: Prevents regressions in the Control Centre intelligence loop.
- [x] Added standardized request context object and wired it into auth middleware: `server/middleware/request-context.ts`, `server/middleware/supabase-auth.ts`.
  Why: Reduce implicit request mutation and normalize access to principal metadata.
  Matters: Simplifies route logic and supports consistent auditing.
- [x] Adopted request context in key routes touching Client Record and recommendation flows: `server/routes/agency.ts`, `server/routes/integrations.ts`, `server/routes/agency-clients.ts`, `server/routes/superadmin.ts`.
  Why: Prove context usage without a breaking refactor.
  Matters: Creates a migration path for wider adoption.
- [x] Added default recommendation workflow + signal route bootstrapping: `server/workflow/defaults.ts`, `server/clients/client-record-signal.ts`.
  Why: Ensure fresh environments have a working path for client record recommendation signals.
  Matters: Prevents recommendation requests from no-oping due to missing routes.
- [x] Added workflow action to generate recommendations: `server/workflow/engine.ts`.
  Why: Allow workflows to produce initiatives via the existing AI recommendation pipeline.
  Matters: Ensures signal-driven recommendations actually create governed outputs.
- [x] Routed recommendation requests through internal signals + workflow engine: `server/clients/client-record-signal.ts`, `server/routes/agency-clients.ts`, `server/routes/superadmin.ts`.
  Why: Remove direct AI recommendation execution from routes.
  Matters: Ensures recommendations are generated only through governed workflows.
- [x] Emit `client_record_updated` internal signals on Client Record writes: `server/routes/agency.ts`, `server/routes/integrations.ts`.
  Why: Enable policy-based workflows to respond to updates.
  Matters: Establishes the client record update -> signal -> workflow chain.
- [x] Added signal emission tests for client record updates: `tests/client-record-signal.test.ts`.
  Why: Lock in signal routing and workflow execution behavior.
  Matters: Prevents regressions in recommendation routing.
- [x] Implemented Client Record update validation against catalog types/nullable rules: `server/clients/client-record-service.ts`.
  Why: Enforce the Client Record decision-input contract on writes.
  Matters: Prevents invalid data from entering the decision memory.
- [x] Parsed boolean fields in Client Record catalog explicitly: `server/ai/ai-input-builder.ts`.
  Why: Avoid truthy string coercion for `false` values.
  Matters: Ensures `ai_exposed`, `nullable`, and `audit_required` are honored correctly.
- [x] Added route inventory snapshot and per-endpoint list: `docs/ROUTE_INVENTORY.md`, `docs/ROUTE_ENDPOINTS.md`.
  Why: Create a concrete inventory of modular vs legacy routing.
  Matters: Prevents routing drift and makes refactor scope auditable.
- [x] Linked route inventory in rebuild plan: `docs/REBUILD_PLAN.md`.
  Why: Keep plan and artifacts tied together.
  Matters: Ensures plan compliance is verifiable.
- [x] Added Client Record audit helper tied to field catalog: `server/clients/client-record-audit.ts`.
  Why: Enforce audit emission rules from the schema contract.
  Matters: Satisfies INV5 and reduces silent data mutations.
- [x] Added Client Record catalog loader for auditable fields: `server/clients/client-record-catalog.ts`.
  Why: Centralize catalog parsing for auditability decisions.
  Matters: Removes hard-coded audit field lists.
- [x] Client update route emits audit log for auditable fields: `server/routes/agency.ts`.
  Why: Ensure live updates are audited when required.
  Matters: Delivers traceability for Client Record edits.
- [x] Lead-events client updates now validate and audit Client Record writes: `server/routes/integrations.ts`.
  Why: Apply the same contract enforcement to integration-driven updates.
  Matters: Prevents silent contract drift from integration workflows.
- [x] Added Client Record audit tests: `tests/client-record-audit.test.ts`.
  Why: Verify audit emission rules stay enforced.
  Matters: Prevents regressions on audit-required fields.
- [x] Added Client Record validation tests: `tests/client-record-validation.test.ts`.
  Why: Lock in type and nullable enforcement for cataloged fields.
  Matters: Prevents invalid data from corrupting Client Record state.
- [x] Added Client Record tenant isolation tests: `tests/client-record-tenant-isolation.test.ts`.
  Why: Explicitly validate cross-tenant protections for Client Record access.
  Matters: Confirms INV2 on read/write paths.
- [x] Generated per-endpoint inventory with non-literal `router.use()` note section: `docs/ROUTE_ENDPOINTS.md`.
  Why: Document exact endpoint surface area.
  Matters: Helps auditing and endpoint ownership clarity.
- [x] Hardened AI input gating via catalog and schema (already in repo): `docs/client-record-field-catalog.csv`, `server/ai/ai-input-builder.ts`, `server/ai/ai-input-selector.ts`, `server/ai/ai-input-schema.ts`, `tests/ai-input-catalog.test.ts`, `tests/ai-input-exposure.test.ts`.
  Why: Limit AI inputs to `ai_exposed=true` fields.
  Matters: Enforces INV4 input minimization and reduces leakage risk.
- [x] Unified realtime auth to Supabase verification (already in repo): `server/realtime/realtime-routes.ts`, `server/realtime/websocket-server.ts`, `server/middleware/supabase-auth.ts`.
  Why: Remove split auth primitives.
  Matters: Ensures consistent principal model and tenant scoping.
- [x] Added policy boundary middleware for control-plane routes (already in repo): `server/middleware/policy-boundary.ts`, `server/routes.ts`, `tests/policy-boundary.test.ts`.
  Why: Explicitly mark control-plane boundaries.
  Matters: Prevents control/data plane leakage.
- [x] Reduced `server/routes.ts` to shim + modular routers (already in repo): `server/routes.ts`, `server/routes/index.ts`.
  Why: Eliminate duplicate/overlapping endpoint ownership.
  Matters: Lower drift risk and improve maintainability.
- [x] Added governed artifacts tables + storage + gate enforcement (already in repo):
  Why: Implement full validation loop artifacts and gates.
  Matters: Required for acceptance, outcome, and learning governance.
  Details:
  - schema/migrations: `shared/schema.ts`, `migrations/0010_add_governed_artifacts.sql`
  - routes: `server/routes/opportunities.ts`, `server/routes/initiative-intents.ts`, `server/routes/sku-compositions.ts`, `server/routes/execution-outputs.ts`, `server/routes/outcome-reviews.ts`, `server/routes/learning-artifacts.ts`
  - storage: `server/storage.ts`
  - tests: `tests/gate-progression.test.ts`, `tests/learning-artifacts-gate.test.ts`
- [x] Ensured AI calls are routed through hardened executor (already in repo): `server/ai-analyzer.ts`, `server/routes/ai-chat.ts`, `server/routes/agency-clients.ts`, `server/workflow/engine.ts`.
  Why: Centralize AI quota/schema enforcement.
  Matters: Guarantees INV4 across routes and workflow steps.
- [x] Added signal dedup/idempotency and audit/event ledger tests (already in repo): `tests/signal-dedup.test.ts`, `tests/workflow-idempotency.test.ts`, `tests/audit-ledger.test.ts`.
  Why: Lock in INV3/INV5 behaviors.
  Matters: Ensures idempotent workflows and durable traceability.

### Planned (Open)
- [ ] Client Record: typed accessor with schema validation + audit emission (Phase 1 of workstream).
- Why: Enforce `data_type/allowed_values/nullable` and audit rules on writes.
- Matters: Moves Client Record from best-effort to contract-enforced.
- [ ] Client Record: recommendation flow routed through workflow engine via signals (Phase 2 of workstream).
- Why: Remove direct AI recommendation path.
- Matters: Keeps execution governed by workflow policies and gates.
- [ ] Request context object to reduce implicit request mutation (Phase 1).
- Why: Normalize authenticated request state.
- Matters: Minimizes hidden coupling and clarifies invariants.
- [ ] Application service layer for multi-step operations (Phase 2).
- Why: Move complex orchestration out of route handlers.
- Matters: Strengthens primitive boundaries and testability.
- [ ] Phase 3 ops dashboards, retention/archival jobs, policy bundles/versioning.
- Why: Provide operator visibility and lifecycle control.
- Matters: Sustains platform governance at scale.
- [ ] Backfill changelog entries for work prior to 2026-02-10.
- Why: Establish historical audit trail.
- Matters: Improves traceability for future audits.
