# Changelog

Tracks refactoring and modernization work with dates, completion status, and planned work.

## 2026-02-10

Format: each item includes what changed, why it was done, and why it matters.

### Phase 3 Summary
Ops dashboards:
- Ops summary + trends, AI usage + trends, workflow failure + rule publish summaries
- Quota warnings + burndown, integration health summary
Retention:
- Plan/preview with count estimates, dry-run execution, scheduled dry-run job
- Archive handler hook for future storage integration
Policy bundles:
- Schema, read endpoints, and write endpoints for bundles + versions
Docs:
- Route inventory updated for new governance/retention endpoints

### Completed
- [x] Added typed Client Record accessor with update_mode enforcement: `server/clients/client-record-accessor.ts`, `server/clients/client-record-service.ts`, `server/routes/agency.ts`, `server/routes/integrations.ts`.
  Why: Centralize client record updates with validation, audit, and signal emission rules.
  Matters: Enforces the decision-input contract and prevents unauthorized update paths.
- [x] Routed AI recommendation requests through workflow engine for Opportunity Artifacts: `server/routes/opportunities.ts`, `tests/opportunities-route.test.ts`.
  Why: Remove direct AI recommendation execution from route handlers.
  Matters: Keeps recommendations governed by workflow policies and signals.
- [x] Added retention cleanup application service layer: `server/application/retention/retention-service.ts`, `server/routes/retention-policies.ts`.
  Why: Move multi-step cleanup orchestration out of route handlers.
  Matters: Improves testability and keeps route logic thin.
- [x] Added execution/output/learning application services: `server/application/execution/execution-output-service.ts`, `server/application/outcomes/outcome-review-service.ts`, `server/application/learning/learning-artifact-service.ts`.
  Why: Move gate-sensitive orchestration out of route handlers.
  Matters: Keeps control-plane validation centralized and testable.
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
- [x] Added optional retention plan count estimates: `server/jobs/retention-job.ts`, `server/routes/retention-policies.ts`.
  Why: Allow operators to preview impact before any cleanup.
  Matters: Reduces risk for future archival/deletion steps.
- [x] Added rule publish summary endpoint: `server/governance/governance-routes.ts`.
  Why: Surface the most frequently published workflow rules in a window.
  Matters: Helps operators track churn in control-plane policies.
- [x] Added AI usage trends endpoint: `server/governance/governance-routes.ts`.
  Why: Provide time-series AI usage to help spot spikes.
  Matters: Supports operational monitoring without changing execution behavior.
- [x] Added retention policies ops endpoint: `server/governance/governance-routes.ts`.
  Why: Provide superadmin visibility into per-agency retention settings.
  Matters: Supports governance oversight before cleanup or archival changes.
- [x] Added quota warnings ops endpoint: `server/governance/governance-routes.ts`.
  Why: Provide a focused list of agencies nearing AI quota limits.
  Matters: Enables proactive governance without altering quota enforcement.
- [x] Added quota burndown endpoint: `server/governance/governance-routes.ts`.
  Why: Provide time-series quota consumption visibility from usage tracking.
  Matters: Supports trend analysis for operator planning and budget enforcement.
- [x] Added integration health ops endpoint: `server/governance/governance-routes.ts`.
  Why: Provide a summarized view of integration health statuses and expiring tokens.
  Matters: Improves operator visibility into reliability risks.
- [x] Added policy bundle write endpoints: `server/governance/governance-routes.ts`.
  Why: Enable controlled creation of policy bundles and versions.
  Matters: Supports governed rollout of policy changes without execution coupling.
- [x] Added dry-run retention cleanup execution path: `server/jobs/retention-job.ts`, `server/routes/retention-policies.ts`.
  Why: Centralize cleanup execution logic with explicit dry-run support.
  Matters: Enables safe rollout of retention deletion logic behind a dry-run flag.
- [x] Added scheduled retention cleanup job (dry-run): `server/jobs/retention-cleanup.ts`, `server/index.ts`.
  Why: Provide a scheduled validation loop for retention policies without deletion.
  Matters: Establishes operational cadence while keeping execution non-destructive.
- [x] Added archive handler hook for retention execution: `server/jobs/retention-job.ts`.
  Why: Allow future archival integration without changing route behavior.
  Matters: Enables safe rollout of archival storage when ready.
- [x] Documented retention plan preview endpoint: `docs/ROUTE_ENDPOINTS.md`.
  Why: Keep route inventory current as ops endpoints are added.
  Matters: Ensures refactor scope and endpoints remain auditable.
- [x] Documented governance ops + policy bundle endpoints: `docs/ROUTE_ENDPOINTS.md`.
  Why: Keep control-plane ops surface auditable as endpoints expand.
  Matters: Supports traceability for Phase 3 governance tooling.
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
- [x] Added InitiativeResponseService and migrated initiative response endpoint orchestration: `server/application/initiatives/initiative-response-service.ts`, `server/domain/initiatives/schemas.ts`, `server/routes/initiatives.ts`.
  Why: Move a complex multi-step approval/automation flow out of route handlers.
  Matters: Advances Phase 2 service-layer boundaries for deterministic, testable execution logic.
- [x] Added initiative response route tests (delegation + invalid payload): `tests/initiatives-route.test.ts`.
  Why: Ensure the route delegates to service and fails closed on invalid request bodies.
  Matters: Prevents regressions in control-plane to application-service boundary behavior.
- [x] Added InitiativeSendService and migrated initiative send endpoint orchestration: `server/application/initiatives/initiative-send-service.ts`, `server/routes/initiatives.ts`.
  Why: Move send + notification orchestration out of route handlers.
  Matters: Further reduces route complexity and advances Phase 2 service boundaries.
- [x] Added InitiativeDraftService and migrated initiative create/update billing orchestration: `server/application/initiatives/initiative-draft-service.ts`, `server/routes/initiatives.ts`.
  Why: Move billing normalization and validation out of route handlers.
  Matters: Keeps route surfaces thin and consolidates multi-step draft logic into testable services.
- [x] Added InitiativeLifecycleService and migrated initiative lifecycle endpoints: `server/application/initiatives/initiative-lifecycle-service.ts`, `server/routes/initiatives.ts`.
  Why: Move invoice generation, trash, restore, and permanent delete orchestration out of route handlers.
  Matters: Completes service-layer delegation across the initiatives route surface.
- [x] Added initiative service-level tests for draft/send/response/lifecycle flows: `tests/initiative-draft-service.test.ts`, `tests/initiative-send-service.test.ts`, `tests/initiative-response-service.test.ts`, `tests/initiative-lifecycle-service.test.ts`.
  Why: Validate business-logic edge paths directly (not only route delegation).
  Matters: Reduces regression risk in orchestration logic and supports Phase 2 hardening.
- [x] Added LeadEventsService and migrated lead-events integration endpoint: `server/application/integrations/lead-events-service.ts`, `server/routes/integrations.ts`.
  Why: Move multi-step client-record + integration synchronization out of route handlers.
  Matters: Extends Phase 2 service-layer boundaries beyond initiatives into integrations.
- [x] Added integration lead-events route/service tests: `tests/integrations-route.test.ts`, `tests/lead-events-service.test.ts`.
  Why: Validate delegation and fail-closed/side-effect behaviors.
  Matters: Protects client-record signal path from regressions.
- [x] Added Ga4LeadEventService and migrated GA4 lead-event PATCH endpoint: `server/application/integrations/ga4-lead-event-service.ts`, `server/routes/integrations.ts`.
  Why: Remove repeated client-record lead-event sync orchestration from route handlers.
  Matters: Further standardizes integration flows behind application services.
- [x] Added GA4 lead-event route/service tests: `tests/integrations-route.test.ts`, `tests/ga4-lead-event-service.test.ts`.
  Why: Cover delegation, fail-closed validation, and client-record sync error handling.
  Matters: Reduces regression risk on a critical integration-to-client-record path.
- [x] Added Ga4PropertyService and migrated GA4 property save endpoint: `server/application/integrations/ga4-property-service.ts`, `server/routes/integrations.ts`.
  Why: Centralize property + lead-event sync orchestration in integration services.
  Matters: Eliminates duplicated route-level sync logic and strengthens Phase 2 boundaries.
- [x] Added GA4 property route/service tests: `tests/integrations-route.test.ts`, `tests/ga4-property-service.test.ts`.
  Why: Validate delegation and fail-closed behavior for GA4 property updates.
  Matters: Protects a high-impact integration configuration path from regressions.
- [x] Added Ga4ReadService and migrated GA4 properties/key-events read endpoints: `server/application/integrations/ga4-read-service.ts`, `server/routes/integrations.ts`.
  Why: Remove duplicated token-refresh and fetch orchestration from route handlers.
  Matters: Consolidates GA4 read behavior into a single service boundary for safer maintenance.
- [x] Added GA4 read route/service tests: `tests/integrations-route.test.ts`, `tests/ga4-read-service.test.ts`.
  Why: Cover delegation plus token-refresh/error handling paths.
  Matters: Reduces regressions in integration read paths with expiring credentials.
- [x] Added GscReadService and migrated GSC sites read endpoint: `server/application/integrations/gsc-read-service.ts`, `server/routes/integrations.ts`.
  Why: Move token-refresh and Google API read orchestration out of route handlers.
  Matters: Aligns GSC integration reads with the same service boundary used for GA4.
- [x] Added GSC read route/service tests: `tests/integrations-route.test.ts`, `tests/gsc-read-service.test.ts`.
  Why: Validate route delegation and credential refresh error handling.
  Matters: Protects GSC integration reliability as tokens expire/refresh.
- [x] Added ClientIntegrationService and migrated GA4/GSC disconnect + GSC site save endpoints: `server/application/integrations/client-integration-service.ts`, `server/routes/integrations.ts`.
  Why: Move remaining client-level integration write/disconnect orchestration out of route handlers.
  Matters: Keeps integration route surfaces thin and consistently service-driven.
- [x] Added client integration route/service tests: `tests/integrations-route.test.ts`, `tests/client-integration-service.test.ts`.
  Why: Cover delegation and core failure/success paths for client integration lifecycle actions.
  Matters: Reduces regression risk in client-level integration state changes.
- [x] Added HubspotAgencyService and migrated HubSpot agency endpoints: `server/application/integrations/hubspot-agency-service.ts`, `server/routes/integrations.ts`.
  Why: Move HubSpot status/connect/disconnect/data orchestration out of route handlers.
  Matters: Shrinks integrations route complexity and standardizes agency-level integration boundaries.
- [x] Added HubSpot route/service tests: `tests/integrations-route.test.ts`, `tests/hubspot-agency-service.test.ts`.
  Why: Validate route delegation and core service paths for agency-level integration actions.
  Matters: Reduces regression risk for HubSpot operational flows.
- [x] Added LinkedinAgencyService and migrated LinkedIn agency endpoints: `server/application/integrations/linkedin-agency-service.ts`, `server/routes/integrations.ts`.
  Why: Move LinkedIn status/connect/disconnect/data orchestration out of route handlers.
  Matters: Keeps agency integration flows consistent with service-layer boundaries.
- [x] Added LinkedIn route/service tests: `tests/integrations-route.test.ts`, `tests/linkedin-agency-service.test.ts`.
  Why: Validate delegation and core service behavior for LinkedIn lifecycle actions.
  Matters: Reduces regression risk in agency-level LinkedIn integration operations.
- [x] Added ClientIntegrationStatusService and migrated GA4/GSC client status read endpoints: `server/application/integrations/client-integration-status-service.ts`, `server/routes/integrations.ts`.
  Why: Move remaining client integration status-read orchestration out of route handlers.
  Matters: Keeps integration route surfaces consistently service-driven for read/write lifecycle paths.
- [x] Added integration status route/service tests: `tests/integrations-route.test.ts`, `tests/client-integration-status-service.test.ts`.
  Why: Validate route delegation and status selection behavior for GA4/GSC client integrations.
  Matters: Reduces regression risk in client integration readiness/status checks.
- [x] Added OutcomeMetricsService and migrated outcome metrics endpoint orchestration: `server/application/analytics/outcome-metrics-service.ts`, `server/routes/analytics.ts`.
  Why: Move the densest multi-step analytics orchestration out of route handlers into a testable application service.
  Matters: Advances Phase 2 execution-model unification by shrinking route-level business logic.
- [x] Added analytics outcome-metrics route/service tests: `tests/analytics-route.test.ts`, `tests/outcome-metrics-service.test.ts`.
  Why: Validate route delegation and core fallback/comparison calculations in isolation.
  Matters: Reduces regression risk for KPI and pipeline outcome calculations.
- [x] Added AnalyticsGa4ReadService and migrated GA4 analytics read endpoints: `server/application/analytics/analytics-ga4-read-service.ts`, `server/routes/analytics.ts`.
  Why: Move GA4 conversion/channel/analytics token-refresh orchestration out of route handlers.
  Matters: Extends Phase 2 service-layer boundaries across analytics ingestion paths.
- [x] Added AnalyticsGscReadService and migrated GSC analytics read endpoints: `server/application/analytics/analytics-gsc-read-service.ts`, `server/routes/analytics.ts`.
  Why: Move GSC queries/analytics token-refresh orchestration out of route handlers.
  Matters: Keeps analytics route surfaces thin and consistent with service-driven execution.
- [x] Added GA4/GSC analytics route and service tests: `tests/analytics-route.test.ts`, `tests/analytics-ga4-read-service.test.ts`, `tests/analytics-gsc-read-service.test.ts`.
  Why: Cover delegation plus key auth/token/config failure paths for analytics reads.
  Matters: Reduces regression risk in client-facing performance reporting endpoints.
- [x] Added AiChatService and migrated AI chat route orchestration: `server/application/ai/ai-chat-service.ts`, `server/routes/ai-chat.ts`.
  Why: Move payload validation, client resolution, and initiative-creation branching out of route handlers.
  Matters: Extends Phase 2 service boundaries to AI-assisted recommendation workflows.
- [x] Added AI chat route/service tests: `tests/ai-chat-route.test.ts`, `tests/ai-chat-service.test.ts`.
  Why: Validate handler delegation plus core validation/error/status behavior in service logic.
  Matters: Reduces regression risk on AI recommendation request paths.
- [x] Added SyncMetricsService and migrated agency client metrics sync endpoint: `server/application/agency-clients/sync-metrics-service.ts`, `server/routes/agency-clients.ts`.
  Why: Move multi-step GA4/GSC metric synchronization orchestration out of route handlers.
  Matters: Reduces monolithic route risk in `agency-clients` and advances Phase 2 service boundaries.
- [x] Added agency metrics sync route/service tests: `tests/agency-clients-route.test.ts`, `tests/sync-metrics-service.test.ts`.
  Why: Validate route delegation and core sync behaviors (missing client/integration and success path).
  Matters: Reduces regression risk on an operationally sensitive data refresh endpoint.
- [x] Added StrategyCardService and migrated agency client strategy-card endpoint: `server/application/agency-clients/strategy-card-service.ts`, `server/routes/agency-clients.ts`.
  Why: Move strategy-card KPI + chat-analysis orchestration out of route handlers.
  Matters: Continues decomposing `agency-clients` monolith into testable service boundaries.
- [x] Added strategy-card route/service tests: `tests/agency-clients-route.test.ts`, `tests/strategy-card-service.test.ts`.
  Why: Validate route delegation and core service behavior for missing-client, AI failure, and success paths.
  Matters: Reduces regression risk for strategist-facing planning views.
- [x] Added DashboardSummaryService and migrated agency client dashboard-summary endpoint: `server/application/agency-clients/dashboard-summary-service.ts`, `server/routes/agency-clients.ts`.
  Why: Move multi-source dashboard aggregation (GA4/GSC/outcomes + cache) out of route handlers and reuse existing analytics services.
  Matters: Removes the largest remaining inline orchestration block in `agency-clients`.
- [x] Added dashboard-summary route/service tests: `tests/agency-clients-route.test.ts`, `tests/dashboard-summary-service.test.ts`.
  Why: Validate route delegation, cache-hit behavior, and fallback aggregation behavior.
  Matters: Reduces regression risk in client-facing dashboard summary aggregation.
- [x] Added RecommendationRequestService and migrated agency recommendations-request endpoint: `server/application/agency-clients/recommendation-request-service.ts`, `server/routes/agency-clients.ts`.
  Why: Move preset payload validation and workflow-signal orchestration out of route handlers.
  Matters: Continues decomposing `agency-clients` control flow into testable application services.
- [x] Added recommendation-request route/service tests: `tests/agency-clients-route.test.ts`, `tests/recommendation-request-service.test.ts`.
  Why: Validate route delegation plus payload/context validation and signal emission behavior.
  Matters: Reduces regression risk on strategist-triggered recommendation workflows.
- [x] Added ClientConnectionStatusService and migrated client connection-status endpoint: `server/application/agency-clients/client-connection-status-service.ts`, `server/routes/agency-clients.ts`.
  Why: Move decryption-fallback and DataForSEO source-resolution orchestration out of route handlers.
  Matters: Further decomposes `agency-clients` router while preserving resilience to encryption-key mismatch scenarios.
- [x] Added connection-status route/service tests: `tests/agency-clients-route.test.ts`, `tests/client-connection-status-service.test.ts`.
  Why: Validate route delegation plus decryption-fallback and agency/client DataForSEO source behavior.
  Matters: Reduces regression risk on integration health visibility endpoints.
- [x] Added intelligence overview/pipeline services and migrated related endpoints: `server/application/intelligence/intelligence-overview-service.ts`, `server/application/intelligence/intelligence-pipeline-service.ts`, `server/routes/intelligence-extended.ts`.
  Why: Move overview and pipeline orchestration out of monolithic intelligence route handlers.
  Matters: Advances Phase 2 service-layer boundaries in another high-density route module.
- [x] Added intelligence extended route/service tests: `tests/intelligence-overview-service.test.ts`, `tests/intelligence-pipeline-service.test.ts`, `tests/intelligence-extended-route.test.ts`.
  Why: Validate service behavior and route delegation for overview/process/compute/pipeline endpoints.
  Matters: Reduces regression risk for intelligence control-plane operations.
- [x] Added intelligence duration/resource services and migrated related endpoints: `server/application/intelligence/intelligence-duration-service.ts`, `server/application/intelligence/resource-optimization-service.ts`, `server/routes/intelligence-extended.ts`.
  Why: Move duration prediction/history/completion and resource plan generation/save orchestration out of monolithic route handlers.
  Matters: Completes service-layer extraction for the largest remaining intelligence-extended execution endpoints.
- [x] Added duration/resource route and service tests: `tests/intelligence-duration-service.test.ts`, `tests/resource-optimization-service.test.ts`, `tests/intelligence-extended-route.test.ts`.
  Why: Validate service behavior and route delegation across the migrated duration/resource endpoints.
  Matters: Reduces regression risk for scheduling and capacity-planning workflows.
- [x] Added IntelligenceCrudService and migrated remaining intelligence CRUD endpoints: `server/application/intelligence/intelligence-crud-service.ts`, `server/routes/intelligence-extended.ts`.
  Why: Move signals/insights/priorities/feedback/priority-config route orchestration into a shared application service boundary.
  Matters: Completes service-layer extraction across the monolithic intelligence-extended route surface.
- [x] Added intelligence CRUD route/service tests: `tests/intelligence-crud-service.test.ts`, `tests/intelligence-extended-route.test.ts`.
  Why: Validate fail-closed status rules and route delegation for migrated CRUD handlers.
  Matters: Reduces regression risk in intelligence control-plane CRUD workflows.
- [x] Added IntelligenceOperationsService and migrated intelligence operations endpoints from `server/routes/intelligence.ts`: `server/application/intelligence/intelligence-operations-service.ts`, `server/routes/intelligence.ts`.
  Why: Move resource optimization/commercial impact/integration/feedback-loop orchestration behind a dedicated application service boundary.
  Matters: Completes service-layer extraction for the primary `intelligence` router and reduces route-level orchestration risk.
- [x] Added intelligence operations route/service tests: `tests/intelligence-operations-service.test.ts`, `tests/intelligence-route.test.ts`.
  Why: Validate fail-closed behavior and route delegation for the migrated intelligence operations handlers.
  Matters: Reduces regression risk for intelligence planning, prioritization, and feedback-loop endpoints.
- [x] Added TaskListService and migrated agency task-list CRUD orchestration: `server/application/tasks/task-list-service.ts`, `server/routes/agency-tasks.ts`.
  Why: Move tenant-scoped task-list create/update/delete logic out of route handlers into a testable application service.
  Matters: Continues Phase 2 route decomposition and reduces monolithic route-level orchestration risk.
- [x] Added agency task-list route/service tests: `tests/task-list-service.test.ts`, `tests/agency-tasks-route.test.ts`.
  Why: Validate fail-closed validation, tenant isolation checks, and route delegation behavior.
  Matters: Reduces regression risk for agency task-list lifecycle operations.
- [x] Added TaskQueryService and migrated agency task/staff-assignment list orchestration: `server/application/tasks/task-query-service.ts`, `server/routes/agency-tasks.ts`.
  Why: Move agency-scope resolution and task/project enrichment reads out of route handlers.
  Matters: Continues Phase 2 route decomposition with cleaner read-path service boundaries.
- [x] Added task query route/service tests: `tests/task-query-service.test.ts`, `tests/agency-tasks-route.test.ts`.
  Why: Validate fail-closed agency-scope checks and route delegation for task/staff-assignment list endpoints.
  Matters: Reduces regression risk for strategist task visibility and staffing overview paths.
- [x] Added TaskAssignmentService and migrated task assignment mutator endpoints: `server/application/tasks/task-assignment-service.ts`, `server/routes/agency-tasks.ts`.
  Why: Move assignment/unassignment validation + activity logging out of route handlers into a testable service boundary.
  Matters: Continues Phase 2 route decomposition and reduces inline mutation orchestration risk.
- [x] Added task assignment route/service tests: `tests/task-assignment-service.test.ts`, `tests/agency-tasks-route.test.ts`.
  Why: Validate fail-closed behavior and delegation for assign/unassign task endpoints.
  Matters: Reduces regression risk for staffing mutation workflows and task activity audit writes.
- [x] Added TaskMutationService and migrated task create/update/delete mutator endpoints: `server/application/tasks/task-mutation-service.ts`, `server/routes/agency-tasks.ts`.
  Why: Move task validation, state mutation, and duration-intelligence side-effect orchestration out of route handlers.
  Matters: Continues Phase 2 decomposition of `agency-tasks` and reduces inline mutation complexity.
- [x] Added task mutation route/service tests: `tests/task-mutation-service.test.ts`, `tests/agency-tasks-route.test.ts`.
  Why: Validate fail-closed request checks plus route delegation for task create/update/delete flows.
  Matters: Reduces regression risk for core task lifecycle mutation paths.

### Planned (Open)
- [ ] Continue migrating remaining multi-step route orchestration into application services (Phase 2).
- Why: Some complex endpoints still contain orchestration logic in route handlers.
- Matters: Completes service-layer boundaries across the execution model.
- [ ] Backfill changelog entries for work prior to 2026-02-10.
- Why: Establish historical audit trail.
- Matters: Improves traceability for future audits.
