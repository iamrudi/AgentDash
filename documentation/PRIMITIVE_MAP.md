# Primitive Map (Phase 1 Increment)

## Scope

This document maps the Phase 1 increment changes to core primitives. It is intentionally narrow and only covers the atomic migration in this increment.

## Mapping

- **P1/P2 — Identity + Capability Gating**
  - `server/middleware/request-context.ts` provides a normalized request context derived from authenticated principals.
  - `server/middleware/supabase-auth.ts` attaches `req.ctx` for downstream use.
- **P6 — AI Guarded Executor**
  - `server/gemini.ts` now routes through `server/ai/hardened-executor.ts` for schema-validated output and quota enforcement.
  - `server/routes/messages.ts` now routes through `server/ai/hardened-executor.ts` for client conversation analysis.
  - `server/routes/crm.ts` now routes proposal generation through `server/ai/hardened-executor.ts`.
  - `server/agents/ai-provider-adapter.ts` now routes text generation through `server/ai/hardened-executor.ts`.
  - `server/vector/embedding-service.ts` now routes embedding generation through `server/ai/hardened-executor.ts`.
  - `server/application/opportunities/opportunity-service.ts` generates Opportunity Artifacts via hardened executor with output schema.
- **P7 — Audit/Event Ledger**
  - `server/application/opportunities/opportunity-service.ts` emits audit logs for Opportunity Artifact creation when available.
  - `server/application/gates/gate-decision-service.ts` emits audit logs for gate decisions when available.
  - `server/application/initiatives/initiative-intent-service.ts` emits audit logs for initiative intents when available.
  - `server/application/sku/sku-composition-service.ts` emits audit logs for SKU composition create/freeze when available.
  - Focused tests verify hardened executor usage for legacy Gemini analysis paths.

- **Control-Plane Artifacts**
  - Gate Decisions are persisted via `server/application/gates/gate-decision-service.ts` and exposed through `server/routes/opportunities.ts`.

## Notes

- No control-plane logic was moved into the Client Record.
- No new execution paths or scope changes were introduced.
