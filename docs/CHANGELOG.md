# Changelog

Tracks refactoring and modernization work with dates, completion status, and planned work.

## 2026-02-11

### Phase 2 Completion Checklist
- [x] `server/routes.ts` reduced to compatibility shim ownership only.
- [x] No duplicate endpoint ownership between monolith shim and modular routers (audit completed).
- [x] `server/routes/**/*.ts` inline async route handlers eliminated and regression-guarded (`tests/route-inline-guard.test.ts`).
- [x] Route-level multi-step orchestration migrated behind `server/application/**` services across active modular route modules.
- [x] Legacy monolith backup (`server/routes.ts.backup`) removed.

### Completed
- [x] Decomposed workflow-executions routes into application service boundary: `server/application/workflows/workflow-executions-service.ts`, `server/routes/workflow-executions.ts`.
  Why: Remove inline execution events/lineage orchestration from route handlers.
  Matters: Continues route-layer simplification and centralizes execution lineage logic.
- [x] Added workflow-executions service/route tests and reduced inline-handler allowlist: `tests/workflow-executions-service.test.ts`, `tests/workflow-executions-route.test.ts`, `tests/route-inline-guard.test.ts`.
  Why: Lock in delegation behavior and prevent regressions back to inline route orchestration.
  Matters: Shrinks remaining legacy inline-route surface.
- [x] Decomposed lineage route handlers into application service boundary: `server/application/lineage/lineage-service.ts`, `server/routes/lineage.ts`.
  Why: Remove remaining inline lineage orchestration from route layer.
  Matters: Shrinks legacy inline-handler surface and improves testability.
- [x] Added lineage service/route tests and tightened inline-handler allowlist: `tests/lineage-service.test.ts`, `tests/lineage-route.test.ts`, `tests/route-inline-guard.test.ts`.
  Why: Lock in route-to-service delegation and prevent regression to inline lineage handlers.
  Matters: Continues controlled reduction of legacy inline route debt.
- [x] Added account-manager backfill migration for existing clients: `migrations/0014_backfill_client_account_manager.sql`.
  Why: Ensure pre-existing clients get deterministic owner assignment after introducing `accountManagerProfileId`.
  Matters: Reduces fallback-notification fanout and improves ownership consistency in client messaging.
- [x] Removed CRM-linked public forms feature end-to-end: `server/routes/public.ts`, `server/application/public/public-form-service.ts`, `client/src/pages/forms/embed.tsx`, `server/routes/index.ts`, `client/src/App.tsx`.
  Why: Public forms were coupled to CRM enrichment (`createContact`/`createDeal`) and CRM is out of scope.
  Matters: Eliminates an out-of-scope feature surface and associated unauthenticated mutation endpoints.
- [x] Removed public-form tests and docs references: `tests/public-route.test.ts`, `tests/public-form-service.test.ts`, `tests/public-inv1-exception.test.ts`, `docs/INVARIANTS.refactor.md`, `docs/ROUTE_INVENTORY.md`, `docs/ROUTE_ENDPOINTS.md`, `docs/PRODUCTION_URLS.md`.
  Why: Keep test and documentation surface aligned with removed runtime capability.
  Matters: Prevents stale guidance and false expectations around unavailable endpoints.
- [x] Enforced Admin/SuperAdmin role gate on signals control-plane routes: `server/routes/signals.ts`.
  Why: Prevent non-admin authenticated roles from managing signal intake/routing and retries.
  Matters: Aligns signal-governance endpoints with control-plane authorization boundaries.
- [x] Added signals guard regression test: `tests/control-plane-role-guard.test.ts`.
  Why: Prevent accidental removal of privileged-route enforcement.
  Matters: Reduces RBAC drift risk in control-plane modules.
- [x] Enforced Admin/SuperAdmin role gate on rule-engine control-plane routes: `server/routes/rule-engine.ts`.
  Why: Prevent non-admin authenticated roles from mutating workflow-rule configuration.
  Matters: Aligns rule-governance endpoints with control-plane authorization boundaries.
- [x] Added rule-engine guard regression test: `tests/control-plane-role-guard.test.ts`.
  Why: Prevent accidental removal of privileged-route enforcement.
  Matters: Reduces RBAC drift risk in control-plane modules.
- [x] Added client account-manager linkage to schema + migration: `shared/schema.ts`, `migrations/0013_add_client_account_manager.sql`.
  Why: Support explicit ownership of client communications by a single agency admin.
  Matters: Enables deterministic message routing to the assigned account manager.
- [x] Added account-manager assignment during client user provisioning: `server/application/agency-users/agency-user-service.ts`, `server/lib/user-provisioning.ts`, `server/routes/agency-users.ts`.
  Why: Ensure newly created clients are tied to an admin owner by default (creator) or explicit selection.
  Matters: Prevents ambiguous ownership in client-to-agency messaging flows.
- [x] Routed client message notifications to assigned account manager with safe fallback: `server/application/client/client-message-service.ts`.
  Why: Align client messaging behavior with account-manager ownership model.
  Matters: Reduces noisy admin fanout and improves accountability.
- [x] Added regression tests for assignment + routing behavior: `tests/agency-user-service.test.ts`, `tests/agency-users-route.test.ts`, `tests/client-message-service.test.ts`.
  Why: Lock in expected ownership and notification behavior.
  Matters: Prevents access/notification behavior regressions.
- [x] Enforced Admin/SuperAdmin role gate across workflows control-plane routes: `server/routes/workflows.ts`.
  Why: Ensure non-admin team users cannot create/update/delete/execute workflows.
  Matters: Aligns control-plane route access with INV1 and stated team-role boundaries.
- [x] Secured test user creation route behind auth + SuperAdmin role: `server/routes/test.ts`.
  Why: Remove unauthenticated mutation surface from development utility endpoint.
  Matters: Brings the endpoint into invariant-aligned access control.
- [x] Improved route inline-handler guard to detect aliased routers and added explicit legacy allowlist: `tests/route-inline-guard.test.ts`.
  Why: Prevent false-green checks when inline handlers use non-`router` aliases.
  Matters: Makes decomposition guard behavior explicit and trustworthy while legacy modules are still tracked.
- [x] Added control-plane role guard regression tests: `tests/control-plane-role-guard.test.ts`.
  Why: Prevent accidental removal of workflow/test route role guards.
  Matters: Reduces risk of privileged route access drift.
- [x] Updated route inventory status checkpoint and snapshot date: `docs/ROUTE_INVENTORY.md`.
  Why: Reflect current decomposition state and remaining shim/backup surface explicitly.
  Matters: Keeps modernization progress auditable with a current architecture snapshot.
- [x] Added explicit Phase 2 status + closure checklist: `docs/REBUILD_PLAN.md`.
  Why: Make remaining Phase 2 closure work concrete now that inline route decomposition is complete.
  Matters: Clarifies what is left before full Phase 3 focus.
- [x] Completed duplicate endpoint ownership audit for compatibility shim: `server/routes.ts`, `server/routes/index.ts`.
  Why: Verify that the shim route file does not still own route-method endpoints that conflict with modular routers.
  Matters: Confirms Phase 2 endpoint ownership consolidation is holding; `server/routes.ts` currently contains only middleware boundaries and router mounts.
- [x] Removed legacy monolith backup file: `server/routes.ts.backup`.
  Why: Close Phase 2 cleanup decision and eliminate stale monolith reference from the active repository surface.
  Matters: Reduces confusion around route ownership and makes the modular router architecture explicit.
- [x] Expanded pre-2026-02-10 historical backfill with dated module-level milestones: `docs/CHANGELOG.md`.
  Why: Replace generic historical placeholders with concrete development waves and artifact references.
  Matters: Improves traceability for architecture decisions leading into the rebuild phases.

### Planned (Deferred)
- [ ] Decompose remaining legacy inline route modules:
  - `server/routes/workflows.ts`
  - `server/routes/tasks.ts`
  - `server/routes/invoices.ts`
  - `server/routes/knowledge.ts`
  - `server/routes/knowledge-documents.ts`
- Why: These modules still rely on inline route orchestration patterns kept on the temporary allowlist.
- Matters: Completing these removals is the remaining path to full route-layer decomposition consistency.

## 2025-10-15 to 2026-02-09 (Historical Backfill, Initial)

### Completed
- [x] Established modular route registry and domain router mounting (`server/routes/index.ts`) with progressive extraction away from monolithic routing (`server/routes.ts`) during 2025-12-12.
  Why: Create explicit ownership boundaries by domain and reduce route-level coupling.
  Matters: Enabled later Phase 2 service decomposition and endpoint ownership audits.
- [x] Added workflow/rule/signal primitives across schema + routes + engine integration during 2025-12-11 to 2025-12-12 (`shared/schema.ts`, `server/workflow/engine.ts`, `server/routes/rule-engine.ts`, `server/routes/signals.ts`).
  Why: Introduce control-plane decisioning and event routing foundation.
  Matters: Supports governed automation and idempotent signal-driven execution patterns.
- [x] Added hardened AI execution controls and usage/quota governance during 2025-12-11 and 2026-02-10 (`server/ai/hardened-executor.ts`, AI usage endpoints/tests).
  Why: Move AI execution behind schema-validated, auditable, policy-constrained boundaries.
  Matters: Enforces fail-closed behavior and supports INV4-style AI hardening.
- [x] Added governance/ops visibility surfaces and retention scaffolding during 2025-12-11 and 2026-02-10 (`server/governance/governance-routes.ts`, `server/jobs/retention-job.ts`).
  Why: Provide operational insight and lifecycle controls over control-plane activity and AI usage.
  Matters: Establishes Phase 3 observability and retention foundations.
- [x] Added initiative/opportunity gate-related artifacts and API surfaces during 2025-11-18 through 2026-02-10 (`server/routes/opportunities.ts`, `server/routes/initiative-intents.ts`, `server/routes/sku-compositions.ts`, `server/routes/execution-outputs.ts`, `server/routes/outcome-reviews.ts`, `server/routes/learning-artifacts.ts`).
  Why: Introduce explicit governed artifacts across recommendation, approval, execution, outcome, and learning loops.
  Matters: Aligns platform behavior with the full validation loop doctrine.
- [x] Removed CRM runtime surface from active platform in current rebuild direction (2026-02-11 workspace state) by deleting CRM route/module usage (`server/routes/crm.ts`, `server/crm/*`, CRM UI components).
  Why: Align implementation with current product scope decision: CRM is not a feature.
  Matters: Reduces inactive surface area and removes conflicting feature paths.

## 2025-10-15 to 2025-12-12 (Historical Backfill, Expanded)

### 2025-12-12 Modular Router Extraction Wave
- [x] Broke monolithic route ownership into dedicated modules for auth/user/client/agency/staff/superadmin/invoices/tasks/public/signals/rules/workflows/knowledge/intelligence (`server/routes/*.ts`, `server/routes/index.ts`).
  Why: Incrementally replace large route file ownership with explicit domain registration.
  Matters: Established the structural base for later service-layer decomposition and route ownership audits.
- [x] Added middleware and guard coverage around auth/maintenance boundaries in tests (`tests/middleware/*` additions in this window).
  Why: Protect ingress behavior while routing structure changed quickly.
  Matters: Reduced regression risk during large route-surface extraction.

### 2025-12-11 Control Plane + Governance Foundations
- [x] Introduced workflow rule/signal primitives and workflow engine schema support (`shared/schema.ts`, `server/workflow/engine.ts`, `server/routes/rule-engine.ts`, `server/routes/signals.ts`).
  Why: Provide governed automation paths for signal intake, evaluation, and execution.
  Matters: Enabled idempotent, auditable control-plane operation patterns used in the rebuild.
- [x] Added AI execution tracking/security/usage governance and retention-aligned controls (`server/ai/hardened-executor.ts`, AI execution/usage schema + routes).
  Why: Constrain AI calls behind explicit execution records and quota-aware controls.
  Matters: Improved fail-closed behavior and operator visibility for AI workloads.
- [x] Added governance dashboard and operational primitives (quota visibility, integration health, SLA/templating/agent groundwork).
  Why: Build operator-facing control-plane observability.
  Matters: Became the base for Phase 3 ops endpoint expansion in 2026-02.

### 2025-11 Delivery/Access/Integration Hardening
- [x] Added superadmin account/credential/agency-selection capabilities and audit-oriented admin flows (`server/routes/superadmin.ts`, related schema updates).
  Why: Formalize platform-level administrative control boundaries.
  Matters: Improved tenant-safe governance of privileged actions.
- [x] Added and iterated agency integration surfaces for HubSpot/LinkedIn and AI provider preferences (`server/routes/integrations.ts` + schema/UI integration wiring).
  Why: Expand client context ingestion and configurable AI provider behavior.
  Matters: Prepared data-plane inputs used by recommendation and intelligence features.
- [x] Expanded task lifecycle integrity (task lists, tenant isolation in task-list paths, activity timeline, time tracking/linking refinements).
  Why: Stabilize execution-plane tracking fidelity and cross-role visibility.
  Matters: Improved operational reliability of task execution records used downstream.

### 2025-10 Security + Export Foundations
- [x] Landed early production-hardening work: CI/CD/security posture updates, encryption key handling updates, production URL automation docs.
  Why: Improve deployment and runtime security baselines during rapid feature expansion.
  Matters: Reduced operational risk while architecture evolved.
- [x] Added invoice PDF generation/storage and proposal print/export hardening groundwork (`server/services/pdfStorage.ts`, proposals/invoice export surfaces).
  Why: Support auditable document output workflows.
  Matters: Established the static invoice serving path now retained in `server/routes.ts` shim.

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
- [x] Added route inline-handler regression guard test: `tests/route-inline-guard.test.ts`.
  Why: Enforce that `server/routes` remains free of inline async route handlers after decomposition.
  Matters: Prevents accidental architecture drift back to route-level orchestration.
- [x] Added TestUserService and migrated test create-user handler: `server/application/test/test-user-service.ts`, `server/routes/test.ts`.
  Why: Move development-only test user creation orchestration out of route-level inline logic.
  Matters: Completes route decomposition pattern consistency even for utility endpoints.
- [x] Added test user service + route delegation tests: `tests/test-user-service.test.ts`, `tests/test-route.test.ts`.
  Why: Validate environment gating/default-agency behavior and route-to-service delegation.
  Matters: Prevents regressions in development tooling while keeping architecture consistent.
- [x] Added MessageStreamService and migrated SSE stream handler: `server/application/messages/message-stream-service.ts`, `server/routes/messages.ts`.
  Why: Move SSE stream authentication/authorization checks out of route-level inline logic.
  Matters: Keeps message routes fully service-backed while preserving stream behavior.
- [x] Added message stream service + route tests: `tests/message-stream-service.test.ts`, `tests/messages-route.test.ts`.
  Why: Validate stream auth guardrails and route delegation behavior.
  Matters: Prevents regressions as remaining inline handlers approach zero.
- [x] Added OAuthService and migrated Google OAuth handlers: `server/application/oauth/oauth-service.ts`, `server/routes/oauth.ts`.
  Why: Move OAuth initiation/callback orchestration and redirect/html branching out of route handlers.
  Matters: Centralizes OAuth validation and token/state flow with deterministic, testable behavior.
- [x] Added OAuth service + route delegation tests: `tests/oauth-service.test.ts`, `tests/oauth-route.test.ts`.
  Why: Validate OAuth guardrails and route-to-service delegation for initiate/callback flows.
  Matters: Prevents regressions while closing remaining inline route decomposition.
- [x] Added AiExecutionService and migrated AI execution handlers: `server/application/ai/ai-execution-service.ts`, `server/routes/ai-execution.ts`.
  Why: Move AI execution access checks, usage retrieval, and cache operations out of route handlers.
  Matters: Keeps AI execution routes thin and centralizes fail-closed authorization behavior.
- [x] Added AI execution service + route delegation tests: `tests/ai-execution-service.test.ts`, `tests/ai-execution-route.test.ts`.
  Why: Validate authorization guardrails and route-to-service delegation for AI execution endpoints.
  Matters: Prevents regressions while finishing remaining inline route decomposition.
- [x] Added RetentionPolicyService and migrated retention policy handlers: `server/application/retention/retention-policy-service.ts`, `server/routes/retention-policies.ts`.
  Why: Move retention policy CRUD, access checks, and cleanup orchestration selection out of route handlers.
  Matters: Keeps retention routes thin and centralizes fail-closed governance behavior.
- [x] Added retention policy service + route delegation tests: `tests/retention-policy-service.test.ts`, `tests/retention-policies-route.test.ts`.
  Why: Validate tenant/role guardrails and route-to-service delegation for retention endpoints.
  Matters: Prevents regressions while continuing Phase 2 decomposition.
- [x] Added MetricService and migrated metrics create handler: `server/application/metrics/metric-service.ts`, `server/routes/metrics.ts`.
  Why: Move metric creation orchestration out of route handlers into an application service boundary.
  Matters: Keeps metrics route thin and consistent with Phase 2 decomposition patterns.
- [x] Added metric service + route delegation tests: `tests/metric-service.test.ts`, `tests/metrics-route.test.ts`.
  Why: Validate service behavior and route-to-service delegation.
  Matters: Prevents regressions while continuing route decomposition.
- [x] Added ProposalPrintService and migrated proposal print handlers: `server/application/proposals/proposal-print-service.ts`, `server/routes/proposals.ts`.
  Why: Move proposal print token issuance and printable HTML rendering logic out of route handlers.
  Matters: Keeps proposal routes thin and centralizes permission/token checks for print/export flows.
- [x] Added proposal print service + route delegation tests: `tests/proposal-print-service.test.ts`, `tests/proposals-route.test.ts`.
  Why: Validate print token/authorization guardrails and route-to-service delegation.
  Matters: Prevents regressions while continuing Phase 2 decomposition.
- [x] Added PublicFormService and migrated public form handlers: `server/application/public/public-form-service.ts`, `server/routes/public.ts`.
  Why: Move public form metadata/submission orchestration (honeypot, required-field validation, optional contact/deal enrichment) out of route handlers.
  Matters: Keeps public routes thin and fail-closed while preserving existing behavior.
- [x] Added public form service + route delegation tests: `tests/public-form-service.test.ts`, `tests/public-route.test.ts`.
  Why: Validate form submission guardrails and route-to-service delegation.
  Matters: Prevents regressions during Phase 2 route decomposition.
- [x] Added AuthService and migrated auth handlers: `server/application/auth/auth-service.ts`, `server/routes/auth.ts`.
  Why: Move signup/login/refresh orchestration and profile context resolution out of route handlers.
  Matters: Keeps auth routes thin and enforces fail-closed auth response behavior in a testable service layer.
- [x] Added auth service + route delegation tests: `tests/auth-service.test.ts`, `tests/auth-route.test.ts`.
  Why: Validate auth guardrails and route-to-service delegation.
  Matters: Prevents regressions while continuing Phase 2 route decomposition.
- [x] Added RuleEngineService and migrated workflow rule endpoints: `server/application/rules/rule-engine-service.ts`, `server/routes/rule-engine.ts`.
  Why: Move rule CRUD/version/publish/audit evaluation orchestration out of route handlers.
  Matters: Centralizes validation and tenant access checks for control-plane rule governance.
- [x] Added rule-engine service + route delegation tests: `tests/rule-engine-service.test.ts`, `tests/rule-engine-route.test.ts`.
  Why: Validate fail-closed service behavior and route-to-service delegation for all rule endpoints.
  Matters: Prevents regressions during Phase 2 route decomposition.
- [x] Added SignalService and migrated signal ingestion/route-management handlers: `server/application/signals/signal-service.ts`, `server/routes/signals.ts`.
  Why: Move signal validation, tenant checks, and route schema parsing out of route handlers.
  Matters: Keeps signal routes thin and centralizes fail-closed behavior for workflow signal governance.
- [x] Added signal service + route delegation tests: `tests/signal-service.test.ts`, `tests/signals-route.test.ts`.
  Why: Validate service guardrails and route-to-service delegation for signal endpoints.
  Matters: Prevents regressions while continuing Phase 2 route decomposition.
- [x] Added AgencySettingsService and migrated agency settings handlers: `server/application/agency/agency-settings-service.ts`, `server/routes/agency-settings.ts`.
  Why: Move agency settings/branding and logo orchestration out of route handlers into a testable application service.
  Matters: Keeps route layer thin with fail-closed validation and centralized side-effect handling.
- [x] Added agency settings service + route delegation tests: `tests/agency-settings-service.test.ts`, `tests/agency-settings-route.test.ts`.
  Why: Validate settings/branding guardrails and route-to-service delegation behavior.
  Matters: Prevents regressions during Phase 2 route decomposition.
- [x] Added MessageService and migrated message mutation/analysis handlers: `server/application/messages/message-service.ts`, `server/routes/messages.ts`.
  Why: Move message validation, write orchestration, and AI conversation analysis out of route handlers.
  Matters: Keeps route layer thin and enforces fail-closed behavior in a testable service boundary.
- [x] Added message service + route delegation tests: `tests/messages-service.test.ts`, `tests/messages-route.test.ts`.
  Why: Verify service behavior and route-to-service delegation for message endpoints.
  Matters: Prevents regressions while continuing Phase 2 route decomposition.
- [x] Added agency initiative/project services and migrated remaining inline agency handlers: `server/application/agency/agency-initiative-service.ts`, `server/application/agency/agency-project-service.ts`, `server/routes/agency.ts`.
  Why: Complete route-to-service decomposition for initiative mark-viewed and project workflows.
  Matters: Reduces inline orchestration in routes and keeps validation/authorization behavior centralized and testable.
- [x] Added agency initiative/project service + route delegation tests: `tests/agency-initiative-service.test.ts`, `tests/agency-project-service.test.ts`, `tests/agency-route.test.ts`.
  Why: Lock in handler delegation and fail-closed service behavior for project/initiative flows.
  Matters: Prevents regression while continuing Phase 2 route decomposition.
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
- [x] Added TaskReadService and migrated remaining direct-read task endpoints: `server/application/tasks/task-read-service.ts`, `server/routes/agency-tasks.ts`.
  Why: Move task-list tasks/subtasks/activities read orchestration out of inline route handlers.
  Matters: Completes the main `agency-tasks` service-boundary extraction for Phase 2.
- [x] Added task read route/service tests: `tests/task-read-service.test.ts`, `tests/agency-tasks-route.test.ts`.
  Why: Validate route delegation and stable read-path behavior for list/subtask/activity endpoints.
  Matters: Reduces regression risk across task read views consumed by agency workflows.
- [x] Added SuperadminReadService and migrated superadmin read endpoints: `server/application/superadmin/superadmin-read-service.ts`, `server/routes/superadmin.ts`.
  Why: Move superadmin users/agencies/clients/recommendations/audit-log read orchestration into a dedicated service boundary.
  Matters: Starts decomposing one of the largest remaining route modules with low-risk read-path extraction first.
- [x] Added superadmin read route/service tests: `tests/superadmin-read-service.test.ts`, `tests/superadmin-route.test.ts`.
  Why: Validate query parsing, recommendation join behavior, and route delegation for migrated read endpoints.
  Matters: Reduces regression risk while expanding coverage over platform-level admin visibility endpoints.
- [x] Added SuperadminUserService and migrated superadmin user mutation endpoints: `server/application/superadmin/superadmin-user-service.ts`, `server/routes/superadmin.ts`.
  Why: Move superadmin user email/password/role/promotion/delete orchestration behind a dedicated service boundary with structured audit payloads.
  Matters: Continues decomposition of `superadmin` while preserving platform audit expectations for privileged mutations.
- [x] Added superadmin user mutation route/service tests: `tests/superadmin-user-service.test.ts`, `tests/superadmin-route.test.ts`.
  Why: Validate fail-closed validation and route delegation for privileged user mutation operations.
  Matters: Reduces regression risk on high-impact superadmin account management flows.
- [x] Added SuperadminAgencyService and migrated agency/client/settings superadmin endpoints: `server/application/superadmin/superadmin-agency-service.ts`, `server/routes/superadmin.ts`.
  Why: Move agency/client delete and agency settings read/write orchestration behind a dedicated service boundary with structured audit payloads.
  Matters: Further decomposes `superadmin` route complexity and centralizes privileged agency mutation logic.
- [x] Added superadmin agency/settings route/service tests: `tests/superadmin-agency-service.test.ts`, `tests/superadmin-route.test.ts`.
  Why: Validate fail-closed behavior and route delegation for privileged agency/client/settings operations.
  Matters: Reduces regression risk for superadmin tenant-wide configuration and deletion flows.
- [x] Added SuperadminRecommendationService and migrated superadmin recommendation-request endpoint: `server/application/superadmin/superadmin-recommendation-service.ts`, `server/routes/superadmin.ts`.
  Why: Move client lookup, payload validation, workflow signal emission, and structured audit payload creation out of route handlers.
  Matters: Keeps recommendation-request orchestration aligned with Phase 2 service boundaries and preserves workflow-engine routing discipline.
- [x] Added superadmin recommendation request route/service tests: `tests/superadmin-recommendation-service.test.ts`, `tests/superadmin-route.test.ts`.
  Why: Validate fail-closed payload handling and route delegation for superadmin recommendation requests.
  Matters: Reduces regression risk in platform-level recommendation trigger flow.
- [x] Added OpportunityRecommendationRequestService and migrated opportunities `ai_generate` orchestration: `server/application/opportunities/opportunity-recommendation-request-service.ts`, `server/routes/opportunities.ts`.
  Why: Move workflow signal trigger orchestration out of `createOpportunityHandler` and into a dedicated service boundary.
  Matters: Continues Phase 2 decomposition and keeps recommendation-trigger behavior consistent across route modules.
- [x] Added opportunities recommendation trigger route/service tests: `tests/opportunities-route.test.ts`, `tests/opportunity-recommendation-request-service.test.ts`.
  Why: Validate route delegation and fail-closed request context checks for AI recommendation trigger flow.
  Matters: Reduces regression risk for opportunity recommendation routing into the workflow engine.
- [x] Added OpportunityReadService and migrated opportunity client-list read endpoint: `server/application/opportunities/opportunity-read-service.ts`, `server/routes/opportunities.ts`.
  Why: Move inline opportunity artifact read orchestration into a dedicated service boundary.
  Matters: Keeps opportunities route handlers consistent with Phase 2 service-layer decomposition.
- [x] Added opportunity read route/service tests: `tests/opportunity-read-service.test.ts`, `tests/opportunities-route.test.ts`.
  Why: Validate read-path delegation for client-scoped opportunity artifact listing.
  Matters: Reduces regression risk for strategist opportunity history views.
- [x] Added initiative intent read service path and migrated GET endpoint: `server/application/initiatives/initiative-intent-service.ts`, `server/routes/initiative-intents.ts`.
  Why: Move inline initiative intent lookup orchestration into the initiative intent service boundary.
  Matters: Keeps initiative-intents route fully service-backed under the Phase 2 decomposition pattern.
- [x] Added initiative intent read route/service tests: `tests/initiative-intent-service.test.ts`, `tests/initiative-intents-route.test.ts`.
  Why: Validate not-found and delegation behavior for initiative intent retrieval.
  Matters: Reduces regression risk for strategist intent review workflows.
- [x] Added NotificationService and migrated notifications route handlers: `server/application/notifications/notification-service.ts`, `server/routes/notifications.ts`.
  Why: Move notifications list/unread/mark-read/archive/mark-all-read orchestration out of inline route handlers.
  Matters: Continues Phase 2 decomposition and standardizes read/mutation route delegation in user-notification flows.
- [x] Added notifications route/service tests: `tests/notification-service.test.ts`, `tests/notifications-route.test.ts`.
  Why: Validate delegation and response-shape behavior for notification endpoints.
  Matters: Reduces regression risk for user notification visibility and acknowledgement actions.
- [x] Added AgencyUserService and migrated agency user list/role/delete endpoints: `server/application/agency-users/agency-user-service.ts`, `server/routes/agency-users.ts`.
  Why: Move agency user management read/mutation orchestration out of inline route handlers.
  Matters: Continues Phase 2 decomposition while preserving existing role/self-delete safeguards.
- [x] Added agency user route/service tests: `tests/agency-user-service.test.ts`, `tests/agency-users-route.test.ts`.
  Why: Validate fail-closed role validation and route delegation for agency user management handlers.
  Matters: Reduces regression risk in admin-facing user management operations.
- [x] Migrated agency user provisioning endpoints to AgencyUserService: `server/application/agency-users/agency-user-service.ts`, `server/routes/agency-users.ts`.
  Why: Move client/staff/admin provisioning orchestration out of inline route handlers while preserving validation and response contracts.
  Matters: Completes service-backed decomposition of `agency-users` route operations in Phase 2.
- [x] Expanded agency user provisioning route/service tests: `tests/agency-user-service.test.ts`, `tests/agency-users-route.test.ts`.
  Why: Validate fail-closed schema handling and route delegation for user provisioning flows.
  Matters: Reduces regression risk for privileged user creation paths.
- [x] Added ObjectiveService and migrated objectives route handlers: `server/application/objectives/objective-service.ts`, `server/routes/objectives.ts`.
  Why: Move inline objective CRUD orchestration out of route handlers into a dedicated service boundary.
  Matters: Continues Phase 2 decomposition for client objective management endpoints.
- [x] Added objectives route/service tests: `tests/objective-service.test.ts`, `tests/objectives-route.test.ts`.
  Why: Validate fail-closed create validation and route delegation for objective CRUD handlers.
  Matters: Reduces regression risk for strategist objective lifecycle operations.
- [x] Added UserProfileService and migrated user profile route handlers: `server/application/user/user-profile-service.ts`, `server/routes/user.ts`.
  Why: Move profile read/update orchestration out of inline route handlers into a dedicated service boundary.
  Matters: Continues Phase 2 decomposition and standardizes profile endpoint delegation.
- [x] Added user profile route/service tests: `tests/user-profile-service.test.ts`, `tests/user-route.test.ts`.
  Why: Validate fail-closed profile validation and route delegation for user profile operations.
  Matters: Reduces regression risk for authenticated profile management flows.
- [x] Added StaffReadService and migrated staff route handlers: `server/application/staff/staff-read-service.ts`, `server/routes/staff.ts`.
  Why: Move staff task and notification read orchestration out of inline route handlers into a dedicated service boundary.
  Matters: Continues Phase 2 decomposition and centralizes staff-specific read behavior.
- [x] Added staff route/service tests: `tests/staff-read-service.test.ts`, `tests/staff-route.test.ts`.
  Why: Validate fail-closed agency/profile checks and route delegation for staff endpoints.
  Matters: Reduces regression risk for staff task visibility and notification count flows.
- [x] Added ClientReadService and migrated client profile/notification-count handlers: `server/application/client/client-read-service.ts`, `server/routes/client.ts`.
  Why: Move client profile and notification count read orchestration out of inline route handlers.
  Matters: Continues Phase 2 decomposition in `client` route while preserving response contracts.
- [x] Added client profile/notification route/service tests: `tests/client-read-service.test.ts`, `tests/client-route.test.ts`.
  Why: Validate fail-closed client-profile lookup behavior and route delegation for client reads.
  Matters: Reduces regression risk for client-facing profile and notification counters.
- [x] Added ClientPortfolioService and migrated client projects/invoices/initiatives handlers: `server/application/client/client-portfolio-service.ts`, `server/routes/client.ts`.
  Why: Move role-aware portfolio listing orchestration out of inline client route handlers.
  Matters: Continues Phase 2 decomposition and centralizes shared admin/client list behavior.
- [x] Added client portfolio route/service tests: `tests/client-portfolio-service.test.ts`, `tests/client-route.test.ts`.
  Why: Validate fail-closed admin agency checks and route delegation for portfolio endpoints.
  Matters: Reduces regression risk for client/admin portfolio listing flows.
- [x] Added ClientWorkspaceService and migrated client workspace read handlers: `server/application/client/client-workspace-service.ts`, `server/routes/client.ts`.
  Why: Move recent tasks, projects-with-tasks, objectives, and messages read orchestration out of inline handlers.
  Matters: Continues Phase 2 decomposition in `client` route and centralizes client workspace read logic.
- [x] Added client workspace route/service tests: `tests/client-workspace-service.test.ts`, `tests/client-route.test.ts`.
  Why: Validate empty-client fallback and route delegation behavior for workspace endpoints.
  Matters: Reduces regression risk for client dashboard read flows.
- [x] Added ClientMessageService and migrated client message-create handler: `server/application/client/client-message-service.ts`, `server/routes/client.ts`.
  Why: Move client message creation and non-blocking admin notification fanout out of inline route logic.
  Matters: Completes service-backed decomposition of `client` route handlers in this module.
- [x] Added client message route/service tests: `tests/client-message-service.test.ts`, `tests/client-route.test.ts`.
  Why: Validate fail-closed subject/content checks, notification fanout resilience, and route delegation.
  Matters: Reduces regression risk for client-to-agency messaging workflows.
- [x] Added AgencyReadService and migrated agency read-cluster handlers: `server/application/agency/agency-read-service.ts`, `server/routes/agency.ts`.
  Why: Move metrics/initiatives/integrations/staff/messages/notification-count orchestration out of inline route handlers.
  Matters: Continues Phase 2 decomposition for `agency` route while preserving agency guard and superadmin staff behavior.
- [x] Added agency read route/service tests: `tests/agency-read-service.test.ts`, `tests/agency-route.test.ts`.
  Why: Validate fail-closed agency guard behavior and route delegation for agency read handlers.
  Matters: Reduces regression risk for strategist/admin dashboard read paths.
- [x] Added AgencyClientService and migrated agency client handlers: `server/application/agency/agency-client-service.ts`, `server/routes/agency.ts`.
  Why: Move agency client list/detail/update/retainer/metrics orchestration out of inline route handlers.
  Matters: Continues Phase 2 decomposition for `agency` route client-management flows.
- [x] Expanded agency route/service tests for client handlers: `tests/agency-client-service.test.ts`, `tests/agency-route.test.ts`.
  Why: Validate fail-closed missing-client behavior and route delegation for agency client operations.
  Matters: Reduces regression risk for strategist client management endpoints.
