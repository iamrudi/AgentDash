# System Invariants (INV1..INV5)

Each invariant includes the enforcement boundary and how to test/falsify it.

## INV1 — Protected APIs Require Authenticated Principal

- **Statement**: Protected routes must reject requests without valid auth context.
- **Enforced by**:
  - `server/middleware/supabase-auth.ts` (`requireAuth`)
  - Route mounting usage across `server/routes/*.ts`
  - Governance wrapper in `server/routes.ts` (`app.use("/api/governance", requireAuth, ...)`)
- **How enforced**: Missing/invalid bearer token returns `401`.
- **Falsifiable check**: Call a protected route without bearer token and assert `401`.

## INV2 — Tenant Isolation: No Cross-Agency Access (Except SuperAdmin)

- **Statement**: Non-superadmin users must not access resources outside their agency/client scope.
- **Enforced by**:
  - `server/middleware/supabase-auth.ts` (`verifyClientAccess`, `verifyProjectAccess`, `verifyTaskAccess`, `require*Access`)
  - `server/middleware/agency-context.ts` (`resolveAgencyContext`)
  - Per-route ownership checks (e.g., `server/routes/workflows.ts`, `server/routes/signals.ts`, `server/routes/rule-engine.ts`)
- **How enforced**: Resource owner checks compare `req.user.agencyId` to object agency; mismatch returns `403`.
- **Falsifiable check**: Use Admin A token against Agency B resource ID and assert `403`.

## INV3 — Workflow Executions Are Idempotent Per Input Hash

- **Statement**: Same workflow + same canonical trigger payload should not produce duplicate executions by default.
- **Enforced by**:
  - `server/workflow/engine.ts` (`computeHash`, `findExecutionByHash`, `execute`)
  - Execution persistence in `workflow_executions` (`shared/schema.ts`)
- **How enforced**: `execute` pre-checks existing execution by `(workflowId,inputHash)` and returns it.
- **Falsifiable check**: Run `POST /api/workflows/:id/execute` twice with identical payload and `skipIdempotencyCheck=false`; assert same execution returned.

## INV4 — AI Output Must Pass Quota + Schema Gate

- **Statement**: AI responses may only be accepted as successful outputs if quota checks pass and output validates against schema.
- **Enforced by**:
  - `server/ai/hardened-executor.ts` (`executeWithSchema`)
  - `server/governance/quota-service.ts` (`checkAIRequestQuota`, `checkAITokenQuota`, `incrementAIUsage`)
  - `shared/schema.ts` (`ai_executions`, `ai_usage_tracking`, `agency_quotas`)
- **How enforced**: Pre-call quota checks; post-call `safeParse`; failures mark execution failed and return error.
- **Falsifiable check**: Force schema mismatch in a workflow AI step and assert failed execution with validation error persisted.

## INV5 — Critical Control/Execution Actions Are Persistently Traceable

- **Statement**: Control-plane and execution-plane critical actions create durable trace records.
- **Enforced by**:
  - Rule audits in `server/routes/rule-engine.ts` + `server/storage.ts` (`createRuleAudit`)
  - Workflow events/execution state in `server/workflow/engine.ts` (`logEvent`, execution status updates)
  - AI execution logs in `server/ai/hardened-executor.ts` (`logExecution`, `updateExecution`)
  - Governance audits in `server/governance/governance-routes.ts` (`logGovernanceAction`)
  - Table definitions in `shared/schema.ts`
- **How enforced**: Explicit writes into audit/event tables on create/update/publish/execute paths.
- **Falsifiable check**: Execute one rule publish and one workflow with AI step; query corresponding audit/event rows.

---

## Known Boundary Gaps (To Address in Rebuild)

- Realtime auth uses legacy JWT verifier (`server/realtime/realtime-routes.ts`, `server/realtime/websocket-server.ts`, `server/lib/jwt.ts`) while core API uses Supabase verification (`server/middleware/supabase-auth.ts`).
- Route composition is split between modular registry and monolithic `server/routes.ts`, increasing risk of bypass or drift in enforcement placement.


---

## INV4 Extension — AI *Inputs* Must Also Be Contracted (Client Record)

INV4 currently gates **AI outputs** (quota + schema). For recommendation safety, we extend the same rigor to **AI inputs**:

- **Statement**: Any data passed into an AI step must come from a **declared schema contract** and must be limited to fields explicitly marked `ai_exposed=true` in the Client Record field catalog.
- **Enforced by**:
  - Request/step input builders that only select `ai_exposed=true` fields.
  - `HardenedAIExecutor.executeWithSchema` with an explicit *input schema* (not just output schema).
- **Falsifiable check**:
  1) Attempt to include a non-exposed Client Record field in an AI step; assert the step fails before provider call.
  2) Attempt to pass a value that violates `data_type/allowed_values/nullable`; assert schema validation fails and is logged.

This prevents “metric chasing” and accidental execution leakage through prompts.