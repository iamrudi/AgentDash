# Agency Client Portal - Priority Roadmap

## Executive Summary

This document outlines the **20-phase roadmap** for evolving the Agency Client Portal from a task management platform into a **full Workflow Engine** capable of deterministic automation, AI orchestration, and multi-agent operations.

Each priority is ordered by dependency—completing earlier phases unlocks capabilities required by later phases.

### Phase Summary (December 2025)

| Phase | Description | Status |
|-------|-------------|--------|
| 1-14 | Core Engine, Rules, Signals, AI, Lineage, Vectors, SLA, Agents, CRM, Analytics, Tasks, Templates, WebSocket, SuperAdmin | ✅ Complete |
| 15 | Visual Workflow Builder UI | 🟡 In Progress |
| 16-18 | Duration Intelligence, Closed Feedback Loop, Brand Knowledge Layer | ✅ Complete |
| 19 | Stability Testing Framework | ✅ Complete |
| 20 | Storage Layer Decomposition | 🟡 In Progress |

---

## Priority 1: Workflow Engine (Core Orchestration)

**Status:** ✅ COMPLETED (December 2025)  
**Complexity:** High  
**Dependencies:** None (foundational)  
**Tokens Needed:** High

### Description
Build the deterministic workflow orchestration core that processes signals, executes rules, invokes AI, and produces atomic outputs (projects, tasks, invoices).

### Deliverables ✅
- ✅ `WorkflowEngine` class with step-based execution (`server/workflow/engine.ts`)
- ✅ Workflow definition schema with Drizzle ORM (`shared/schema.ts`)
- ✅ Step types: `signal`, `rule`, `action`, `transform`, `notification`, `branch`
- ✅ Transaction wrapper ensuring atomic commits with `db.transaction()`
- ✅ Execution context with rollback capabilities
- ✅ Workflow status tracking: `pending` → `running` → `completed` | `failed`
- ✅ Idempotency enforcement via input hashing
- ✅ Step-level event logging with timing

### Implementation Details
```typescript
// server/workflow/engine.ts
class WorkflowEngine {
  constructor(storage: IStorage) { ... }
  async executeWorkflow(workflowId: string, input: WorkflowInput): Promise<WorkflowExecution>
  async getExecutionStatus(executionId: string): Promise<WorkflowExecution>
}

// Transaction-aware storage with getTx() method
// All step handlers use transaction context for atomic operations
```

### Success Criteria ✅
- ✅ Workflows execute deterministically with identical inputs → identical outputs
- ✅ All multi-table operations atomic (no partial state)
- ✅ Failed workflows correctly marked with error details
- ✅ Idempotent execution returns existing result for duplicate inputs

---

## Priority 2: Rule Engine (Versioned Rule System)

**Status:** ✅ COMPLETED (December 2025)  
**Complexity:** High  
**Dependencies:** Priority 1  
**Tokens Needed:** Medium

### Description
Implement a versioned rule engine with advanced operators for threshold detection, anomaly detection, and lifecycle triggers that integrates with the workflow engine.

### Deliverables ✅
- ✅ Rule schema with 7 tables: `workflow_rules`, `workflow_rule_versions`, `workflow_rule_conditions`, `workflow_rule_actions`, `workflow_rule_audits`, `workflow_signals`, `workflow_rule_evaluations`
- ✅ `RuleEngine` service with 16 operators (`server/workflow/rule-engine.ts`)
- ✅ Version management: Draft → Published workflow
- ✅ Audit trail for all rule changes
- ✅ Workflow integration via `ruleId` in rule steps
- ✅ 12 API endpoints with Zod validation

### Rule Operators (16 total)
```typescript
// Standard operators
'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 
'contains' | 'not_contains' | 'starts_with' | 'ends_with' |
'in' | 'not_in' | 'is_null' | 'is_not_null' |

// Advanced operators
'percent_change_gt' | 'percent_change_lt' |  // Threshold detection
'anomaly_zscore_gt' |                         // Z-score anomaly detection
'inactivity_days_gt' | 'changed_to' | 'changed_from'  // Lifecycle triggers
```

### Rule Schema
```typescript
interface WorkflowRule {
  id: string;
  agencyId: string;
  name: string;
  description?: string;
  category: 'threshold' | 'anomaly' | 'lifecycle' | 'integration' | 'custom';
  enabled: boolean;
  defaultVersionId?: string;
}

interface WorkflowRuleVersion {
  id: string;
  ruleId: string;
  version: number;
  status: 'draft' | 'published' | 'deprecated';
  conditionLogic: 'all' | 'any';
  thresholdConfig?: { value: number; windowDays?: number };
  anomalyConfig?: { zScoreThreshold: number; windowDays: number };
}
```

### Success Criteria ✅
- ✅ Rules execute in < 10ms per evaluation
- ✅ Rule changes versioned and auditable
- ✅ Workflow steps support both inline conditions and versioned rules via ruleId
- ✅ All API endpoints validate with Zod before persistence

---

## Priority 3: Signal Processing & Ingestion

**Status:** ✅ COMPLETED (December 2025)  
**Complexity:** Medium  
**Dependencies:** Priority 1, 2  
**Tokens Needed:** Medium

### Description
Create a normalized signal format that ingests events from GA4, GSC, HubSpot, LinkedIn, and internal application events into the workflow engine.

### Deliverables ✅
- ✅ Signal ingestion adapters per source (`server/workflow/signal-adapters.ts`)
- ✅ SignalNormalizer for canonical payload transformation (`server/workflow/signal-normalizer.ts`)
- ✅ SignalRouter for routing signals to matching workflows (`server/workflow/signal-router.ts`)
- ✅ Extended workflow_signals schema with dedup, status, and retry fields
- ✅ workflow_signal_routes table for routing configuration
- ✅ 12 API endpoints for signal ingestion and route management
- ✅ WorkflowEngine integration with executeFromSignal() method

### Implementation Files
```typescript
// Signal adapters for each source
server/workflow/signal-adapters.ts  // GA4, GSC, HubSpot, LinkedIn, Internal adapters

// Normalization with deterministic dedup hash
server/workflow/signal-normalizer.ts  // Canonical payload + SHA-256 hash

// Routing logic with payload filters
server/workflow/signal-router.ts  // Route matching + workflow triggering
```

### Signal Deduplication
- Deterministic hash: SHA-256(agencyId + source + type + canonicalPayload)
- Unique constraint on (agency_id, dedup_hash) prevents duplicates
- Hash excludes ingestion-time metadata (ingestedAt)
- Provider timestamps included only when explicitly provided

### Success Criteria ✅
- ✅ Signals normalized to canonical format before persistence
- ✅ Duplicate signals deduplicated via hash (identical inputs → single record)
- ✅ Signal routes filter by source/type/urgency/payload
- ✅ WorkflowEngine triggered automatically for matching routes
- ✅ Failed signals tracked with retry count for reprocessing

---

### Original Deliverables (reference)
- Signal ingestion adapters per source
- Signal queue (in-memory or Redis-backed)
- Signal routing to appropriate workflows
- Signal deduplication by content hash
- Anomaly detection for analytics signals

### Signal Sources
| Source | Signal Types |
|--------|-------------|
| GA4 | traffic_drop, conversion_change, session_anomaly |
| GSC | ranking_drop, impression_spike, ctr_change |
| HubSpot | deal_stage_changed, lead_created, contact_updated |
| LinkedIn | engagement_drop, follower_change |
| Internal | task_completed, initiative_approved, invoice_paid |

### Technical Approach
```typescript
// Signal adapter interface
interface SignalAdapter {
  source: string;
  normalize(rawData: any): WorkflowSignal;
  validate(signal: WorkflowSignal): boolean;
}

// Signal processing pipeline
async function processSignal(signal: WorkflowSignal) {
  // 1. Validate and deduplicate
  // 2. Route to matching workflows
  // 3. Execute workflows atomically
}
```

### Success Criteria
- All external data sources normalize to Signal format
- Signals trigger workflows within 5 seconds of receipt
- Duplicate signals rejected by hash

---

## Priority 4: Hardened AI Execution Layer

**Status:** ✅ COMPLETED (December 2025)  
**Complexity:** High  
**Dependencies:** Priority 1  
**Tokens Needed:** Medium

### Description
Strengthen the AI invocation layer with schema validation, retry logic, idempotency guarantees, and output hashing for reproducibility.

### Deliverables ✅
- ✅ AI response schema validation (Zod) via `HardenedAIExecutor.executeWithSchema()`
- ✅ Exponential backoff retry with jitter (`server/ai/hardened-executor.ts`)
- ✅ Idempotent writes via content hashing (inputHash for dedup, outputHash for reproducibility)
- ✅ Request/response logging with lineage (`ai_executions` table with workflowExecutionId, stepId)
- ✅ Response caching with configurable TTL (5-minute in-memory cache)
- ✅ Token usage tracking per agency (`ai_usage_tracking` table with monthly aggregation)
- ✅ Agency-level authorization on AI execution endpoints (cross-tenant isolation)

### Implementation Files
```typescript
// Hardened AI executor with validation, caching, retry
server/ai/hardened-executor.ts

// AI execution and usage tracking schema
shared/schema.ts (ai_executions, ai_usage_tracking tables)

// WorkflowEngine integration
server/workflow/engine.ts (AI step handler uses HardenedAIExecutor)
```

### Token Tracking
- Real token counts from providers when available
- Estimation fallback: ~4 characters per token
- Monthly aggregation per agency/provider/model
- Tracks: promptTokens, completionTokens, totalTokens, cachedRequests

### Success Criteria ✅
- ✅ Invalid AI responses rejected with clear validation errors
- ✅ Identical inputs return cached responses (idempotent)
- ✅ All AI calls traceable to originating workflow/signal via lineage fields
- ✅ Token usage tracked and aggregated per agency

---

## Priority 5: Workflow Lineage & Event Logging

**Status:** ✅ COMPLETED (December 2025)  
**Complexity:** Medium  
**Dependencies:** Priority 1, 4  
**Tokens Needed:** Medium

### Description
Implement comprehensive event logging that captures every workflow execution, enabling full replay and debugging.

### Deliverables ✅
- ✅ `workflow_executions` table with execution tracking
- ✅ `workflow_events` table (step-by-step log)
- ✅ Execution replay capability (`POST /api/workflow-executions/:id/replay`)
- ✅ Lineage query APIs:
  - `GET /api/lineage/task/:taskId` - Trace task to originating workflow/signal
  - `GET /api/lineage/project/:projectId` - Trace project with all created entities
  - `GET /api/workflow-executions/:id/lineage` - Get all entities created by execution
- ✅ Retention policy system (`workflow_retention_policies` table)
- ✅ `workflowExecutionId` fields on projects, taskLists, tasks for lineage tracking
- ✅ Cross-tenant security: All lineage/replay endpoints enforce strict agency-level authorization

### Implementation Files
```typescript
// Schema additions
shared/schema.ts (workflowRetentionPolicies, workflowExecutionId fields)

// Lineage and replay API endpoints
server/routes.ts (lineage query, replay, retention policy APIs)
```

### Retention Policy Features
- Configurable retention days per resource type
- Resource types: workflow_executions, workflow_events, signals, ai_executions, rule_evaluations
- Archive before delete option (for future cold storage)
- Tracks cleanup stats (lastCleanupAt, recordsDeleted)
- Agency-scoped cleanup (no cross-tenant data deletion)

### Security Hardening
- Replay endpoint validates BOTH execution.agencyId AND workflow.agencyId
- Lineage endpoints filter all nested entities by caller's agencyId
- Retention cleanup scopes deletions by agency (rule_evaluations via rule ownership)

### Success Criteria ✅
- ✅ Any workflow execution fully reconstructable from events
- ✅ Lineage query: "What created this task?" → full chain
- ✅ Configurable retention with per-agency policies
- ✅ No cross-tenant data exposure in lineage or replay operations

---

## Priority 6: Tenant-Isolated Vector Stores

**Status:** ✅ COMPLETED (December 2025)  
**Complexity:** High  
**Dependencies:** None (can parallel with 1-5)  
**Tokens Needed:** High

### Description
Create per-agency vector stores for SOPs, brand assets, analytics embeddings, and knowledge bases for "Chat with Your Data" features.

### Deliverables ✅
- ✅ Vector storage schema with agency isolation (`knowledgeDocuments`, `documentEmbeddings` tables)
- ✅ Embedding pipeline with dual provider support (OpenAI text-embedding-3-small, Gemini text-embedding-004)
- ✅ Semantic search API with cosine similarity and query logging
- ✅ Document ingestion with smart chunking (~500 tokens, 50 token overlap)
- ✅ Index management endpoints (rebuild, prune, stats) with Admin-only access

### Implementation Files
```typescript
// server/vector/embedding-service.ts
class EmbeddingService {
  generateEmbedding(text, provider)     // OpenAI/Gemini abstraction
  indexDocument(documentId, agencyId)   // Chunk and embed
  semanticSearch(query, agencyId, options)  // Cosine similarity search
  rebuildIndex(agencyId)                // Full reindex
  pruneOrphanedEmbeddings(agencyId)     // Cleanup
  getIndexStats(agencyId)               // Stats per agency
}

// Schema (shared/schema.ts)
knowledgeDocuments, documentEmbeddings, embeddingIndexStats, semanticSearchLogs

// API Endpoints (server/routes.ts)
GET/POST/PATCH/DELETE /api/knowledge-documents
POST /api/knowledge-documents/:id/reindex
POST /api/semantic-search
GET /api/embedding-stats
POST /api/embedding-index/rebuild (Admin only)
POST /api/embedding-index/prune (Admin only)
```

### Security Hardening ✅
- All endpoints derive agencyId from `req.user?.agencyId` (no query parameter override)
- Document CRUD enforces ownership via `where(and(eq(id), eq(agencyId)))`
- Semantic search uses parameterized `inArray()` queries (no SQL injection)
- All document lookups include agency filtering to prevent cross-tenant leakage
- Admin-only endpoints protected with `requireRole(["Admin"])`

### Success Criteria ✅
- ✅ Embeddings strictly isolated by agency
- ✅ Semantic search returns relevant chunks with cosine similarity scoring
- ✅ Documents re-indexed on update via reindex endpoint
- ✅ No cross-tenant data exposure in any vector operation

---

## Priority 7: SLA & Escalation Engine

**Status:** ✅ COMPLETED (December 2025)  
**Complexity:** Medium  
**Dependencies:** Priority 1, 3  
**Tokens Needed:** Medium

### Description
Add deadline monitoring, SLA breach detection, and automatic escalation to fallback owners.

### Deliverables ✅
- ✅ SLA definition per project/client (`sla_definitions` table)
- ✅ Deadline monitoring cron (runs every 5 minutes via `sla-cron.ts`)
- ✅ Escalation chain configuration (`escalation_chains` table with multi-level support)
- ✅ Breach notifications (in-app and email actions)
- ✅ Breach lifecycle tracking (`sla_breaches`, `sla_breach_events` tables)

### Implementation Files
```typescript
// SLA Service with breach detection and escalation
server/sla/sla-service.ts

// Automated monitoring cron job
server/sla/sla-cron.ts

// REST API endpoints with security hardening
server/sla/sla-routes.ts

// Schema additions
shared/schema.ts (slaDefinitions, slaBreaches, slaBreachEvents, escalationChains)
```

### Security Hardening ✅
- ✅ Client/Project ownership validation before SLA creation
- ✅ Strict field whitelisting on updates (no clientId/projectId reassignment)
- ✅ Agency ownership validation on all breach operations
- ✅ Cross-tenant access prevention via parameterized queries

### API Endpoints
- `GET/POST /api/sla/definitions` - List/create SLA definitions
- `GET/PATCH/DELETE /api/sla/definitions/:id` - Single SLA operations
- `GET/POST /api/sla/definitions/:id/escalations` - Escalation chain management
- `GET /api/sla/breaches` - List breaches with filtering
- `POST /api/sla/breaches/:id/acknowledge` - Acknowledge breach
- `POST /api/sla/breaches/:id/resolve` - Resolve breach
- `POST /api/sla/scan` - Trigger manual breach scan

### Success Criteria ✅
- ✅ SLA breaches detected within 5 minutes (cron interval)
- ✅ Escalations support automatic task reassignment
- ✅ Full breach lifecycle tracking with audit trail

---

## Priority 8: Multi-Agent Architecture

**Status:** ✅ COMPLETED (December 2025)  
**Complexity:** Very High  
**Dependencies:** Priority 1, 4, 6  
**Tokens Needed:** Very High

### Description
Implement specialized AI agents for different domains (SEO, PPC, CRM, Reporting) that can be orchestrated by the workflow engine.

### Deliverables ✅
- ✅ Agent interface definition (`BaseAgent` abstract class)
- ✅ SEO Agent (keyword analysis, content optimization, technical SEO audits)
- ✅ PPC Agent (campaign analysis, bid optimization, budget allocation)
- ✅ CRM Agent (lead scoring, pipeline analysis, customer segmentation)
- ✅ Reporting Agent (report generation, data visualization, trend analysis)
- ✅ Agent routing via `AgentOrchestrator` (domain matching, capability routing)
- ✅ Agent collaboration protocol with shared context
- ✅ Workflow engine integration via new "agent" step type
- ✅ REST API endpoints with agency isolation

### Implementation Files
```typescript
// Base agent with analyze/recommend/execute lifecycle
server/agents/base-agent.ts

// 4 domain-specific agents
server/agents/domain-agents.ts (SEOAgent, PPCAgent, CRMAgent, ReportingAgent)

// Orchestrator for routing and collaboration
server/agents/orchestrator.ts

// AI provider abstraction (Gemini/OpenAI)
server/agents/ai-provider-adapter.ts

// REST API with agency isolation
server/agents/agent-routes.ts

// Schema additions
shared/schema.ts (agents, agent_capabilities, agent_executions, agent_collaborations)
```

### Agent Interface
```typescript
abstract class BaseAgent {
  abstract readonly domain: AgentDomain;
  abstract readonly capabilities: string[];
  
  async analyze(context: AgentContext): Promise<AgentResult>;
  async recommend(context: AgentContext): Promise<AgentResult>;
  async execute(action: AgentAction): Promise<AgentResult>;
  
  // Audit trail with input/output hashing
  protected async logExecution(params: ExecutionLog): Promise<void>;
}
```

### Orchestrator Features
- Domain-based routing (SEO signals → SEOAgent)
- Capability matching for cross-domain requests
- Priority-based agent selection
- Multi-agent collaboration with shared context
- Workflow integration via "agent" step type

### API Endpoints
- `GET/POST /api/agents` - List/create agents
- `GET/PATCH/DELETE /api/agents/:id` - Single agent operations
- `GET/POST /api/agents/:id/capabilities` - Capability management
- `DELETE /api/agents/:id/capabilities/:capabilityId` - Remove capability
- `GET /api/agents/executions` - List executions for agency
- `GET /api/agents/:id/executions` - List executions for agent
- `POST /api/agents/orchestrate` - Execute orchestrated workflow

### Security ✅
- All endpoints enforce strict agency-scoped queries
- Agent executions logged with full audit trail
- Idempotency via input hashing prevents duplicates
- Agency isolation at orchestrator and API levels

### Success Criteria ✅
- ✅ Agents produce domain-specific recommendations
- ✅ Workflow engine routes to correct agent via orchestrator
- ✅ Agent outputs logged with lineage tracking
- ✅ Multi-agent collaboration with shared context

---

## Priority 9: Expanded CRM Integration Triggers

**Status:** ✅ COMPLETED (December 2025)  
**Complexity:** Medium  
**Dependencies:** Priority 2, 3  
**Tokens Needed:** Medium

### Description
Add lifecycle-based triggers from CRM events that feed into the workflow engine.

### Deliverables ✅
- ✅ Deal stage change → Signal (`deal_created`, `deal_updated`, `deal_deleted`, `deal_propertyChange`)
- ✅ Contact property change → Signal (`contact_created`, `contact_updated`, `contact_deleted`, `contact_propertyChange`)
- ✅ Company association → Signal (`company_created`, `company_updated`, `company_deleted`, `company_propertyChange`)
- ✅ Meeting events → Signal (`meeting_created`, `meeting_updated`, `meeting_deleted`)
- ✅ Form submission → Signal (`form_submitted`)
- ✅ CRM webhook handler with HubSpot v3 signature validation (SHA-256, constant-time comparison)
- ✅ Full integration with SignalRouter for workflow triggering
- ✅ Agency-isolated webhook routing via `hubspotPortalId` mapping

### Trigger Examples
| CRM Event | Signal Type | Workflow |
|-----------|-------------|----------|
| Deal moved to "Proposal" | `deal_stage_changed` | Generate proposal tasks |
| Contact marked "Champion" | `contact_property_changed` | Increase engagement |
| New company created | `company_created` | Client onboarding workflow |
| Meeting scheduled | `meeting_scheduled` | Prep checklist |

### Implementation Details
```typescript
// server/crm/crm-webhook-handler.ts
class CRMWebhookHandler {
  verifyHubSpotSignature(requestBody: string, signature: string, clientSecret: string): Promise<boolean>
  findAgencyByPortalId(portalId: string): Promise<string | null>
  normalizeHubSpotEvent(payload: CRMWebhookPayload): NormalizedCRMEvent
  processWebhookBatch(payloads: CRMWebhookPayload[]): Promise<ProcessResult>
  processAndRouteCRMEvent(agencyId: string, event: NormalizedCRMEvent): Promise<RoutingResult>
}

// server/crm/crm-routes.ts - REST API Endpoints
POST /api/crm/webhooks/hubspot - Public webhook endpoint for HubSpot events
GET  /api/crm/status/:agencyId  - Check HubSpot integration status
GET  /api/crm/events            - List CRM signals for agency
POST /api/crm/sync/:agencyId    - Trigger manual CRM sync
```

### Success Criteria ✅
- ✅ CRM events trigger workflows via SignalRouter.ingestSignal()
- ✅ All major lifecycle events covered (16 event types)
- ✅ No duplicate signals from webhook retries (SHA256 dedup hash)
- ✅ Agency isolation via portal ID to agency mapping

---

## Priority 10: Enhanced Analytics Ingestion

**Status:** ✅ COMPLETED (December 2025)  
**Complexity:** Medium  
**Dependencies:** Priority 2  
**Tokens Needed:** Medium

### Description
Add anomaly detection to analytics pipelines that automatically generates signals for significant changes.

### Deliverables ✅
- ✅ Statistical anomaly detection (Z-score, IQR) via `AnomalyDetectionService`
- ✅ Trend analysis (week-over-week, month-over-month)
- ✅ Threshold configuration per client with `AnomalyThreshold` interface
- ✅ Anomaly → Signal conversion via `AnalyticsAdapter` and `SignalRouter`
- ✅ False positive filtering with confidence scoring

### Implementation Details
```typescript
// server/analytics/anomaly-detection.ts
class AnomalyDetectionService {
  calculateZScore(value: number, dataset: number[]): number
  calculateIQRBounds(dataset: number[]): IQRBounds
  detectAnomaliesForClient(clientId: string, agencyId: string): Promise<DetectedAnomaly[]>
  convertAnomalyToSignal(anomaly: DetectedAnomaly): Promise<string | null>
  analyzeTrends(clientId: string): Promise<TrendAnalysis[]>
  runAnomalyDetectionForAgency(agencyId: string): Promise<AnomalyResults[]>
}

// Anomaly Types Supported
type AnomalyType = 
  | 'traffic_drop' | 'traffic_spike'
  | 'conversion_drop' | 'conversion_spike'
  | 'ranking_loss' | 'ranking_gain'
  | 'impression_drop' | 'click_drop'
  | 'spend_anomaly' | 'bounce_rate_spike';
```

### API Endpoints
- `GET /api/analytics/anomalies/:clientId` - Detect anomalies for a client
- `GET /api/analytics/trends/:clientId` - Get WoW/MoM trend analysis
- `POST /api/analytics/anomalies/scan` - Scan all clients in agency
- `POST /api/analytics/anomalies/:clientId/convert` - Convert anomalies to signals
- `GET /api/analytics/statistics/:clientId` - Get statistical summary

### Anomaly Types
| Metric | Detection Method | Threshold |
|--------|------------------|-----------|
| Traffic drop | Z-score | > 2.5 std dev |
| Ranking loss | Absolute change | > 10 positions |
| Conversion rate | Percentage change | > 25% decline |
| Bounce rate spike | Z-score | > 2 std dev |

### Success Criteria ✅
- ✅ Anomalies detected via configurable thresholds per metric type
- ✅ False positive filtering with weekend pattern detection and confidence scoring
- ✅ Configurable sensitivity per client via `AnomalyThreshold` interface

---

## Priority 11: Optimized Task System for Workflow Output

**Status:** ✅ COMPLETED (December 2025)  
**Complexity:** Medium  
**Dependencies:** Priority 1  
**Tokens Needed:** Low

### Description
Make task/project creation idempotent so workflows can safely retry without creating duplicates.

### Deliverables ✅
- ✅ `idempotencyKey` field on tasks table for workflow-safe upsert
- ✅ `contentHash` field on tasks table for deduplication
- ✅ Upsert semantics via `IdempotentTaskService.upsertTask()`
- ✅ Batch task creation API (`POST /api/tasks/workflow/batch`)
- ✅ Task deduplication by content hash via `findDuplicateTasks()`
- ✅ Workflow-to-task lineage via `workflowExecutionId` and `getTaskLineage()`

### Implementation Files
```typescript
// Idempotent task service
server/tasks/idempotent-task-service.ts
  - createTaskIdempotent(input, idempotencyKey, agencyId)
  - createTaskByContentHash(input, agencyId)
  - createTasksIdempotent(batchInput, agencyId) // Transaction-wrapped
  - upsertTask(input, idempotencyKey, agencyId)
  - findDuplicateTasks(input, agencyId)
  - getTaskLineage(taskId)

// REST API endpoints
server/tasks/task-routes.ts
  - POST /api/tasks/workflow/idempotent
  - POST /api/tasks/workflow/batch
  - PUT /api/tasks/workflow/upsert
  - POST /api/tasks/workflow/deduplicate
  - GET /api/tasks/workflow/:taskId/lineage
```

### Security ✅
- All endpoints verify project/list belongs to authenticated agency
- Admin/SuperAdmin role required for all operations
- Content hash prevents accidental duplicates across retries

### Success Criteria ✅
- ✅ Workflow retry creates no duplicates (idempotencyKey lookup)
- ✅ Batch creation completes in single transaction
- ✅ All workflow-created tasks traceable via lineage endpoint

---

## Priority 12: Template System

**Status:** ✅ COMPLETED (December 2025)  
**Complexity:** Medium  
**Dependencies:** Priority 1, 11  
**Tokens Needed:** Medium

### Description
Create reusable templates for projects, task lists, workflows, and AI prompts.

### Deliverables ✅
- ✅ Template schema with variables (`templates`, `templateVersions`, `templateInstantiations` tables)
- ✅ Project templates with nested task lists and tasks
- ✅ Task list templates
- ✅ Workflow templates
- ✅ Prompt templates with variable injection
- ✅ Template versioning with changelog tracking

### Implementation Files
```typescript
// Schema (shared/schema.ts)
- templates: Core template table with type, name, content, variables
- templateVersions: Version history with changelog
- templateInstantiations: Usage tracking with variable values

// Service (server/templates/template-service.ts)
- substituteVariables(content, values): {{variable}} replacement
- validateVariables(templateVars, providedValues): Type validation
- createTemplate, updateTemplate, getTemplatesForAgency
- instantiateProjectTemplate: Creates project with task lists & tasks
- instantiatePromptTemplate: Returns substituted prompt text
- cloneTemplate: Copy public/system templates to agency

// API Endpoints (server/templates/template-routes.ts)
- GET /api/templates - List templates (agency + system + public)
- GET /api/templates/:id - Get single template
- POST /api/templates - Create new template
- PATCH /api/templates/:id - Update (auto-versions on content change)
- DELETE /api/templates/:id - Delete template
- GET /api/templates/:id/versions - Get version history
- GET /api/templates/:id/versions/:versionId - Get specific version
- POST /api/templates/:id/instantiate - Create project/prompt from template
- POST /api/templates/:id/clone - Clone to own agency
```

### Variable Types Supported
| Type | Validation |
|------|------------|
| string | minLength, maxLength, pattern (regex) |
| number | min, max |
| date | ISO date parse check |
| boolean | true/false values |
| select | Must match one of defined options |
| array | Must be array type |

### Security ✅
- Agency-scoped templates with tenant isolation
- System templates (agencyId=null) available to all
- Public templates can be cloned by other agencies
- Admin/SuperAdmin role required for all operations

### Success Criteria ✅
- ✅ Templates instantiate with {{variable}} substitution
- ✅ Version history preserved with changelogs
- ✅ Agency-specific and system templates supported
- ✅ Project templates create full hierarchy (project → lists → tasks → subtasks)
- ✅ Workflow lineage tracking via workflowExecutionId

---

## Priority 13: Real-Time Layer Improvements

**Status:** ✅ COMPLETED (December 2025)  
**Complexity:** Medium  
**Dependencies:** None (can parallel)  
**Tokens Needed:** Medium

### Description
Migrate messaging and presence from polling to WebSocket/SSE for true real-time updates.

### Deliverables ✅
- ✅ WebSocket server integration with JWT authentication
- ✅ Connection management with 30-second heartbeat
- ✅ Channel-based subscriptions (agency, project, task, user channels)
- ✅ Presence indicators (online/away/offline) with automatic detection
- ✅ Reconnection with message replay (100 message buffer per channel)
- ✅ Fallback to SSE for restricted environments

### Implementation Files
```typescript
// WebSocket Server (server/realtime/websocket-server.ts)
class RealtimeServer {
  initialize(server: Server): void
  broadcast(channel: string, message: RealtimeMessage): void
  sendToUser(userId: string, message: RealtimeMessage): void
  getOnlineUsers(agencyId: string): string[]
  getPresence(agencyId: string): Array<{ userId: string; status: string }>
}

// Unified Real-Time Service (server/realtime/realtime-service.ts)
class RealtimeService {
  registerSSEClient(res, userId, agencyId, channels, lastEventId): string
  broadcast(channel, message, excludeUserId?): void
  broadcastToAgency(agencyId, message, excludeUserId?): void
  broadcastToProject(projectId, message, excludeUserId?): void
  notifyNewMessage(agencyId, message): void
  notifyTaskUpdate(agencyId, task, updatedBy): void
  notifyNotification(userId, notification): void
  notifyWorkflowExecution(agencyId, execution): void
}

// Frontend Hook (client/src/hooks/use-realtime.ts)
function useRealtime(options): {
  status, lastMessage, onlineUsers, subscribe, unsubscribe, send, isConnected
}
function useRealtimeChannel(channel, onMessage): { send, isConnected }
```

### API Endpoints
- `GET /ws?token=<jwt>` - WebSocket connection endpoint
- `GET /api/realtime/stream` - SSE fallback endpoint
- `GET /api/realtime/presence` - Get agency presence
- `GET /api/realtime/online-users` - Get online users
- `GET /api/realtime/stats` - SuperAdmin connection stats

### Architecture
```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│   Client    │────▶│  WebSocket      │────▶│   In-Memory │
│   Browser   │◀────│  Server         │◀────│   Channels  │
└─────────────┘     └─────────────────┘     └─────────────┘
       │                    │
       │                    ▼
       │            ┌─────────────────┐
       └──SSE───────│   SSE Fallback  │
                    │   (Graceful)    │
                    └─────────────────┘
```

### Success Criteria ✅
- ✅ Messages delivered via WebSocket or SSE fallback
- ✅ Presence updates with 5-minute away timeout
- ✅ Graceful degradation to SSE if WebSocket fails
- ✅ Message replay for reconnection scenarios
- ✅ Frontend hook with auto-reconnect and visibility detection

---

## Priority 14: SuperAdmin Governance Enhancements

**Status:** ✅ COMPLETED (December 2025)  
**Complexity:** Medium  
**Dependencies:** Priority 4, 8  
**Tokens Needed:** Medium

### Description
Add comprehensive governance controls for AI quotas, token caps, and integration health monitoring.

### Deliverables ✅
- ✅ Per-agency AI token quotas (`agencyQuotas` table with token/request limits)
- ✅ Usage tracking and quota enforcement (`QuotaService` with incrementAIUsage)
- ✅ Integration health dashboard (`IntegrationHealthService`, governance dashboard UI)
- ✅ Token rotation management (`getExpiringTokens()` with proactive alerts)
- ✅ Rate limit configuration (`rateLimitConfigs` table)
- ✅ Governance audit logging (`governanceAuditLogs` table)

### Implementation Files
```typescript
// Schema additions
shared/schema.ts (agencyQuotas, integrationHealth, governanceAuditLogs, rateLimitConfigs)

// Governance services
server/governance/quota-service.ts     // AI quota enforcement
server/governance/integration-health-service.ts  // Health monitoring
server/governance/governance-routes.ts // SuperAdmin API endpoints

// AI executor integration
server/ai/hardened-executor.ts         // Quota checks before/after execution

// Frontend
client/src/pages/governance-dashboard.tsx  // SuperAdmin dashboard UI
```

### Governance Schema
```typescript
interface AgencyQuotas {
  agencyId: string;
  aiTokenLimit: number;         // Monthly
  aiTokenUsed: number;
  aiRequestLimit: number;       // Monthly requests
  aiRequestsUsed: number;
  storageLimit: number;         // GB
  storageUsed: number;
  seatLimit: number;
  seatsUsed: number;
  resetDate: Date;
}

interface IntegrationHealth {
  agencyId: string;
  integration: string;
  status: 'healthy' | 'degraded' | 'failed';
  lastCheck: Date;
  tokenExpiresAt: Date;
  errorCount: number;
}
```

### API Endpoints
- `GET/PATCH /api/governance/quotas/:agencyId` - Quota management
- `POST /api/governance/quotas/:agencyId/reset` - Manual quota reset
- `POST /api/governance/quotas/:agencyId/sync` - Sync resource counts
- `GET /api/governance/integrations/health` - Health overview
- `GET /api/governance/agencies` - List agencies with stats
- `GET /api/governance/audit-logs` - Audit log search
- `GET /api/governance/dashboard` - Dashboard stats

### Success Criteria ✅
- ✅ AI usage blocked at quota limit (pre-execution checks in executor)
- ✅ Proactive alerts for token expiry (getExpiringTokens)
- ✅ Integration health monitoring with status tracking

---

## Priority 15: Workflow Builder UI

**Status:** 🔴 Not Started  
**Complexity:** Very High  
**Dependencies:** Priority 1, 3, 12  
**Tokens Needed:** Very High

### Description
Create a visual DAG (Directed Acyclic Graph) editor for building and modifying workflows without code.

### Deliverables
- Drag-and-drop workflow canvas
- Step palette (signals, rules, AI, actions)
- Connection drawing and validation
- Variable binding UI
- Test execution with mock signals
- Version comparison view

### UI Components
```
┌─────────────────────────────────────────────────────────────┐
│  Workflow: Client Onboarding                    [Save] [Run]│
├─────────────────────────────────────────────────────────────┤
│ ┌──────────┐                                               │
│ │ Palette  │    ┌─────────────────────────────────────┐   │
│ ├──────────┤    │                                     │   │
│ │ ○ Signal │    │   [Trigger]──▶[Rule]──▶[AI]        │   │
│ │ ○ Rule   │    │                  │                  │   │
│ │ ○ AI     │    │                  ▼                  │   │
│ │ ○ Action │    │             [Create Tasks]          │   │
│ │ ○ Branch │    │                  │                  │   │
│ │ ○ Loop   │    │                  ▼                  │   │
│ └──────────┘    │             [Send Email]            │   │
│                 │                                     │   │
│                 └─────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│ Properties: [AI Step - Generate Welcome Tasks]             │
│ Model: Gemini Pro  │  Prompt Template: onboarding_v2      │
└─────────────────────────────────────────────────────────────┘
```

### Success Criteria
- Non-technical users can build simple workflows
- Visual validation prevents invalid DAGs
- Test runs show step-by-step execution

---

## Dependency Graph (December 2025)

```
Priority 1 (Workflow Engine) ✅
    │
    ├──▶ Priority 2 (Rule Engine) ✅
    │        │
    │        └──▶ Priority 3 (Signal Processing) ✅
    │                 │
    │                 └──▶ Priority 7 (SLA Engine) ✅
    │                 └──▶ Priority 9 (CRM Triggers) ✅
    │                 └──▶ Priority 10 (Analytics Ingestion) ✅
    │
    ├──▶ Priority 4 (AI Execution Layer) ✅
    │        │
    │        └──▶ Priority 5 (Lineage & Logging) ✅
    │        └──▶ Priority 8 (Multi-Agent) ✅
    │        └──▶ Priority 14 (SuperAdmin Governance) ✅
    │
    ├──▶ Priority 11 (Task System Optimization) ✅
    │        │
    │        └──▶ Priority 12 (Template System) ✅
    │                 │
    │                 └──▶ Priority 15 (Workflow Builder UI) 🟡 IN PROGRESS
    │
    ├──▶ Priority 6 (Vector Stores) ✅
    │
    ├──▶ Priority 13 (Real-Time Layer) ✅
    │
    ├──▶ Priority 16 (Duration Intelligence) ✅
    │        │
    │        └──▶ Priority 17 (Closed Feedback Loop) ✅
    │                 │
    │                 └──▶ Priority 18 (Brand Knowledge Layer) ✅
    │
    ├──▶ Priority 19 (Stability Testing Framework) ✅
    │
    └──▶ Priority 20 (Storage Layer Decomposition) 🟡 IN PROGRESS
```

---

## Implementation Timeline

| Phase | Priorities | Tokens Needed | Status |
|-------|------------|---------------|--------|
| Foundation | 1, 2, 4 | High | ✅ Complete |
| Rules & Signals | 3, 10, 9 | High | ✅ Complete |
| AI & Lineage | 5, 6, 8 | Very High | ✅ Complete |
| Automation | 7, 11, 12 | High | ✅ Complete |
| Polish | 13, 14, 15 | Very High | 🟡 In Progress |
| Intelligence | 16, 17, 18 | Very High | ✅ Complete |
| Stability | 19, 20 | High | 🟡 In Progress |

**Total Progress:** 18/20 priorities complete (90%)

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Workflow complexity | Start with 3-5 step workflows, expand gradually |
| AI reliability | Aggressive caching, fallback providers |
| Signal volume | Queue-based processing, rate limiting |
| Multi-tenant isolation | RLS + application layer + testing |
| Performance degradation | Materialized views, query optimization |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Workflow execution time | < 5 seconds (simple), < 30 seconds (complex) |
| Signal processing latency | < 5 seconds from ingestion to workflow trigger |
| AI response cache hit rate | > 60% |
| Task creation idempotency | 100% (zero duplicates) |
| Workflow replay success | 100% for deterministic workflows |
| SuperAdmin visibility | Real-time across all agencies |

---

## Progress Summary

| Priority | Status | Completed |
|----------|--------|-----------|
| Priority 1: Workflow Engine | ✅ Complete | December 2025 |
| Priority 2: Rule Engine | ✅ Complete | December 2025 |
| Priority 3: Signal Processing | ✅ Complete | December 2025 |
| Priority 4: Hardened AI Execution | ✅ Complete | December 2025 |
| Priority 5: Workflow Lineage | ✅ Complete | December 2025 |
| Priority 6: Tenant-Isolated Vector Stores | ✅ Complete | December 2025 |
| Priority 7: SLA & Escalation Engine | ✅ Complete | December 2025 |
| Priority 8: Multi-Agent Architecture | ✅ Complete | December 2025 |
| Priority 9: CRM Integration Triggers | ✅ Complete | December 2025 |
| Priority 10: Enhanced Analytics Ingestion | ✅ Complete | December 2025 |
| Priority 11: Task System Optimization | ✅ Complete | December 2025 |
| Priority 12: Template System | ✅ Complete | December 2025 |
| Priority 13: Real-Time WebSocket/SSE Layer | ✅ Complete | December 2025 |
| Priority 14: SuperAdmin Governance | ✅ Complete | December 2025 |
| Priority 15: Visual Workflow Builder UI | 🟡 In Progress | December 2025 |
| Priority 16: Duration Intelligence | ✅ Complete | December 2025 |
| Priority 17: Closed Feedback Loop | ✅ Complete | December 2025 |
| Priority 18: Brand Knowledge Layer | ✅ Complete | December 2025 |
| **Priority 19: Stability Testing Framework** | ✅ Complete | December 2025 |
| **Priority 20: Storage Layer Decomposition** | 🟡 In Progress | December 2025 |

### Priority 20: Storage Layer Decomposition 🟡

**Status:** 🟡 IN PROGRESS (December 2025)  
**Complexity:** High  
**Dependencies:** None  
**Tokens Needed:** High

#### Description
Decompose the monolithic `server/storage.ts` (originally 3,713 lines) into domain-specific modules using bounded context approach aligned with existing router boundaries.

#### Progress
- ✅ **Phase 1 - Identity Domain** (12 methods): Users, profiles, sessions, password reset
- ✅ **Phase 2 - Task Domain** (27 methods): Task lists, tasks, assignments, activities, relationships, messages
- ⏳ **Phase 3** - Project/Client Domain (planned)
- ⏳ **Phase 4** - Invoice/Initiative Domain (planned)

#### Architecture Pattern
```
server/storage/
├── contracts/           # Domain interfaces
│   ├── identity.ts      # IdentityStorage interface
│   ├── agency.ts        # AgencyStorage interface
│   └── task.ts          # TaskStorage interface
└── domains/             # Function-based implementations
    ├── identity.storage.ts   # identityStorage(ctx)
    ├── agency.storage.ts     # agencyStorage(ctx)
    └── task.storage.ts       # taskStorage(ctx, getProjectById)
```

#### Metrics
- **Original:** 3,713 lines, ~150 methods
- **Current:** 3,245 lines (12.6% reduction)
- **Extracted:** 43 methods across 3 domains

#### Validation Gates (per phase)
1. Behavior parity check vs pre-refactor signatures
2. Storage-only compile gate (tsc)
3. Authenticated E2E verification

---

### Priority 19: Stability Testing Framework ✅

**Status:** ✅ COMPLETED (December 2025)  
**Complexity:** Medium  
**Dependencies:** Priority 7, 14  
**Tokens Needed:** Medium

#### Deliverables ✅
- ✅ Vitest test infrastructure with configuration
- ✅ Test helper utilities (`tests/utils/test-helpers.ts`)
- ✅ Auth middleware tests (18 tests) — role-based access, SuperAdmin bypass, cross-tenant rejection
- ✅ Maintenance middleware tests (8 tests) — bypass logic, 503 response format
- ✅ SLA service tests (18 tests) — deadline calculation, breach detection, boundary conditions

#### Implementation Files
```
tests/
├── utils/test-helpers.ts     # Mock utilities, test users
├── middleware/
│   ├── auth.test.ts          # 18 tests
│   └── maintenance.test.ts   # 8 tests  
├── sla/sla-service.test.ts   # 18 tests
└── setup.ts                  # Global configuration
```

#### Test Commands
```bash
npx vitest run tests/middleware tests/sla  # Run 44 stability tests
npx vitest run                             # All tests including example
npx vitest --coverage                      # Coverage report
```

#### Success Criteria ✅
- ✅ 44 stability tests passing
- ✅ Auth middleware validates role-based access
- ✅ Cross-tenant access rejection verified
- ✅ SLA breach detection boundary conditions tested
- ✅ Maintenance mode bypass logic tested with real middleware

### Priority 15 Progress Details
- ✅ React Flow library installed and integrated
- ✅ Workflow list page (`/agency/workflows`)
- ✅ Visual canvas editor (`/agency/workflow-builder/:id?`)
- ✅ Step palette with 7 draggable step types
- ✅ Custom React Flow nodes with Handle components
- ✅ Backend validate/duplicate endpoints with Zod
- ⏳ Properties panel for node configuration
- ⏳ Edge/connection validation
- ⏳ Variable binding system
- ⏳ Toolbar controls (save/validate/test)
- ⏳ Workflow version comparison
- ⏳ Test execution mode

---

## Technical Debt Register

### Critical (🔴 Must Address)

| Item | File | Lines | Issue | Status |
|------|------|-------|-------|--------|
| ~~Monolithic routes.ts~~ | ~~`server/routes.ts`~~ | ~~300~~ | ~~Decomposition complete~~ | ✅ DONE |
| Monolithic storage.ts | `server/storage.ts` | 3,245 | God object — decomposition in progress | 🟡 Phase 1-2 done |

### Routes Decomposition Progress (December 2025) — ✅ COMPLETE

**Summary:**
- **Before:** 4,832 lines in routes.ts with ~270 routes
- **After:** 300 lines in routes.ts with 3 routes (37 domain router registrations, ~325 routes)
- **Reduction:** 94% file size reduction

**37 Domain Router Registrations (~325 routes total):**

| Router | Routes | Description |
|--------|--------|-------------|
| `auth.ts` | 3 | Login, logout, session |
| `user.ts` | 2 | Profile get/update |
| `client.ts` | 10 | Client portal endpoints |
| `agency.ts` | 17 | Projects, metrics, staff |
| `agency-clients.ts` | 7 | Client management, sync |
| `agency-settings.ts` | 5 | Agency configuration |
| `agency-tasks.ts` | 13 | Task CRUD, bulk ops |
| `agency-users.ts` | 5 | User management |
| `staff.ts` | 3 | Tasks, notifications |
| `crm.ts` | 34 | Companies, contacts, deals |
| `settings.ts` | 2 | Rate limit settings |
| `superadmin.ts` | 24 | Governance, agencies, users |
| `superadmin-health.ts` | 3 | Health checks |
| `invoices.ts` | 6 | Invoice CRUD, PDF |
| `tasks.ts` | 9 | Task CRUD, subtasks |
| `intelligence.ts` | 21 | Duration, optimization |
| `intelligence-extended.ts` | 27 | Predictions, feedback |
| `knowledge.ts` | 12 | Ingestion, retrieval |
| `knowledge-documents.ts` | 12 | Document management |
| `workflows.ts` | 9 | Workflow CRUD |
| `workflow-executions.ts` | 2 | Execution events |
| `lineage.ts` | 2 | Lineage tracing |
| `rule-engine.ts` | 12 | Workflow rules |
| `signals.ts` | 11 | Signal ingestion |
| `ai-execution.ts` | 5 | AI execution |
| `ai-chat.ts` | 2 | AI chat |
| `integrations.ts` | 19 | Integration management |
| `oauth.ts` | 2 | OAuth flows |
| `analytics.ts` | 6 | Analytics data |
| `initiatives.ts` | 9 | Initiative management |
| `notifications.ts` | 5 | Notifications |
| `messages.ts` | 7 | Messaging |
| `objectives.ts` | 4 | Objectives |
| `proposals.ts` | 2 | Proposals |
| `retention-policies.ts` | 4 | Retention policies |
| `public.ts` | 2 | Public endpoints |

**Remaining in routes.ts (3 routes - intentional):**
- ✅ `POST /api/metrics` — Create metric
- ✅ `POST /api/agency/initiatives/mark-viewed` — Mark initiatives viewed  
- ✅ `POST /api/test/create-user` — Development test endpoint

**Security Guarantees Maintained:**
- Zod validation on POST/PATCH request bodies
- requireAuth middleware for JWT validation
- requireRole middleware for RBAC enforcement
- Cross-tenant protection via agencyId injection from user context
- Resource ownership validation (e.g., clientId belongs to user's agency)

### High Priority (🟠 Should Address Soon)

| Item | File | Issue | Tokens |
|------|------|-------|--------|
| Deprecated rate limit methods | `googleApiRateLimiter.ts` | `checkRateLimit`, `recordRequest` deprecated | Low |
| Legacy logging | `logger.ts` | Dual logging system (legacy + Winston) | Low |
| Redundant CRM routes | `routes/crm.ts` + `crm/crm-routes.ts` | Duplicated route definitions | Medium |
| ~~Duplicate migrations~~ | `migrations/` | ✅ Cleaned - duplicates deleted, utilities moved to scripts/ | ✅ Done |
| Console.log statements | Various | Should use structured logging | Medium |

### Medium Priority (🟡 Schedule for Cleanup)

| Item | File | Issue | Tokens |
|------|------|-------|--------|
| Empty email in users table | `client/src/pages/agency/users.tsx` | Shows blank email - `getAllUsersWithProfiles` returns empty email/password (Supabase Auth is source of truth). Fix: fetch email from Supabase Auth or add to profiles table | Medium |
| Agent system evaluation | `server/agents/` | Limited active usage | Medium |
| Redundant auth helpers | `auth.ts` | Multiple `verifyXAccess` functions | Low |
| Hardcoded dev fallbacks | `oauthState.ts` | Development secrets in code | Low |
| WebSocket URL bug | Vite HMR | `wss://localhost:undefined` - requires vite.config.ts change (protected) | N/A |

### Low Priority (📝 Document for Later)

| Item | File | Issue | Tokens |
|------|------|-------|--------|
| Split schema.ts | `shared/schema.ts` | 3,235 lines - consider domain splits | High |
| Test coverage gaps | Various | Intelligence services need tests | Very High |
| Forms page cleanup | `pages/forms/` | Only embed.tsx used | Low |

---

## Cleanup Actions

### Migration Files to Clean

✅ **Completed December 2025:**
- Deleted `0001_enable_rls_policies_fixed.sql` (duplicate)
- Deleted `add_task_lists_rls.sql` (duplicate of 0009)
- Deleted `apply_admin_delete_permissions.sql` (duplicate of 0004)
- Moved `simple_rls_check.sql` to scripts/
- Moved `all_in_one_rls_check_and_fix.sql` to scripts/
- Moved `verify_rls_complete.sql` to scripts/

### Code to Remove

| Action | Location | Reason |
|--------|----------|--------|
| Remove | `checkRateLimit()` in googleApiRateLimiter.ts | Deprecated, use `reserveRequest()` |
| Remove | `recordRequest()` in googleApiRateLimiter.ts | Deprecated, use `reserveRequest()` |
| Consolidate | `server/routes/crm.ts` | Merge into `server/crm/crm-routes.ts` |
| Evaluate | `server/agents/` | Determine if actively used |

### Refactoring Roadmap

**Phase 1: Quick Wins (Q1 2025)**
- Remove deprecated methods
- Consolidate CRM routes
- Clean migration files
- Replace console.log with logger

**Phase 2: Major Refactors (Q1-Q2 2025)** — Routes ✅ COMPLETE!
- ✅ Split routes.ts into domain modules (37 registrations, ~325 routes) — December 2025
- ✅ All routes extracted (only 3 intentional routes remain in routes.ts)
- 🟡 storage.ts decomposition in progress (Phase 1-2 complete, 43 methods extracted)
- Add comprehensive test coverage

**Phase 3: Architecture (Q3 2025)**
- Evaluate agent system retention
- Consider schema.ts domain splits
- Performance optimization audit

---

## Maintenance Scoring

See [docs/maintenance-matrix.md](./docs/maintenance-matrix.md) for detailed per-module health scores.

### Summary (December 2025)

| Category | Modules | Avg Score | Status |
|----------|---------|-----------|--------|
| Workflow Engine | 4 | 79 | 🟡 Good |
| Intelligence Layer | 6 | 82 | 🟢 Healthy |
| AI Providers | 4 | 84 | 🟢 Healthy |
| Domain Routers (mounted) | 6 | 80 | 🟢 Healthy |
| Domain Routers (extracted) | 2 | 77 | 🟡 Good |
| Core Backend | 2 | 54 | 🔴 Needs Attention |
| Integration Libraries | 5 | 75 | 🟡 Good |
| Real-time | 2 | 81 | 🟢 Healthy |
| **Test Infrastructure** | 5 | 85 | 🟢 Healthy |
| **Auth/Middleware (tested)** | 2 | 81 | 🟢 Healthy |

---

## Unlocked Roadmap Items (Post-Stability)

With the stability testing framework in place, the following features are now unblocked:

### P1 — Critical Path

| Item | Dependencies | Tokens | Description |
|------|--------------|--------|-------------|
| ~~Complete routes.ts decomposition~~ | ~~Stability tests~~ | ~~High~~ | ~~Register remaining routers~~ ✅ DONE Dec 2025 |
| Storage layer domain split | Routes complete | High | 🟡 In progress — Phase 1-2 complete (43 methods extracted) |
| Workflow engine integration tests | Stability tests | High | Full workflow execution path validation |

### P2 — Foundation Improvements

| Item | Dependencies | Tokens | Description |
|------|--------------|--------|-------------|
| SuperAdmin observability dashboard | Maintenance mode | High | Real-time metrics, health checks UI |
| AI-assisted task recommendations | Intelligence layer | High | Proactive task suggestions based on patterns |
| Advanced SLA reporting | SLA tests | High | Breach analytics, trend visualization |

### P3 — Feature Expansion

| Item | Dependencies | Tokens | Description |
|------|--------------|--------|-------------|
| Cross-client pattern learning | Knowledge layer | High | Agency-wide insights with governance |
| Workflow version comparison UI | Workflow builder | High | Visual diff between workflow versions |
| Mobile-responsive staff portal | Staff router | High | Task management on mobile devices |

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture, diagrams |
| [TECHNICAL_BRIEF.md](./TECHNICAL_BRIEF.md) | Implementation patterns |
| [docs/maintenance-matrix.md](./docs/maintenance-matrix.md) | Module health scores |
| [docs/frontend-backend-map.md](./docs/frontend-backend-map.md) | API integration map |

---

*Last Updated: December 2025*
