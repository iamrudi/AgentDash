# Changelog

Tracks refactoring and modernization work with dates, completion status, and planned work.

## 2026-02-10

Format: each item includes what changed, why it was done, and why it matters.

### Completed
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
