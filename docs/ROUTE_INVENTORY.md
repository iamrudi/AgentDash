# Route Inventory Snapshot

Date: 2026-02-10

Purpose: Inventory of modular routers mounted under `/api` and any remaining legacy routing surface.

## Modular Routers (Mounted via `server/routes/index.ts`)

| Subpath | Router File |
| --- | --- |
| `/auth` | `server/routes/auth.ts` |
| `/user` | `server/routes/user.ts` |
| `/client` | `server/routes/client.ts` |
| `/agency` | `server/routes/agency.ts` |
| `/staff` | `server/routes/staff.ts` |
| `/crm` | `server/routes/crm.ts` |
| `/settings` | `server/routes/settings.ts` |
| `/superadmin` | `server/routes/superadmin.ts` |
| `/invoices` | `server/routes/invoices.ts` |
| `/tasks` | `server/routes/tasks.ts` |
| `/intelligence` | `server/routes/intelligence.ts` |
| `/intelligence` | `server/routes/intelligence-extended.ts` |
| `/knowledge` | `server/routes/knowledge.ts` |
| `/workflows` | `server/routes/workflows.ts` |
| `/workflow-executions` | `server/routes/workflow-executions.ts` |
| `/lineage` | `server/routes/lineage.ts` |
| `/public` | `server/routes/public.ts` |
| `/` | `server/routes/rule-engine.ts` |
| `/` | `server/routes/signals.ts` |
| `/` | `server/routes/ai-execution.ts` |
| `/retention-policies` | `server/routes/retention-policies.ts` |
| `/notifications` | `server/routes/notifications.ts` |
| `/knowledge-documents` | `server/routes/knowledge-documents.ts` |
| `/initiatives` | `server/routes/initiatives.ts` |
| `/oauth` | `server/routes/oauth.ts` |
| `/integrations` | `server/routes/integrations.ts` |
| `/agency/settings` | `server/routes/agency-settings.ts` |
| `/agency` | `server/routes/agency-tasks.ts` |
| `/agency` | `server/routes/agency-users.ts` |
| `/analytics` | `server/routes/analytics.ts` |
| `/agency/messages` | `server/routes/messages.ts` |
| `/agency` | `server/routes/objectives.ts` |
| `/ai` | `server/routes/ai-chat.ts` |
| `/proposals` | `server/routes/proposals.ts` |
| `/agency/clients` | `server/routes/agency-clients.ts` |
| `/clients` | `server/routes/agency-clients.ts` |
| `/` | `server/routes/metrics.ts` |
| `/sla` | `server/sla/sla-routes.ts` |
| `/agents` | `server/agents/agent-routes.ts` |
| `/tasks/workflow` | `server/tasks/task-routes.ts` |
| `/templates` | `server/templates/template-routes.ts` |
| `/governance` | `server/governance/governance-routes.ts` |
| `/superadmin` | `server/routes/superadmin-health.ts` |
| `/test` | `server/routes/test.ts` |
| `/` | `server/routes/opportunities.ts` |
| `/` | `server/routes/initiative-intents.ts` |
| `/` | `server/routes/sku-compositions.ts` |
| `/` | `server/routes/execution-outputs.ts` |
| `/` | `server/routes/outcome-reviews.ts` |
| `/` | `server/routes/learning-artifacts.ts` |

## Legacy / Monolith Surface

- `server/routes.ts` is a shim that only sets policy boundaries and mounts modular routers. It also serves static invoice PDFs from `public/invoices`.
- `server/routes.ts.backup` contains a legacy monolith but is not mounted.

