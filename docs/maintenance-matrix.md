# Agency Client Portal — Maintenance Matrix

## Last Audit: December 2024

---

## Maintenance Scoring System

### Formula
```
MaintenanceScore = 100 - (5×Complexity + 10×TechDebt + 15×Incidents + 5×TestGap)

Where:
- Complexity (0-5): Cyclomatic complexity, coupling, file size
- TechDebt (0-5): TODO comments, deprecated code, workarounds
- Incidents (0-5): Bug reports, production issues in last 90 days
- TestGap (0-5): Missing test coverage percentage / 20
```

### Flag System
| Score | Flag | Action Required |
|-------|------|-----------------|
| ≥80 | 🟢 Green | Healthy — routine maintenance only |
| 60-79 | 🟡 Yellow | Attention needed — schedule cleanup |
| <60 | 🔴 Red | Critical — prioritize immediately |

---

## Module Inventory

### Backend Services

| Module | Path | Score | Flag | Owner | Last Audit | Notes |
|--------|------|-------|------|-------|------------|-------|
| **Workflow Engine** | `server/workflow/engine.ts` | 82 | 🟢 | Core Team | Dec 2024 | Well-tested, atomic transactions |
| **Rule Engine** | `server/workflow/rule-engine.ts` | 78 | 🟡 | Core Team | Dec 2024 | 16 operators, needs more edge case tests |
| **Signal Router** | `server/workflow/signal-router.ts` | 75 | 🟡 | Core Team | Dec 2024 | Coverage gaps in route matching |
| **Signal Adapters** | `server/workflow/signal-adapters.ts` | 80 | 🟢 | Core Team | Dec 2024 | Clean adapter pattern |
| **API Routes** | `server/routes.ts` | 48 | 🔴 | Core Team | Dec 2024 | **9638 lines** — monolithic, needs splitting |
| **Storage Layer** | `server/storage.ts` | 55 | 🔴 | Core Team | Dec 2024 | **3713 lines** — extract domain services |
| **Schema** | `shared/schema.ts` | 68 | 🟡 | Core Team | Dec 2024 | **3235 lines** — well-organized but large |

### Intelligence Layer

| Module | Path | Score | Flag | Owner | Last Audit | Notes |
|--------|------|-------|------|-------|------------|-------|
| **Duration Model** | `server/intelligence/duration-model-service.ts` | 85 | 🟢 | AI Team | Dec 2024 | Clean layered prediction |
| **Resource Optimizer** | `server/intelligence/resource-optimizer-service.ts` | 82 | 🟢 | AI Team | Dec 2024 | Greedy allocation working well |
| **Commercial Impact** | `server/intelligence/commercial-impact-service.ts` | 80 | 🟢 | AI Team | Dec 2024 | Configurable scoring |
| **Outcome Feedback** | `server/intelligence/outcome-feedback-service.ts` | 85 | 🟢 | AI Team | Dec 2024 | Fire-and-forget pattern |
| **Knowledge Ingestion** | `server/intelligence/knowledge-ingestion-service.ts` | 83 | 🟢 | AI Team | Dec 2024 | Versioning, validation |
| **Knowledge Retrieval** | `server/intelligence/knowledge-retrieval-service.ts` | 80 | 🟢 | AI Team | Dec 2024 | Freshness-weighted retrieval |
| **Signal Emitter** | `server/intelligence/signal-emitter.ts` | 78 | 🟡 | AI Team | Dec 2024 | Needs integration tests |
| **Priority Engine** | `server/intelligence/priority-engine.ts` | 75 | 🟡 | AI Team | Dec 2024 | Complex scoring logic |

### AI Providers

| Module | Path | Score | Flag | Owner | Last Audit | Notes |
|--------|------|-------|------|-------|------------|-------|
| **Hardened Executor** | `server/ai/hardened-executor.ts` | 85 | 🟢 | AI Team | Dec 2024 | Retry, caching, validation |
| **Gemini Provider** | `server/ai/gemini-provider.ts` | 80 | 🟢 | AI Team | Dec 2024 | Well-structured |
| **OpenAI Provider** | `server/ai/openai-provider.ts` | 80 | 🟢 | AI Team | Dec 2024 | Parallel to Gemini |
| **Provider Interface** | `server/ai/provider.ts` | 90 | 🟢 | AI Team | Dec 2024 | Clean abstraction |

### Agent System

| Module | Path | Score | Flag | Owner | Last Audit | Notes |
|--------|------|-------|------|-------|------------|-------|
| **Base Agent** | `server/agents/base-agent.ts` | 75 | 🟡 | AI Team | Dec 2024 | Abstract class, needs cleanup |
| **Domain Agents** | `server/agents/domain-agents.ts` | 70 | 🟡 | AI Team | Dec 2024 | Not actively used in routes |
| **Orchestrator** | `server/agents/orchestrator.ts` | 65 | 🟡 | AI Team | Dec 2024 | Limited usage, evaluate removal |
| **Agent Routes** | `server/agents/agent-routes.ts` | 68 | 🟡 | AI Team | Dec 2024 | Low traffic endpoints |

### SLA & Scheduling

| Module | Path | Score | Flag | Owner | Last Audit | Notes |
|--------|------|-------|------|-------|------------|-------|
| **SLA Service** | `server/sla/sla-service.ts` | 82 | 🟢 | Core Team | Dec 2024 | Breach detection working |
| **SLA Cron** | `server/sla/sla-cron.ts` | 85 | 🟢 | Core Team | Dec 2024 | 5-minute intervals |
| **Invoice Scheduler** | `server/services/invoiceScheduler.ts` | 80 | 🟢 | Core Team | Dec 2024 | Daily at 9 AM |
| **Trash Cleanup** | `server/services/trashCleanupScheduler.ts` | 85 | 🟢 | Core Team | Dec 2024 | Nightly at 2 AM |
| **Orphan Cleanup** | `server/jobs/orphan-cleanup.ts` | 82 | 🟢 | Core Team | Dec 2024 | User lifecycle |

### Authentication & Middleware

| Module | Path | Score | Flag | Owner | Last Audit | Notes |
|--------|------|-------|------|-------|------------|-------|
| **Auth Middleware** | `server/middleware/auth.ts` | 72 | 🟡 | Security | Dec 2024 | Redundant verify functions |
| **Agency Context** | `server/middleware/agency-context.ts` | 80 | 🟢 | Security | Dec 2024 | Clean tenant isolation |
| **Rate Limiter** | `server/middleware/rateLimiter.ts` | 78 | 🟡 | Security | Dec 2024 | Deprecated methods present |
| **Logger** | `server/middleware/logger.ts` | 65 | 🟡 | Core Team | Dec 2024 | Legacy logging to remove |
| **Supabase Auth** | `server/lib/supabase-auth.ts` | 82 | 🟢 | Security | Dec 2024 | JWT validation working |

### Integration Libraries

| Module | Path | Score | Flag | Owner | Last Audit | Notes |
|--------|------|-------|------|-------|------------|-------|
| **Google OAuth** | `server/lib/googleOAuth.ts` | 78 | 🟡 | Integrations | Dec 2024 | Token refresh edge cases |
| **Google API Retry** | `server/lib/googleApiRetry.ts` | 80 | 🟢 | Integrations | Dec 2024 | Exponential backoff |
| **Google API Rate Limiter** | `server/lib/googleApiRateLimiter.ts` | 70 | 🟡 | Integrations | Dec 2024 | Deprecated methods |
| **HubSpot** | `server/lib/hubspot.ts` | 75 | 🟡 | Integrations | Dec 2024 | Needs error handling review |
| **LinkedIn** | `server/lib/linkedin.ts` | 72 | 🟡 | Integrations | Dec 2024 | Limited functionality |

### CRM

| Module | Path | Score | Flag | Owner | Last Audit | Notes |
|--------|------|-------|------|-------|------------|-------|
| **CRM Routes** | `server/crm/crm-routes.ts` | 78 | 🟡 | CRM Team | Dec 2024 | Webhook handling |
| **CRM Webhook Handler** | `server/crm/crm-webhook-handler.ts` | 80 | 🟢 | CRM Team | Dec 2024 | HubSpot signature verification |
| **Routes CRM** | `server/routes/crm.ts` | 72 | 🟡 | CRM Team | Dec 2024 | Duplicated with crm-routes |

### Vector & Embeddings

| Module | Path | Score | Flag | Owner | Last Audit | Notes |
|--------|------|-------|------|-------|------------|-------|
| **Embedding Service** | `server/vector/embedding-service.ts` | 80 | 🟢 | AI Team | Dec 2024 | Dual provider support |

### Real-time

| Module | Path | Score | Flag | Owner | Last Audit | Notes |
|--------|------|-------|------|-------|------------|-------|
| **WebSocket Server** | `server/realtime/websocket-server.ts` | 75 | 🟡 | Core Team | Dec 2024 | URL config bug in Vite HMR |
| **Realtime Service** | `server/realtime/realtime-service.ts` | 78 | 🟡 | Core Team | Dec 2024 | Message broadcasting |

---

## Frontend Modules

| Module | Path | Score | Flag | Owner | Last Audit | Notes |
|--------|------|-------|------|-------|------------|-------|
| **App Router** | `client/src/App.tsx` | 75 | 🟡 | Frontend | Dec 2024 | Large routing file |
| **Query Client** | `client/src/lib/queryClient.ts` | 85 | 🟢 | Frontend | Dec 2024 | Token refresh, hierarchical keys |
| **Agency Layout** | `client/src/components/agency-layout.tsx` | 80 | 🟢 | Frontend | Dec 2024 | Clean layout |
| **Client Layout** | `client/src/components/client-layout.tsx` | 80 | 🟢 | Frontend | Dec 2024 | Clean layout |
| **Agency Sidebar** | `client/src/components/agency-sidebar.tsx` | 78 | 🟡 | Frontend | Dec 2024 | Many menu items |
| **Knowledge Page** | `client/src/pages/agency/knowledge.tsx` | 82 | 🟢 | Frontend | Dec 2024 | Full CRUD, filtering |

---

## Critical Items (🔴 Red Flag)

### 1. `server/routes.ts` — 9638 lines
**Problem:** Monolithic API file containing all route handlers
**Impact:** Hard to maintain, slow to navigate, merge conflicts
**Recommendation:** Split into domain-specific route files:
```
server/routes/
├── agency.ts      (~2000 lines)
├── client.ts      (~800 lines)
├── staff.ts       (~400 lines)
├── superadmin.ts  (~600 lines)
├── auth.ts        (~500 lines)
├── tasks.ts       (~1200 lines)
├── projects.ts    (~800 lines)
├── invoices.ts    (~600 lines)
├── workflows.ts   (~1000 lines)
├── intelligence.ts (~800 lines)
└── index.ts       (router composition)
```

### 2. `server/storage.ts` — 3713 lines
**Problem:** Single storage class with all database operations
**Impact:** God object anti-pattern, testing difficulty
**Recommendation:** Extract domain services:
```
server/storage/
├── base-storage.ts        (IStorage interface)
├── agency-storage.ts      (agency operations)
├── client-storage.ts      (client operations)
├── project-storage.ts     (project/task operations)
├── invoice-storage.ts     (billing operations)
├── workflow-storage.ts    (workflow operations)
├── intelligence-storage.ts (feedback, knowledge)
└── index.ts               (composition)
```

---

## Cleanup Queue

### High Priority (Do First)
| Item | File | Action | Effort |
|------|------|--------|--------|
| Deprecated rate limit methods | `googleApiRateLimiter.ts` | Remove `checkRateLimit`, `recordRequest` | 1 hour |
| Legacy logging | `logger.ts` | Remove after confirming Winston adoption | 2 hours |
| Redundant CRM routes | `routes/crm.ts` vs `crm/crm-routes.ts` | Consolidate into one | 4 hours |
| Deprecated auth helpers | `auth.ts` | Consolidate `verifyClientAccess` patterns | 2 hours |

### Medium Priority
| Item | File | Action | Effort |
|------|------|--------|--------|
| Console.log statements | Various | Replace with logger.info/debug | 3 hours |
| Hardcoded dev fallbacks | `oauthState.ts` | Remove fallback secrets | 1 hour |
| Agent system evaluation | `server/agents/` | Determine if actively used | 2 hours |

### Low Priority (Schedule Later)
| Item | File | Action | Effort |
|------|------|--------|--------|
| Split routes.ts | `routes.ts` | Major refactor | 16 hours |
| Split storage.ts | `storage.ts` | Major refactor | 12 hours |
| Migration file cleanup | `migrations/` | Remove duplicate/unused SQL | 4 hours |

---

## Migration Files Review

### Duplicate/Redundant Files
| File | Status | Action |
|------|--------|--------|
| `0001_enable_rls_policies.sql` | Original | Keep |
| `0001_enable_rls_policies_fixed.sql` | Duplicate | Remove |
| `0009_add_task_lists_rls.sql` | Original | Keep |
| `add_task_lists_rls.sql` | Duplicate (no number) | Remove |
| `apply_admin_delete_permissions.sql` | Duplicate of 0004 | Remove |
| `simple_rls_check.sql` | Utility script | Move to scripts/ |
| `all_in_one_rls_check_and_fix.sql` | Utility script | Move to scripts/ |
| `verify_rls_complete.sql` | Utility script | Move to scripts/ |

---

## Test Coverage Gaps

| Module | Current | Target | Gap |
|--------|---------|--------|-----|
| Workflow Engine | 60% | 80% | +20% |
| Rule Engine | 55% | 80% | +25% |
| Signal Router | 40% | 75% | +35% |
| Intelligence Services | 30% | 70% | +40% |
| API Routes | 20% | 60% | +40% |
| Storage Methods | 25% | 70% | +45% |

---

## Next Audit Schedule

| Quarter | Focus Areas |
|---------|-------------|
| Q1 2025 | Routes.ts split, storage refactor planning |
| Q2 2025 | Intelligence layer test coverage |
| Q3 2025 | Agent system evaluation and cleanup |
| Q4 2025 | Full platform security audit |

---

*Generated: December 2024*
*Next Review: March 2025*
