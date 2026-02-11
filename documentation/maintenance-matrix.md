# Agency Client Portal — Maintenance Matrix

## Last Audit: December 2025

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
| **Workflow Engine** | `server/workflow/engine.ts` | 82 | 🟢 | Core Team | Dec 2025 | Well-tested, atomic transactions |
| **Rule Engine** | `server/workflow/rule-engine.ts` | 78 | 🟡 | Core Team | Dec 2025 | 16 operators, needs more edge case tests |
| **Signal Router** | `server/workflow/signal-router.ts` | 75 | 🟡 | Core Team | Dec 2025 | Coverage gaps in route matching |
| **Signal Adapters** | `server/workflow/signal-adapters.ts` | 80 | 🟢 | Core Team | Dec 2025 | Clean adapter pattern |
| **API Routes** | `server/routes.ts` | 88 | 🟢 | Core Team | Dec 2025 | **300 lines** — decomposition ✅ complete, 3 routes remaining |
| **Storage Layer** | `server/storage.ts` | 65 | 🟡 | Core Team | Dec 2025 | **3,245 lines** — decomposition in progress (Phase 1-2 complete) |
| **Storage Contracts** | `server/storage/contracts/` | 85 | 🟢 | Core Team | Dec 2025 | Domain interfaces: identity, agency, task |
| **Storage Domains** | `server/storage/domains/` | 85 | 🟢 | Core Team | Dec 2025 | Domain implementations: 43 methods extracted |
| **Router Index** | `server/routes/index.ts` | 90 | 🟢 | Core Team | Dec 2025 | 37 registrations (~325 routes) |
| **Auth Router** | `server/routes/auth.ts` | 82 | 🟢 | Core Team | Dec 2025 | 3 routes, clean extraction |
| **User Router** | `server/routes/user.ts` | 80 | 🟢 | Core Team | Dec 2025 | 2 routes, profile management |
| **Client Router** | `server/routes/client.ts` | 78 | 🟡 | Core Team | Dec 2025 | 10 routes, client portal |
| **Agency Router** | `server/routes/agency.ts` | 80 | 🟢 | Core Team | Dec 2025 | 17 routes, cross-tenant protection |
| **Agency Clients Router** | `server/routes/agency-clients.ts` | 82 | 🟢 | Core Team | Dec 2025 | 7 routes, client management |
| **Agency Settings Router** | `server/routes/agency-settings.ts` | 82 | 🟢 | Core Team | Dec 2025 | 5 routes, configuration |
| **Agency Tasks Router** | `server/routes/agency-tasks.ts` | 80 | 🟢 | Core Team | Dec 2025 | 13 routes, task management |
| **Agency Users Router** | `server/routes/agency-users.ts` | 80 | 🟢 | Core Team | Dec 2025 | 5 routes, user management |
| **Staff Router** | `server/routes/staff.ts` | 80 | 🟢 | Core Team | Dec 2025 | 3 routes, task filtering |
| **Settings Router** | `server/routes/settings.ts` | 82 | 🟢 | Core Team | Dec 2025 | 2 routes, mounted |
| **SuperAdmin Router** | `server/routes/superadmin.ts` | 82 | 🟢 | Core Team | Dec 2025 | 24 routes, governance |
| **SuperAdmin Health Router** | `server/routes/superadmin-health.ts` | 82 | 🟢 | Core Team | Dec 2025 | 3 routes, health checks |
| **Invoices Router** | `server/routes/invoices.ts` | 80 | 🟢 | Core Team | Dec 2025 | 6 routes, PDF generation |
| **Tasks Router** | `server/routes/tasks.ts` | 80 | 🟢 | Core Team | Dec 2025 | 9 routes, CRUD + subtasks |
| **Intelligence Router** | `server/routes/intelligence.ts` | 82 | 🟢 | Core Team | Dec 2025 | 21 routes, duration/optimization |
| **Intelligence Extended Router** | `server/routes/intelligence-extended.ts` | 82 | 🟢 | Core Team | Dec 2025 | 27 routes, predictions/feedback |
| **Knowledge Router** | `server/routes/knowledge.ts` | 82 | 🟢 | Core Team | Dec 2025 | 12 routes, ingestion/retrieval |
| **Knowledge Documents Router** | `server/routes/knowledge-documents.ts` | 82 | 🟢 | Core Team | Dec 2025 | 12 routes, document management |
| **Workflows Router** | `server/routes/workflows.ts` | 80 | 🟢 | Core Team | Dec 2025 | 9 routes, CRUD/execution |
| **Workflow Executions Router** | `server/routes/workflow-executions.ts` | 80 | 🟢 | Core Team | Dec 2025 | 2 routes, events/lineage |
| **Lineage Router** | `server/routes/lineage.ts` | 80 | 🟢 | Core Team | Dec 2025 | 2 routes, tracing |
| **Rule Engine Router** | `server/routes/rule-engine.ts` | 80 | 🟢 | Core Team | Dec 2025 | 12 routes, workflow rules |
| **Signals Router** | `server/routes/signals.ts` | 80 | 🟢 | Core Team | Dec 2025 | 11 routes, signal ingestion |
| **AI Execution Router** | `server/routes/ai-execution.ts` | 82 | 🟢 | Core Team | Dec 2025 | 5 routes, AI execution |
| **AI Chat Router** | `server/routes/ai-chat.ts` | 82 | 🟢 | Core Team | Dec 2025 | 2 routes, chat endpoints |
| **Integrations Router** | `server/routes/integrations.ts` | 80 | 🟢 | Core Team | Dec 2025 | 19 routes, integration management |
| **OAuth Router** | `server/routes/oauth.ts` | 82 | 🟢 | Core Team | Dec 2025 | 2 routes, OAuth flows |
| **Analytics Router** | `server/routes/analytics.ts` | 80 | 🟢 | Core Team | Dec 2025 | 6 routes, analytics data |
| **Initiatives Router** | `server/routes/initiatives.ts` | 80 | 🟢 | Core Team | Dec 2025 | 9 routes, initiative management |
| **Notifications Router** | `server/routes/notifications.ts` | 80 | 🟢 | Core Team | Dec 2025 | 5 routes, notifications |
| **Messages Router** | `server/routes/messages.ts` | 80 | 🟢 | Core Team | Dec 2025 | 7 routes, messaging |
| **Objectives Router** | `server/routes/objectives.ts` | 80 | 🟢 | Core Team | Dec 2025 | 4 routes, objectives |
| **Proposals Router** | `server/routes/proposals.ts` | 80 | 🟢 | Core Team | Dec 2025 | 2 routes, proposals |
| **Retention Policies Router** | `server/routes/retention-policies.ts` | 80 | 🟢 | Core Team | Dec 2025 | 4 routes, retention |
| **Public Router** | `server/routes/public.ts` | 80 | 🟢 | Core Team | Dec 2025 | 2 routes, public endpoints |
| **Schema** | `shared/schema.ts` | 68 | 🟡 | Core Team | Dec 2025 | **3235 lines** — well-organized but large |

### Intelligence Layer

| Module | Path | Score | Flag | Owner | Last Audit | Notes |
|--------|------|-------|------|-------|------------|-------|
| **Duration Model** | `server/intelligence/duration-model-service.ts` | 85 | 🟢 | AI Team | Dec 2025 | Clean layered prediction |
| **Resource Optimizer** | `server/intelligence/resource-optimizer-service.ts` | 82 | 🟢 | AI Team | Dec 2025 | Greedy allocation working well |
| **Commercial Impact** | `server/intelligence/commercial-impact-service.ts` | 80 | 🟢 | AI Team | Dec 2025 | Configurable scoring |
| **Outcome Feedback** | `server/intelligence/outcome-feedback-service.ts` | 85 | 🟢 | AI Team | Dec 2025 | Fire-and-forget pattern |
| **Knowledge Ingestion** | `server/intelligence/knowledge-ingestion-service.ts` | 83 | 🟢 | AI Team | Dec 2025 | Versioning, validation |
| **Knowledge Retrieval** | `server/intelligence/knowledge-retrieval-service.ts` | 80 | 🟢 | AI Team | Dec 2025 | Freshness-weighted retrieval |
| **Signal Emitter** | `server/intelligence/signal-emitter.ts` | 78 | 🟡 | AI Team | Dec 2025 | Needs integration tests |
| **Priority Engine** | `server/intelligence/priority-engine.ts` | 75 | 🟡 | AI Team | Dec 2025 | Complex scoring logic |

### AI Providers

| Module | Path | Score | Flag | Owner | Last Audit | Notes |
|--------|------|-------|------|-------|------------|-------|
| **Hardened Executor** | `server/ai/hardened-executor.ts` | 85 | 🟢 | AI Team | Dec 2025 | Retry, caching, validation |
| **Gemini Provider** | `server/ai/gemini-provider.ts` | 80 | 🟢 | AI Team | Dec 2025 | Well-structured |
| **OpenAI Provider** | `server/ai/openai-provider.ts` | 80 | 🟢 | AI Team | Dec 2025 | Parallel to Gemini |
| **Provider Interface** | `server/ai/provider.ts` | 90 | 🟢 | AI Team | Dec 2025 | Clean abstraction |

### Agent System

| Module | Path | Score | Flag | Owner | Last Audit | Notes |
|--------|------|-------|------|-------|------------|-------|
| **Base Agent** | `server/agents/base-agent.ts` | 75 | 🟡 | AI Team | Dec 2025 | Abstract class, needs cleanup |
| **Domain Agents** | `server/agents/domain-agents.ts` | 70 | 🟡 | AI Team | Dec 2025 | Not actively used in routes |
| **Orchestrator** | `server/agents/orchestrator.ts` | 65 | 🟡 | AI Team | Dec 2025 | Limited usage, evaluate removal |
| **Agent Routes** | `server/agents/agent-routes.ts` | 68 | 🟡 | AI Team | Dec 2025 | Low traffic endpoints |

### SLA & Scheduling

| Module | Path | Score | Flag | Owner | Last Audit | Notes |
|--------|------|-------|------|-------|------------|-------|
| **SLA Service** | `server/sla/sla-service.ts` | 85 | 🟢 | Core Team | Dec 2025 | ✅ 18 unit tests added |
| **SLA Cron** | `server/sla/sla-cron.ts` | 85 | 🟢 | Core Team | Dec 2025 | 5-minute intervals |
| **Invoice Scheduler** | `server/services/invoiceScheduler.ts` | 80 | 🟢 | Core Team | Dec 2025 | Daily at 9 AM |
| **Trash Cleanup** | `server/services/trashCleanupScheduler.ts` | 85 | 🟢 | Core Team | Dec 2025 | Nightly at 2 AM |
| **Orphan Cleanup** | `server/jobs/orphan-cleanup.ts` | 82 | 🟢 | Core Team | Dec 2025 | User lifecycle |

### Authentication & Middleware

| Module | Path | Score | Flag | Owner | Last Audit | Notes |
|--------|------|-------|------|-------|------------|-------|
| **Auth Middleware** | `server/middleware/auth.ts` | 80 | 🟢 | Security | Dec 2025 | ✅ 18 unit tests added |
| **Maintenance Middleware** | `server/middleware/maintenance.ts` | 82 | 🟢 | Security | Dec 2025 | ✅ 8 unit tests added |
| **Agency Context** | `server/middleware/agency-context.ts` | 80 | 🟢 | Security | Dec 2025 | Clean tenant isolation |
| **Rate Limiter** | `server/middleware/rateLimiter.ts` | 78 | 🟡 | Security | Dec 2025 | Deprecated methods present |
| **Logger** | `server/middleware/logger.ts` | 65 | 🟡 | Core Team | Dec 2025 | Legacy logging to remove |
| **Supabase Auth** | `server/lib/supabase-auth.ts` | 82 | 🟢 | Security | Dec 2025 | JWT validation working |

### Test Infrastructure (NEW - December 2025)

| Module | Path | Score | Flag | Owner | Last Audit | Notes |
|--------|------|-------|------|-------|------------|-------|
| **Test Helpers** | `tests/utils/test-helpers.ts` | 85 | 🟢 | QA | Dec 2025 | Mock utilities, test users |
| **Auth Tests** | `tests/middleware/auth.test.ts` | 85 | 🟢 | QA | Dec 2025 | 18 tests - cross-tenant, roles |
| **Maintenance Tests** | `tests/middleware/maintenance.test.ts` | 85 | 🟢 | QA | Dec 2025 | 8 tests - bypass logic |
| **SLA Tests** | `tests/sla/sla-service.test.ts` | 85 | 🟢 | QA | Dec 2025 | 18 tests - breach detection |
| **Vitest Config** | `vitest.config.ts` | 90 | 🟢 | QA | Dec 2025 | Clean configuration |

### Integration Libraries

| Module | Path | Score | Flag | Owner | Last Audit | Notes |
|--------|------|-------|------|-------|------------|-------|
| **Google OAuth** | `server/lib/googleOAuth.ts` | 78 | 🟡 | Integrations | Dec 2025 | Token refresh edge cases |
| **Google API Retry** | `server/lib/googleApiRetry.ts` | 80 | 🟢 | Integrations | Dec 2025 | Exponential backoff |
| **Google API Rate Limiter** | `server/lib/googleApiRateLimiter.ts` | 70 | 🟡 | Integrations | Dec 2025 | Deprecated methods |
| **HubSpot** | `server/lib/hubspot.ts` | 75 | 🟡 | Integrations | Dec 2025 | Needs error handling review |
| **LinkedIn** | `server/lib/linkedin.ts` | 72 | 🟡 | Integrations | Dec 2025 | Limited functionality |

### Vector & Embeddings

| Module | Path | Score | Flag | Owner | Last Audit | Notes |
|--------|------|-------|------|-------|------------|-------|
| **Embedding Service** | `server/vector/embedding-service.ts` | 80 | 🟢 | AI Team | Dec 2025 | Dual provider support |

### Real-time

| Module | Path | Score | Flag | Owner | Last Audit | Notes |
|--------|------|-------|------|-------|------------|-------|
| **WebSocket Server** | `server/realtime/websocket-server.ts` | 82 | 🟢 | Core Team | Dec 2025 | ✅ Health checks & metrics added |
| **Realtime Service** | `server/realtime/realtime-service.ts` | 80 | 🟢 | Core Team | Dec 2025 | ✅ Integrated WS+SSE health checks |

---

## Frontend Modules

| Module | Path | Score | Flag | Owner | Last Audit | Notes |
|--------|------|-------|------|-------|------------|-------|
| **App Router** | `client/src/App.tsx` | 75 | 🟡 | Frontend | Dec 2025 | Large routing file |
| **Query Client** | `client/src/lib/queryClient.ts` | 85 | 🟢 | Frontend | Dec 2025 | Token refresh, hierarchical keys |
| **Agency Layout** | `client/src/components/agency-layout.tsx` | 80 | 🟢 | Frontend | Dec 2025 | Clean layout |
| **Client Layout** | `client/src/components/client-layout.tsx` | 80 | 🟢 | Frontend | Dec 2025 | Clean layout |
| **Agency Sidebar** | `client/src/components/agency-sidebar.tsx` | 78 | 🟡 | Frontend | Dec 2025 | Many menu items |
| **Knowledge Page** | `client/src/pages/agency/knowledge.tsx` | 82 | 🟢 | Frontend | Dec 2025 | Full CRUD, filtering |

---

## Critical Items (🔴 Red Flag)

### 1. `server/routes.ts` — ✅ RESOLVED (December 2025)
**Previous Problem:** Monolithic API file containing all route handlers (9638 lines)
**Resolution:** Successfully decomposed into 37 domain-specific routers (~325 routes)
**Current State:** Only 300 lines with 3 intentional remaining routes
**Impact:** 94% reduction in file size, improved maintainability

### 2. `server/storage.ts` — 🟡 IN PROGRESS (3,245 lines, Phase 1-2 complete)
**Original Problem:** Single storage class with all database operations (3,713 lines)
**Current Status:** Decomposition in progress — 43 methods extracted (12.6% reduction)
**Architecture Pattern:**
```
server/storage/
├── contracts/                 # Domain interfaces
│   ├── identity.ts           # IdentityStorage (12 methods) ✅
│   ├── agency.ts             # AgencyStorage (4 methods) ✅
│   └── task.ts               # TaskStorage (27 methods) ✅
└── domains/                   # Function-based implementations
    ├── identity.storage.ts   # Users, profiles, sessions ✅
    ├── agency.storage.ts     # Agency CRUD ✅
    └── task.storage.ts       # Tasks, lists, assignments ✅
```
**Remaining Phases:** Project/Client (~20 methods), Invoice/Initiative (~25 methods)

---

## Cleanup Queue

### High Priority (Do First)
| Item | File | Action | Tokens |
|------|------|--------|--------|
| Deprecated rate limit methods | `googleApiRateLimiter.ts` | Remove `checkRateLimit`, `recordRequest` | Low |
| Legacy logging | `logger.ts` | Remove after confirming Winston adoption | Low |
| Deprecated auth helpers | `auth.ts` | Consolidate `verifyClientAccess` patterns | Low |

### Medium Priority
| Item | File | Action | Tokens |
|------|------|--------|--------|
| Console.log statements | Various | Replace with logger.info/debug | Medium |
| Hardcoded dev fallbacks | `oauthState.ts` | Remove fallback secrets | Low |
| Agent system evaluation | `server/agents/` | Determine if actively used | Low |

### Low Priority (Schedule Later)
| Item | File | Action | Tokens |
|------|------|--------|--------|
| ~~Continue routes.ts decomposition~~ | ~~`routes.ts`~~ | ~~Extract remaining routers~~ | ~~High~~ ✅ DONE |
| Split storage.ts | `storage.ts` | 🟡 In progress — Phase 1-2 complete | High |
| Migration file cleanup | `migrations/` | Remove duplicate/unused SQL | Medium |

---

## Routes Decomposition Progress (December 2025) — ✅ COMPLETE

### Summary
- **Before:** 4,832 lines in routes.ts with ~270 routes
- **After:** 300 lines in routes.ts with 3 routes (37 domain router registrations, ~325 routes)
- **Reduction:** 94% file size reduction

### All Domain Routers Mounted (~325 routes via 37 registrations)

| Router | Routes | Key Endpoints |
|--------|--------|---------------|
| `auth.ts` | 3 | login, logout, session |
| `user.ts` | 2 | profile get/update |
| `client.ts` | 10 | Client portal endpoints |
| `agency.ts` | 17 | projects, metrics, staff |
| `agency-clients.ts` | 7 | client management, sync |
| `agency-settings.ts` | 5 | agency configuration |
| `agency-tasks.ts` | 13 | task CRUD, bulk ops |
| `agency-users.ts` | 5 | user management |
| `staff.ts` | 3 | tasks, notifications |
| `settings.ts` | 2 | rate limit settings |
| `superadmin.ts` | 24 | governance, agencies, users |
| `superadmin-health.ts` | 3 | health checks |
| `invoices.ts` | 6 | invoice CRUD, PDF |
| `tasks.ts` | 9 | task CRUD, subtasks |
| `intelligence.ts` | 21 | duration, optimization |
| `intelligence-extended.ts` | 27 | predictions, feedback |
| `knowledge.ts` | 12 | ingestion, retrieval |
| `knowledge-documents.ts` | 12 | document management |
| `workflows.ts` | 9 | workflow CRUD |
| `workflow-executions.ts` | 2 | execution events |
| `lineage.ts` | 2 | lineage tracing |
| `rule-engine.ts` | 12 | workflow rules |
| `signals.ts` | 11 | signal ingestion |
| `ai-execution.ts` | 5 | AI execution |
| `ai-chat.ts` | 2 | AI chat |
| `integrations.ts` | 19 | integration management |
| `oauth.ts` | 2 | OAuth flows |
| `analytics.ts` | 6 | analytics data |
| `initiatives.ts` | 9 | initiative management |
| `notifications.ts` | 5 | notifications |
| `messages.ts` | 7 | messaging |
| `objectives.ts` | 4 | objectives |
| `proposals.ts` | 2 | proposals |
| `retention-policies.ts` | 4 | retention policies |
| `public.ts` | 2 | public endpoints |

### Remaining in routes.ts (3 routes - intentional)
```
POST /api/metrics                         # Create metric
POST /api/agency/initiatives/mark-viewed  # Mark initiatives viewed
POST /api/test/create-user               # Development test endpoint
```

### Router Registration Pattern
```typescript
// server/routes/index.ts (37 registrations)
registerDomainRouter('/auth', authRoutes);
registerDomainRouter('/user', userRoutes);
registerDomainRouter('/client', clientRoutes);
registerDomainRouter('/agency', agencyRoutes);
registerDomainRouter('/agency/clients', agencyClientsRouter);
registerDomainRouter('/intelligence', intelligenceRoutes);
registerDomainRouter('/intelligence', intelligenceExtendedRoutes);
// ... 37 total registrations
```

---

## Migration Files Review

### Duplicate/Redundant Files
✅ **Completed December 2025:**

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

## Refactor Priorities (December 2025)

| Priority | Item | Tokens | Impact | Status |
|----------|------|--------|--------|--------|
| ~~P1~~ | ~~Complete routes.ts decomposition~~ | ~~High~~ | ~~High~~ | ✅ DONE Dec 2025 |
| ~~P1~~ | ~~Register all domain routers~~ | ~~Low~~ | ~~Medium~~ | ✅ DONE Dec 2025 |
| P1 | Storage layer split into domain services | High | High | 🟡 In progress (Phase 1-2 done) |
| P2 | Workflow engine integration tests | High | Medium | 🟡 Planned |
| P3 | Agent system evaluation and cleanup | Medium | Low | Backlog |
| P3 | Legacy logging migration to Winston | Medium | Low | Backlog |

---

*Generated: December 2025*
*Next Review: March 2026*
