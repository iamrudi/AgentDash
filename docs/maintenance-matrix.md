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
| **API Routes** | `server/routes.ts` | 52 | 🔴 | Core Team | Dec 2024 | **~8000 lines** — decomposition in progress (~40%) |
| **Storage Layer** | `server/storage.ts` | 55 | 🔴 | Core Team | Dec 2024 | **3713 lines** — extract domain services |
| **Auth Router** | `server/routes/auth.ts` | 82 | 🟢 | Core Team | Dec 2024 | 3 routes, clean extraction |
| **User Router** | `server/routes/user.ts` | 80 | 🟢 | Core Team | Dec 2024 | 2 routes, profile management |
| **Client Router** | `server/routes/client.ts` | 78 | 🟡 | Core Team | Dec 2024 | 10 routes, client portal |
| **Agency Router** | `server/routes/agency.ts` | 80 | 🟢 | Core Team | Dec 2024 | 17 routes, cross-tenant protection |
| **Staff Router** | `server/routes/staff.ts` | 80 | 🟢 | Core Team | Dec 2024 | 3 routes, task filtering |
| **CRM Router** | `server/routes/crm.ts` | 75 | 🟡 | Core Team | Dec 2024 | 34 routes, not yet registered |
| **Settings Router** | `server/routes/settings.ts` | 80 | 🟢 | Core Team | Dec 2024 | 2 routes, not yet registered |
| **Router Index** | `server/routes/index.ts` | 85 | 🟢 | Core Team | Dec 2024 | 5 routers mounted |
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
| **SLA Service** | `server/sla/sla-service.ts` | 85 | 🟢 | Core Team | Dec 2024 | ✅ 18 unit tests added |
| **SLA Cron** | `server/sla/sla-cron.ts` | 85 | 🟢 | Core Team | Dec 2024 | 5-minute intervals |
| **Invoice Scheduler** | `server/services/invoiceScheduler.ts` | 80 | 🟢 | Core Team | Dec 2024 | Daily at 9 AM |
| **Trash Cleanup** | `server/services/trashCleanupScheduler.ts` | 85 | 🟢 | Core Team | Dec 2024 | Nightly at 2 AM |
| **Orphan Cleanup** | `server/jobs/orphan-cleanup.ts` | 82 | 🟢 | Core Team | Dec 2024 | User lifecycle |

### Authentication & Middleware

| Module | Path | Score | Flag | Owner | Last Audit | Notes |
|--------|------|-------|------|-------|------------|-------|
| **Auth Middleware** | `server/middleware/auth.ts` | 80 | 🟢 | Security | Dec 2024 | ✅ 18 unit tests added |
| **Maintenance Middleware** | `server/middleware/maintenance.ts` | 82 | 🟢 | Security | Dec 2024 | ✅ 8 unit tests added |
| **Agency Context** | `server/middleware/agency-context.ts` | 80 | 🟢 | Security | Dec 2024 | Clean tenant isolation |
| **Rate Limiter** | `server/middleware/rateLimiter.ts` | 78 | 🟡 | Security | Dec 2024 | Deprecated methods present |
| **Logger** | `server/middleware/logger.ts` | 65 | 🟡 | Core Team | Dec 2024 | Legacy logging to remove |
| **Supabase Auth** | `server/lib/supabase-auth.ts` | 82 | 🟢 | Security | Dec 2024 | JWT validation working |

### Test Infrastructure (NEW - December 2024)

| Module | Path | Score | Flag | Owner | Last Audit | Notes |
|--------|------|-------|------|-------|------------|-------|
| **Test Helpers** | `tests/utils/test-helpers.ts` | 85 | 🟢 | QA | Dec 2024 | Mock utilities, test users |
| **Auth Tests** | `tests/middleware/auth.test.ts` | 85 | 🟢 | QA | Dec 2024 | 18 tests - cross-tenant, roles |
| **Maintenance Tests** | `tests/middleware/maintenance.test.ts` | 85 | 🟢 | QA | Dec 2024 | 8 tests - bypass logic |
| **SLA Tests** | `tests/sla/sla-service.test.ts` | 85 | 🟢 | QA | Dec 2024 | 18 tests - breach detection |
| **Vitest Config** | `vitest.config.ts` | 90 | 🟢 | QA | Dec 2024 | Clean configuration |

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
| **WebSocket Server** | `server/realtime/websocket-server.ts` | 82 | 🟢 | Core Team | Dec 2024 | ✅ Health checks & metrics added |
| **Realtime Service** | `server/realtime/realtime-service.ts` | 80 | 🟢 | Core Team | Dec 2024 | ✅ Integrated WS+SSE health checks |

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
| Continue routes.ts decomposition | `routes.ts` | Extract superadmin, tasks, workflows, intelligence | 8 hours |
| Split storage.ts | `storage.ts` | Major refactor | 12 hours |
| Migration file cleanup | `migrations/` | Remove duplicate/unused SQL | 4 hours |

---

## Routes Decomposition Progress (December 2024)

### Mounted via index.ts (35 routes)
| Router | Routes | Endpoints | Status |
|--------|--------|-----------|--------|
| `auth.ts` | 3 | login, logout, session | ✅ Mounted |
| `user.ts` | 2 | profile get/update | ✅ Mounted |
| `client.ts` | 10 | Client portal endpoints | ✅ Mounted |
| `agency.ts` | 17 | clients, projects, metrics, staff, messages | ✅ Mounted |
| `staff.ts` | 3 | tasks, tasks/full, notifications/counts | ✅ Mounted |

### Extracted but not registered (36 routes)
| Router | Routes | Endpoints | Status |
|--------|--------|-----------|--------|
| `crm.ts` | 34 | companies, contacts, deals, proposals, forms | 🟡 Extracted |
| `settings.ts` | 2 | rate-limit-status, toggle-rate-limit | 🟡 Extracted |

### Pending Extractions
| Router | Estimated Routes | Priority |
|--------|------------------|----------|
| `superadmin.ts` | ~15 | High |
| `tasks.ts` | ~20 | High |
| `workflows.ts` | ~25 | Medium |
| `intelligence.ts` | ~10 | Medium |
| `invoices.ts` | ~8 | Low |
| `projects.ts` | ~10 | Low |

### Router Registration Pattern
```typescript
// server/routes/index.ts
registerDomainRouter('/auth', authRoutes);
registerDomainRouter('/user', userRoutes);
registerDomainRouter('/client', clientRoutes);
registerDomainRouter('/agency', agencyRoutes);
registerDomainRouter('/staff', staffRoutes);
```

---

## Migration Files Review

### Duplicate/Redundant Files
✅ **Completed December 2024:**

| File | Status | Action |
|------|--------|--------|
| `0001_enable_rls_policies.sql` | Original | ✅ Kept |
| `0001_enable_rls_policies_fixed.sql` | Duplicate | ✅ Deleted |
| `0009_add_task_lists_rls.sql` | Original | ✅ Kept |
| `add_task_lists_rls.sql` | Duplicate (no number) | ✅ Deleted |
| `apply_admin_delete_permissions.sql` | Duplicate of 0004 | ✅ Deleted |
| `simple_rls_check.sql` | Utility script | ✅ Moved to scripts/ |
| `all_in_one_rls_check_and_fix.sql` | Utility script | ✅ Moved to scripts/ |
| `verify_rls_complete.sql` | Utility script | ✅ Moved to scripts/ |

---

## Test Coverage Gaps

| Module | Current | Target | Gap | Status |
|--------|---------|--------|-----|--------|
| Auth Middleware | 60% | 80% | +20% | ✅ 18 tests added |
| SLA Service | 65% | 80% | +15% | ✅ 18 tests added |
| Maintenance Middleware | 70% | 80% | +10% | ✅ 8 tests added |
| Workflow Engine | 60% | 80% | +20% | 🟡 Planned Q1 |
| Rule Engine | 55% | 80% | +25% | 🟡 Planned Q1 |
| Signal Router | 40% | 75% | +35% | 🔴 Backlog |
| Intelligence Services | 30% | 70% | +40% | 🔴 Backlog |
| API Routes | 35% | 60% | +25% | 🟡 In progress |
| Storage Methods | 25% | 70% | +45% | 🔴 Backlog |

---

## Next Audit Schedule

| Quarter | Focus Areas |
|---------|-------------|
| Q1 2025 | Routes.ts split completion, storage refactor planning |
| Q2 2025 | Workflow engine tests, intelligence layer test coverage |
| Q3 2025 | Agent system evaluation, advanced workflow testing |
| Q4 2025 | Full platform security audit, E2E test expansion |

---

## Q2/Q3 2025 Refactor Priorities

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P1 | Complete routes.ts decomposition (remaining ~55%) | 8 hours | High |
| P1 | Register crm.ts and settings.ts routers | 2 hours | Medium |
| P2 | Storage layer split into domain services | 12 hours | High |
| P2 | Workflow engine integration tests | 6 hours | Medium |
| P3 | Agent system evaluation and cleanup | 4 hours | Low |
| P3 | Legacy logging migration to Winston | 3 hours | Low |

---

*Generated: December 2024*
*Next Review: March 2025*
