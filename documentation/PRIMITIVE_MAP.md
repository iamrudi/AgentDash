# Primitive Map (Phase 1 Increment)

## Scope

This document maps the Phase 1 increment changes to core primitives. It is intentionally narrow and only covers the atomic migration in this increment.

## Mapping

- **P6 — AI Guarded Executor**
  - `server/gemini.ts` now routes through `server/ai/hardened-executor.ts` for schema-validated output and quota enforcement.
  - `server/routes/messages.ts` now routes through `server/ai/hardened-executor.ts` for client conversation analysis.
  - `server/routes/crm.ts` now routes proposal generation through `server/ai/hardened-executor.ts`.
  - `server/agents/ai-provider-adapter.ts` now routes text generation through `server/ai/hardened-executor.ts`.
  - `server/vector/embedding-service.ts` now routes embedding generation through `server/ai/hardened-executor.ts`.
  - Focused tests verify hardened executor usage for legacy Gemini analysis paths.

## Notes

- No control-plane logic was moved into the Client Record.
- No new execution paths or scope changes were introduced.
