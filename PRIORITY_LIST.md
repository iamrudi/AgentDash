# Agency Client Portal - Priority Roadmap

## Executive Summary

This document outlines the 15-phase roadmap for evolving the Agency Client Portal from a task management platform into a **full Workflow Engine** capable of deterministic automation, AI orchestration, and multi-agent operations.

Each priority is ordered by dependency—completing earlier phases unlocks capabilities required by later phases.

---

## Priority 1: Workflow Engine (Core Orchestration)

**Status:** ✅ COMPLETED (December 2024)  
**Complexity:** High  
**Dependencies:** None (foundational)  
**Estimated Duration:** 3-4 weeks

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

**Status:** ✅ COMPLETED (December 2024)  
**Complexity:** High  
**Dependencies:** Priority 1  
**Estimated Duration:** 2-3 weeks

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

**Status:** ✅ COMPLETED (December 2024)  
**Complexity:** Medium  
**Dependencies:** Priority 1, 2  
**Estimated Duration:** 2 weeks

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

**Status:** ✅ COMPLETED (December 2024)  
**Complexity:** High  
**Dependencies:** Priority 1  
**Estimated Duration:** 2-3 weeks

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

**Status:** ✅ COMPLETED (December 2024)  
**Complexity:** Medium  
**Dependencies:** Priority 1, 4  
**Estimated Duration:** 2 weeks

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

**Status:** ✅ COMPLETED (December 2024)  
**Complexity:** High  
**Dependencies:** None (can parallel with 1-5)  
**Estimated Duration:** 3-4 weeks

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

**Status:** ✅ COMPLETED (December 2024)  
**Complexity:** Medium  
**Dependencies:** Priority 1, 3  
**Estimated Duration:** 2 weeks

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

**Status:** ✅ COMPLETED (December 2024)  
**Complexity:** Very High  
**Dependencies:** Priority 1, 4, 6  
**Estimated Duration:** 4-6 weeks

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

**Status:** ✅ COMPLETED (December 2024)  
**Complexity:** Medium  
**Dependencies:** Priority 2, 3  
**Estimated Duration:** 2 weeks

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

**Status:** ✅ COMPLETED (December 2024)  
**Complexity:** Medium  
**Dependencies:** Priority 2  
**Estimated Duration:** 2 weeks

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

**Status:** ✅ COMPLETED (December 2024)  
**Complexity:** Medium  
**Dependencies:** Priority 1  
**Estimated Duration:** 1-2 weeks

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

**Status:** 🔴 Not Started  
**Complexity:** Medium  
**Dependencies:** Priority 1, 11  
**Estimated Duration:** 2-3 weeks

### Description
Create reusable templates for projects, task lists, workflows, and AI prompts.

### Deliverables
- Template schema with variables
- Project templates (structure + default tasks)
- Task list templates
- Workflow templates
- Prompt templates with variable injection
- Template versioning

### Template Schema
```typescript
interface Template {
  id: string;
  type: 'project' | 'task_list' | 'workflow' | 'prompt';
  name: string;
  version: number;
  variables: TemplateVariable[];
  content: jsonb;
  agencyId: string;        // Or null for system templates
  isSystem: boolean;
}

interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'date' | 'select';
  required: boolean;
  default?: any;
  options?: string[];      // For select type
}
```

### Success Criteria
- Templates instantiate with variable substitution
- Version history preserved
- Agency-specific and system templates supported

---

## Priority 13: Real-Time Layer Improvements

**Status:** 🟡 Partial (SSE for chat exists)  
**Complexity:** Medium  
**Dependencies:** None (can parallel)  
**Estimated Duration:** 2-3 weeks

### Description
Migrate messaging and presence from polling to WebSocket/SSE for true real-time updates.

### Deliverables
- WebSocket server integration
- Connection management with heartbeat
- Channel-based subscriptions
- Presence indicators (online/away/offline)
- Reconnection with message replay
- Fallback to SSE for restricted environments

### Architecture
```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│   Client    │────▶│  WebSocket      │────▶│   Redis     │
│   Browser   │◀────│  Server         │◀────│   Pub/Sub   │
└─────────────┘     └─────────────────┘     └─────────────┘
                            │
                            ▼
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │   (persistence) │
                    └─────────────────┘
```

### Success Criteria
- Messages delivered in < 100ms
- Presence updates within 5 seconds
- Graceful degradation to polling if WS fails

---

## Priority 14: SuperAdmin Governance Enhancements

**Status:** 🟡 Partial (basic SuperAdmin exists)  
**Complexity:** Medium  
**Dependencies:** Priority 4, 8  
**Estimated Duration:** 2-3 weeks

### Description
Add comprehensive governance controls for AI quotas, token caps, and integration health monitoring.

### Deliverables
- Per-agency AI token quotas
- Usage tracking and billing
- Integration health dashboard
- Token rotation management
- Cost allocation reporting
- Rate limit management

### Governance Schema
```typescript
interface AgencyQuotas {
  agencyId: string;
  aiTokenLimit: number;         // Monthly
  aiTokenUsed: number;
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

### Success Criteria
- AI usage blocked at quota limit
- Proactive alerts before token expiry
- Integration failures visible within 5 minutes

---

## Priority 15: Workflow Builder UI

**Status:** 🔴 Not Started  
**Complexity:** Very High  
**Dependencies:** Priority 1, 3, 12  
**Estimated Duration:** 4-6 weeks

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

## Dependency Graph

```
Priority 1 (Workflow Engine) ✅ COMPLETED
    │
    ├──▶ Priority 2 (Rule Engine) ✅ COMPLETED
    │        │
    │        └──▶ Priority 3 (Signal Processing) ← NEXT
    │                 │
    │                 └──▶ Priority 7 (SLA Engine)
    │                 └──▶ Priority 9 (CRM Triggers)
    │                 └──▶ Priority 10 (Analytics Ingestion)
    │
    ├──▶ Priority 4 (AI Execution Layer)
    │        │
    │        └──▶ Priority 5 (Lineage & Logging)
    │        └──▶ Priority 8 (Multi-Agent)
    │        └──▶ Priority 14 (SuperAdmin Governance)
    │
    ├──▶ Priority 11 (Task System Optimization)
    │        │
    │        └──▶ Priority 12 (Template System)
    │                 │
    │                 └──▶ Priority 15 (Workflow Builder UI)
    │
    └──▶ Priority 6 (Vector Stores) [parallel]
    └──▶ Priority 13 (Real-Time Layer) [parallel]
```

---

## Implementation Timeline (Estimated)

| Phase | Priorities | Duration | Team Size |
|-------|------------|----------|-----------|
| Foundation | 1, 2, 4 | 6-8 weeks | 2 engineers |
| Rules & Signals | 3, 10, 9 | 4-6 weeks | 2 engineers |
| AI & Lineage | 5, 6, 8 | 6-8 weeks | 2-3 engineers |
| Automation | 7, 11, 12 | 4-6 weeks | 2 engineers |
| Polish | 13, 14, 15 | 6-8 weeks | 2-3 engineers |

**Total Estimated Duration:** 26-36 weeks

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
| Priority 1: Workflow Engine | ✅ Complete | December 2024 |
| Priority 2: Rule Engine | ✅ Complete | December 2024 |
| Priority 3: Signal Processing | 🔴 Not Started | - |
| Priority 4-15 | 🔴 Not Started | - |

---

*Last Updated: December 2024*
