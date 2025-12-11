# Agency Client Portal - Priority Roadmap

## Executive Summary

This document outlines the 15-phase roadmap for evolving the Agency Client Portal from a task management platform into a **full Workflow Engine** capable of deterministic automation, AI orchestration, and multi-agent operations.

Each priority is ordered by dependency—completing earlier phases unlocks capabilities required by later phases.

---

## Priority 1: Workflow Engine (Core Orchestration)

**Status:** 🔴 Not Started  
**Complexity:** High  
**Dependencies:** None (foundational)  
**Estimated Duration:** 3-4 weeks

### Description
Build the deterministic workflow orchestration core that processes signals, executes rules, invokes AI, and produces atomic outputs (projects, tasks, invoices).

### Deliverables
- `WorkflowEngine` class with step-based execution
- Workflow definition schema (YAML/JSON)
- Step types: `signal`, `rule`, `ai`, `action`, `branch`, `parallel`
- Transaction wrapper ensuring atomic commits
- Execution context with rollback capabilities
- Workflow status tracking: `pending` → `running` → `completed` | `failed`

### Technical Approach
```typescript
interface Workflow {
  id: string;
  name: string;
  trigger: TriggerConfig;
  steps: WorkflowStep[];
  timeout: number;
  retryPolicy: RetryPolicy;
}

interface WorkflowStep {
  id: string;
  type: 'signal' | 'rule' | 'ai' | 'action' | 'branch' | 'parallel';
  config: StepConfig;
  onError: 'fail' | 'skip' | 'retry';
}
```

### Success Criteria
- Workflows execute deterministically with identical inputs → identical outputs
- All multi-table operations atomic (no partial state)
- Failed workflows can be inspected and replayed

---

## Priority 2: Unified Signal Model

**Status:** 🔴 Not Started  
**Complexity:** High  
**Dependencies:** Priority 1  
**Estimated Duration:** 2-3 weeks

### Description
Create a normalized signal format that ingests events from GA4, GSC, HubSpot, LinkedIn, and internal application events into a single processing pipeline.

### Deliverables
- `Signal` schema with unified structure
- Signal ingestion adapters per source
- Signal queue (in-memory or Redis-backed)
- Signal routing to appropriate workflows
- Signal deduplication by content hash

### Signal Schema
```typescript
interface Signal {
  id: string;
  source: 'ga4' | 'gsc' | 'hubspot' | 'linkedin' | 'internal';
  type: string;                    // e.g., 'ranking_drop', 'lead_created'
  payload: Record<string, any>;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  clientId: string;
  agencyId: string;
  timestamp: Date;
  hash: string;                    // For deduplication
}
```

### Success Criteria
- All external data sources normalize to Signal format
- Signals trigger workflows within 5 seconds of receipt
- Duplicate signals rejected by hash

---

## Priority 3: Rules Engine (Pre-AI Logic)

**Status:** 🔴 Not Started  
**Complexity:** Medium  
**Dependencies:** Priority 2  
**Estimated Duration:** 2 weeks

### Description
Implement deterministic rule evaluation that runs before AI invocation, filtering signals and making decisions that don't require AI processing.

### Deliverables
- Rule definition schema
- Condition evaluator (AND/OR/NOT logic)
- Action dispatcher
- Rule versioning and audit trail
- Rule testing sandbox

### Rule Schema
```typescript
interface Rule {
  id: string;
  name: string;
  version: number;
  conditions: Condition[];
  conditionLogic: 'all' | 'any';
  actions: RuleAction[];
  priority: number;
  enabled: boolean;
}

interface Condition {
  field: string;           // JSONPath into signal payload
  operator: 'eq' | 'gt' | 'lt' | 'contains' | 'regex';
  value: any;
}
```

### Example Rules
| Rule | Condition | Action |
|------|-----------|--------|
| Ranking Drop Alert | GSC position drops > 10 spots | Create high-priority task |
| Lead Qualification | HubSpot lead score > 80 | Assign to senior account manager |
| Inactivity Warning | No client login > 30 days | Send engagement email |
| PPC Budget Alert | Daily spend > 120% of target | Pause campaign + notify |

### Success Criteria
- Rules execute in < 10ms per evaluation
- Rule changes versioned and auditable
- Rules can be tested with sample signals before activation

---

## Priority 4: Hardened AI Execution Layer

**Status:** 🟡 Partial (providers exist)  
**Complexity:** High  
**Dependencies:** Priority 1  
**Estimated Duration:** 2-3 weeks

### Description
Strengthen the AI invocation layer with schema validation, retry logic, idempotency guarantees, and output hashing for reproducibility.

### Deliverables
- AI response schema validation (Zod)
- Exponential backoff retry with jitter
- Idempotent writes via content hashing
- Request/response logging with lineage
- Provider health monitoring
- Token usage tracking per agency

### Technical Approach
```typescript
interface AIExecutionContext {
  requestId: string;
  workflowId: string;
  stepId: string;
  inputHash: string;
  retryCount: number;
  maxRetries: number;
}

async function executeAI(
  provider: AIProvider,
  prompt: string,
  schema: z.ZodSchema,
  context: AIExecutionContext
): Promise<ValidatedResponse> {
  // 1. Check cache by inputHash
  // 2. Execute with retry
  // 3. Validate response against schema
  // 4. Store with outputHash
  // 5. Log lineage
}
```

### Success Criteria
- Invalid AI responses rejected with clear errors
- Identical inputs return cached responses (idempotent)
- All AI calls traceable to originating workflow/signal

---

## Priority 5: Workflow Lineage & Event Logging

**Status:** 🔴 Not Started  
**Complexity:** Medium  
**Dependencies:** Priority 1, 4  
**Estimated Duration:** 2 weeks

### Description
Implement comprehensive event logging that captures every workflow execution, enabling full replay and debugging.

### Deliverables
- `workflow_executions` table
- `workflow_events` table (step-by-step log)
- Execution replay capability
- Lineage query API
- Retention policies

### Schema
```typescript
// workflow_executions
{
  id: string;
  workflowId: string;
  triggerId: string;       // Signal that triggered
  status: 'running' | 'completed' | 'failed';
  startedAt: timestamp;
  completedAt: timestamp;
  error: text;
  inputHash: string;
  outputHash: string;
}

// workflow_events
{
  id: string;
  executionId: string;
  stepId: string;
  type: 'started' | 'completed' | 'failed' | 'skipped';
  input: jsonb;
  output: jsonb;
  durationMs: number;
  timestamp: timestamp;
}
```

### Success Criteria
- Any workflow execution fully reconstructable from events
- Lineage query: "What created this task?" → full chain
- 90-day retention with archival

---

## Priority 6: Tenant-Isolated Vector Stores

**Status:** 🔴 Not Started  
**Complexity:** High  
**Dependencies:** None (can parallel with 1-5)  
**Estimated Duration:** 3-4 weeks

### Description
Create per-agency vector stores for SOPs, brand assets, analytics embeddings, and knowledge bases for "Chat with Your Data" features.

### Deliverables
- Vector storage schema with agency isolation
- Embedding pipeline (OpenAI/Gemini embeddings)
- Semantic search API
- Document ingestion (PDF, Markdown, HTML)
- Index management (rebuild, prune)

### Technical Approach
```typescript
// embeddings table
{
  id: string;
  agencyId: string;        // Tenant isolation
  documentId: string;
  chunkIndex: number;
  content: text;
  embedding: vector(1536); // OpenAI dimension
  metadata: jsonb;
  createdAt: timestamp;
}

// RLS Policy
CREATE POLICY "agency_embeddings" ON embeddings
  FOR ALL USING (agency_id = current_agency_id());
```

### Success Criteria
- Embeddings strictly isolated by agency
- Semantic search returns relevant chunks in < 200ms
- Documents re-indexed on update

---

## Priority 7: SLA & Escalation Engine

**Status:** 🔴 Not Started  
**Complexity:** Medium  
**Dependencies:** Priority 1, 3  
**Estimated Duration:** 2 weeks

### Description
Add deadline monitoring, SLA breach detection, and automatic escalation to fallback owners.

### Deliverables
- SLA definition per project/client
- Deadline monitoring cron
- Escalation chain configuration
- Breach notifications (email, in-app)
- SLA reporting dashboard

### SLA Schema
```typescript
interface SLA {
  id: string;
  clientId: string;
  responseTimeHours: number;    // First response
  resolutionTimeHours: number;  // Full resolution
  escalationChain: string[];    // Profile IDs in order
  breachActions: BreachAction[];
}

interface BreachAction {
  type: 'notify' | 'reassign' | 'escalate' | 'pause_billing';
  config: Record<string, any>;
}
```

### Success Criteria
- SLA breaches detected within 1 minute of deadline
- Escalations automatically reassign tasks
- SLA metrics visible in reporting

---

## Priority 8: Multi-Agent Architecture

**Status:** 🔴 Not Started  
**Complexity:** Very High  
**Dependencies:** Priority 1, 4, 6  
**Estimated Duration:** 4-6 weeks

### Description
Implement specialized AI agents for different domains (SEO, PPC, CRM, Reporting) that can be orchestrated by the workflow engine.

### Deliverables
- Agent interface definition
- SEO Agent (rankings, content, technical)
- PPC Agent (budget, bids, campaigns)
- CRM Agent (lead scoring, lifecycle)
- Reporting Agent (summaries, insights)
- Agent routing by signal/task type
- Agent collaboration protocol

### Agent Interface
```typescript
interface Agent {
  id: string;
  domain: 'seo' | 'ppc' | 'crm' | 'reporting';
  capabilities: string[];
  
  analyze(context: AgentContext): Promise<Analysis>;
  recommend(context: AgentContext): Promise<Recommendation[]>;
  execute(action: AgentAction): Promise<ExecutionResult>;
}
```

### Success Criteria
- Agents produce domain-specific recommendations
- Workflow engine routes to correct agent by type
- Agent outputs validated against domain schemas

---

## Priority 9: Expanded CRM Integration Triggers

**Status:** 🟡 Partial (HubSpot sync exists)  
**Complexity:** Medium  
**Dependencies:** Priority 2, 3  
**Estimated Duration:** 2 weeks

### Description
Add lifecycle-based triggers from CRM events that feed into the workflow engine.

### Deliverables
- Deal stage change → Signal
- Contact property change → Signal
- Company association → Signal
- Meeting scheduled → Signal
- Form submission → Signal
- Bi-directional sync improvements

### Trigger Examples
| CRM Event | Signal Type | Workflow |
|-----------|-------------|----------|
| Deal moved to "Proposal" | `deal_stage_changed` | Generate proposal tasks |
| Contact marked "Champion" | `contact_property_changed` | Increase engagement |
| New company created | `company_created` | Client onboarding workflow |
| Meeting scheduled | `meeting_scheduled` | Prep checklist |

### Success Criteria
- CRM events trigger workflows within 30 seconds
- All major lifecycle events covered
- No duplicate signals from webhook retries

---

## Priority 10: Enhanced Analytics Ingestion

**Status:** 🟡 Partial (GA4/GSC sync exists)  
**Complexity:** Medium  
**Dependencies:** Priority 2  
**Estimated Duration:** 2 weeks

### Description
Add anomaly detection to analytics pipelines that automatically generates signals for significant changes.

### Deliverables
- Statistical anomaly detection (Z-score, IQR)
- Trend analysis (week-over-week, month-over-month)
- Threshold configuration per client
- Anomaly → Signal conversion
- False positive filtering

### Anomaly Types
| Metric | Detection Method | Threshold |
|--------|------------------|-----------|
| Traffic drop | Z-score | > 2.5 std dev |
| Ranking loss | Absolute change | > 10 positions |
| Conversion rate | Percentage change | > 25% decline |
| Bounce rate spike | Z-score | > 2 std dev |

### Success Criteria
- Anomalies detected within 1 hour of data availability
- < 10% false positive rate
- Configurable sensitivity per client

---

## Priority 11: Optimized Task System for Workflow Output

**Status:** 🟡 Partial (task CRUD exists)  
**Complexity:** Medium  
**Dependencies:** Priority 1  
**Estimated Duration:** 1-2 weeks

### Description
Make task/project creation idempotent so workflows can safely retry without creating duplicates.

### Deliverables
- Idempotency key on task creation
- Upsert semantics for workflow-created tasks
- Batch task creation API
- Task deduplication by content hash
- Workflow-to-task lineage

### Technical Approach
```typescript
// Idempotent task creation
async function createTaskIdempotent(
  task: InsertTask,
  idempotencyKey: string
): Promise<Task> {
  const existing = await db.query.tasks.findFirst({
    where: eq(tasks.idempotencyKey, idempotencyKey)
  });
  
  if (existing) return existing;
  
  return db.insert(tasks).values({
    ...task,
    idempotencyKey
  }).returning();
}
```

### Success Criteria
- Workflow retry creates no duplicates
- Batch creation completes in single transaction
- All workflow-created tasks traceable to source

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
Priority 1 (Workflow Engine)
    │
    ├──▶ Priority 2 (Signal Model)
    │        │
    │        └──▶ Priority 3 (Rules Engine)
    │        │        │
    │        │        └──▶ Priority 7 (SLA Engine)
    │        │        └──▶ Priority 9 (CRM Triggers)
    │        │
    │        └──▶ Priority 10 (Analytics Ingestion)
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

*Last Updated: December 2024*
