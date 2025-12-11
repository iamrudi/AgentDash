# Agency Client Portal - Technical Brief

## Project Overview

A multi-tenant agency management platform built with React, Express.js, and PostgreSQL, featuring ClickUp-style project management, AI-powered recommendations, and comprehensive time tracking.

---

## Technology Stack

### Frontend
- **React 18** with functional components and hooks
- **Wouter** for client-side routing
- **TanStack Query v5** for server state management
- **Tailwind CSS** with Shadcn/UI components
- **React Hook Form** with Zod validation
- **Lucide React** for icons

### Backend
- **Express.js** with TypeScript
- **Drizzle ORM** for database operations
- **Zod** for request validation
- **Passport.js** for session management
- **node-cron** for scheduled tasks
- **Puppeteer** for PDF generation

### Database
- **PostgreSQL** (Supabase-hosted)
- **Row-Level Security (RLS)** for tenant isolation
- **40 RLS policies** across 14 tables

### External Services
- **Supabase Auth** - Authentication and user management
- **Google Gemini / OpenAI** - AI recommendations
- **Google Analytics 4** - Website metrics
- **Google Search Console** - Search performance
- **HubSpot** - CRM integration
- **LinkedIn** - Social metrics

---

## Project Structure

```
├── client/
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── ui/             # Shadcn/UI primitives
│   │   │   ├── agency-sidebar.tsx
│   │   │   ├── client-sidebar.tsx
│   │   │   └── app-sidebar.tsx (Staff)
│   │   ├── pages/
│   │   │   ├── agency/         # Agency admin portal pages
│   │   │   ├── client/         # Client portal pages
│   │   │   ├── staff/          # Staff portal pages
│   │   │   └── superadmin/     # SuperAdmin portal pages
│   │   ├── hooks/              # Custom React hooks
│   │   ├── lib/                # Utilities (queryClient, utils)
│   │   └── App.tsx             # Main router
│   └── index.html
├── server/
│   ├── routes.ts               # API route definitions
│   ├── storage.ts              # Database operations (DbStorage)
│   ├── auth.ts                 # Authentication middleware
│   ├── index.ts                # Server entry point
│   ├── vite.ts                 # Vite dev server integration
│   ├── ai/
│   │   ├── openai-provider.ts  # OpenAI integration
│   │   ├── gemini-provider.ts  # Gemini integration
│   │   └── hardened-executor.ts # Hardened AI execution layer
│   ├── agents/
│   │   ├── base-agent.ts       # BaseAgent abstract class
│   │   ├── domain-agents.ts    # SEO, PPC, CRM, Reporting agents
│   │   ├── orchestrator.ts     # AgentOrchestrator routing
│   │   ├── agent-routes.ts     # Agent REST API
│   │   └── ai-provider-adapter.ts # AI provider abstraction
│   ├── sla/
│   │   ├── sla-service.ts      # SLA breach detection
│   │   ├── sla-cron.ts         # Automated monitoring
│   │   └── sla-routes.ts       # SLA REST API
│   └── workflow/
│       ├── engine.ts           # WorkflowEngine class
│       ├── rule-engine.ts      # RuleEngine with 16 operators
│       ├── signal-adapters.ts  # Signal ingestion adapters
│       ├── signal-normalizer.ts # Signal normalization
│       └── signal-router.ts    # Signal routing
├── shared/
│   └── schema.ts               # Drizzle schema + Zod types
└── uploads/
    └── logos/                  # Agency branding assets
```

---

## Database Schema

### Core Tables

```typescript
// Agency (tenant root)
agencies: {
  id: uuid PRIMARY KEY,
  name: varchar,
  primaryColor: varchar,
  logoUrl: varchar,
  aiProvider: varchar,        // 'gemini' | 'openai'
  createdAt: timestamp
}

// User Profile (linked to Supabase Auth)
profiles: {
  id: uuid PRIMARY KEY,       // matches Supabase auth.users.id
  email: varchar UNIQUE,
  fullName: varchar,
  role: varchar,              // 'Client' | 'Staff' | 'Admin'
  isSuperAdmin: boolean,
  agencyId: uuid REFERENCES agencies,
  clientId: uuid REFERENCES clients,
  skills: text[],
  createdAt: timestamp
}

// Client (belongs to agency)
clients: {
  id: uuid PRIMARY KEY,
  agencyId: uuid REFERENCES agencies,
  name: varchar,
  email: varchar,
  accountManagerId: uuid REFERENCES profiles,
  createdAt: timestamp
}

// Project (belongs to client)
projects: {
  id: uuid PRIMARY KEY,
  clientId: uuid REFERENCES clients,
  name: varchar,
  description: text,
  status: varchar,
  createdAt: timestamp
}

// Task List (belongs to project)
taskLists: {
  id: uuid PRIMARY KEY,
  projectId: uuid REFERENCES projects,
  agencyId: uuid REFERENCES agencies,  // For RLS
  name: varchar,
  position: integer,
  createdAt: timestamp
}

// Task (belongs to task list)
tasks: {
  id: uuid PRIMARY KEY,
  listId: uuid REFERENCES taskLists,
  projectId: uuid REFERENCES projects,
  parentTaskId: uuid REFERENCES tasks,  // For subtasks
  description: varchar,
  status: varchar,            // 'To Do' | 'In Progress' | 'Completed' | 'Blocked'
  priority: varchar,          // 'Low' | 'Medium' | 'High' | 'Urgent'
  startDate: date,
  dueDate: date,
  timeEstimate: numeric,      // Hours (0.5 increments)
  timeTracked: numeric,       // Hours (0.5 increments)
  createdAt: timestamp
}

// Staff Assignment (many-to-many)
staffAssignments: {
  id: uuid PRIMARY KEY,
  taskId: uuid REFERENCES tasks,
  staffProfileId: uuid REFERENCES profiles,
  createdAt: timestamp
}
```

### Type Generation

```typescript
// shared/schema.ts pattern
import { createInsertSchema } from 'drizzle-zod';

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;
```

---

## API Patterns

### Route Structure

```
/api/auth/*           - Authentication (login, logout, session)
/api/user/*           - Current user operations
/api/client/*         - Client portal endpoints
/api/staff/*          - Staff portal endpoints
/api/agency/*         - Agency admin endpoints
/api/superadmin/*     - SuperAdmin endpoints
```

### Middleware Chain

```typescript
// Standard protected route
app.get('/api/agency/tasks', 
  requireAuth,           // Validates session
  requireRole(['Admin']), // Checks role
  async (req, res) => { ... }
);

// SuperAdmin route
app.get('/api/superadmin/users',
  requireAuth,
  requireSuperAdmin,     // Checks isSuperAdmin flag
  async (req, res) => { ... }
);
```

### Request Validation

```typescript
// Always validate with Zod
const result = insertTaskSchema.safeParse(req.body);
if (!result.success) {
  return res.status(400).json({ 
    message: fromZodError(result.error).message 
  });
}
const task = await storage.createTask(result.data);
```

### Response Patterns

```typescript
// Success
res.json(data);                           // 200 OK
res.status(201).json(created);            // 201 Created

// Errors
res.status(400).json({ message: '...' }); // Bad Request
res.status(401).json({ message: '...' }); // Unauthorized
res.status(403).json({ message: '...' }); // Forbidden
res.status(404).json({ message: '...' }); // Not Found
res.status(500).json({ message: '...' }); // Server Error
```

---

## Frontend Patterns

### Data Fetching

```typescript
// Query pattern (TanStack Query v5)
const { data: tasks, isLoading } = useQuery<Task[]>({
  queryKey: ['/api/agency/tasks'],
  // queryFn not needed - default fetcher handles it
});

// Hierarchical keys for cache invalidation
const { data: task } = useQuery<Task>({
  queryKey: ['/api/agency/tasks', taskId],  // Array form
});

// Mutation pattern
const mutation = useMutation({
  mutationFn: async (data: InsertTask) => {
    const res = await apiRequest('POST', '/api/agency/tasks', data);
    return res.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/agency/tasks'] });
  }
});
```

### Form Handling

```typescript
// React Hook Form + Zod
const form = useForm<InsertTask>({
  resolver: zodResolver(insertTaskSchema.extend({
    description: z.string().min(1, 'Required')
  })),
  defaultValues: {
    description: '',
    status: 'To Do',
    priority: 'Medium'
  }
});
```

### Component Conventions

```typescript
// Always add data-testid for interactive elements
<Button 
  data-testid="button-create-task"
  onClick={handleCreate}
>
  Create Task
</Button>

// Pattern: {action}-{target} or {type}-{content}
// Examples: button-submit, input-email, card-project-${id}
```

---

## Authentication Flow

### Session-Based JWT

```
1. User submits credentials to Supabase Auth
2. Supabase validates and returns JWT
3. Frontend stores token in memory/localStorage
4. Each API request includes Authorization header
5. Backend validates JWT via Supabase client
6. Profile loaded from database for RBAC checks
```

### Role Hierarchy

```
SuperAdmin → Can access everything
    ↓
Admin (Agency) → Full agency access
    ↓
Staff → Assigned tasks only
    ↓
Client → Own client data only
```

---

## Tenant Isolation

### Three-Layer Defense

```typescript
// Layer 1: Application Middleware
app.use('/api/agency/*', requireAuth, requireRole(['Admin']));

// Layer 2: Storage Method
async getClients(agencyId: string) {
  return db.select().from(clients)
    .where(eq(clients.agencyId, agencyId));  // Explicit filter
}

// Layer 3: Database RLS
CREATE POLICY "agency_isolation" ON clients
  FOR ALL
  USING (agency_id = current_setting('app.current_agency_id'));
```

### SuperAdmin Bypass

```typescript
// SuperAdmin can access all agencies
if (req.user?.isSuperAdmin) {
  // No agency filter applied
  return storage.getAllTasks();
} else {
  // Regular users filtered by their agency
  return storage.getAllTasks(req.user.agencyId);
}
```

---

## Numeric Value Handling

### PostgreSQL Returns Strings

```typescript
// Drizzle numeric columns return strings
// Always parse on frontend:
function parseNumeric(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
}

// Usage
const tracked = parseNumeric(task.timeTracked);  // Not task.timeTracked directly
```

### Time Tracking Validation

```typescript
// Backend: 0.5 hour increments
if (timeTracked !== undefined) {
  const remainder = timeTracked % 0.5;
  if (remainder !== 0) {
    return res.status(400).json({ 
      message: 'Time must be in 0.5 hour increments' 
    });
  }
}
```

---

## Date Handling

### Timezone Safety

```typescript
// Always use YYYY-MM-DD format for date-only fields
const formattedDate = format(date, 'yyyy-MM-dd');

// Parse safely
const parsed = parseISO(dateString);
if (!isValid(parsed)) {
  return null;
}
```

---

## AI Provider Architecture

### Pluggable Interface

```typescript
interface AIProvider {
  generateRecommendation(context: ClientContext): Promise<Recommendation>;
  generateText(prompt: string): Promise<string>;
}

// Implementation selection
function getAIProvider(agencySettings: AgencySettings): AIProvider {
  switch (agencySettings.aiProvider) {
    case 'openai': return new OpenAIProvider();
    case 'gemini': return new GeminiProvider();
    default: return new GeminiProvider();
  }
}
```

### Response Normalization

```typescript
// Both providers return identical structure
interface Recommendation {
  title: string;
  observation: string;
  proposedAction: string;
  actionTasks: string[];
  estimatedCost?: number;
  priority: 'Low' | 'Medium' | 'High';
}
```

---

## File Uploads

### Logo Storage

```typescript
// Multer configuration
const storage = multer.diskStorage({
  destination: 'uploads/logos/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${agencyId}-${Date.now()}${ext}`);
  }
});

// Static serving
app.use('/uploads', express.static('uploads'));
```

---

## Cron Jobs

### Scheduled Tasks

```typescript
// Invoice automation (daily at 9 AM)
cron.schedule('0 9 * * *', async () => {
  await generateRecurringInvoices();
});

// Orphaned user cleanup (nightly at 2 AM)
cron.schedule('0 2 * * *', async () => {
  await cleanupOrphanedUsers();
});
```

---

## Error Handling

### API Error Pattern

```typescript
try {
  const result = await storage.createTask(data);
  res.status(201).json(result);
} catch (error: any) {
  console.error('Task creation failed:', error);
  res.status(500).json({ 
    message: error.message || 'Internal server error' 
  });
}
```

### Frontend Error Display

```typescript
const { toast } = useToast();

mutation.mutate(data, {
  onError: (error) => {
    toast({
      variant: 'destructive',
      title: 'Error',
      description: error.message
    });
  }
});
```

---

## Testing Conventions

### Data Test IDs

```
Interactive elements: {action}-{target}
  - button-submit, button-create-task, input-email, link-profile

Display elements: {type}-{content}
  - text-username, card-project-${id}, heading-hours-report

Dynamic elements: {type}-{description}-{id}
  - row-task-${taskId}, card-client-${clientId}
```

### Playwright Testing

```typescript
// Always generate unique values for test data
const uniqueTitle = `Test Task ${nanoid(6)}`;

// Navigate explicitly
await page.goto('/agency/tasks');

// Use data-testid selectors
await page.click('[data-testid="button-create-task"]');
```

---

## Environment Variables

### Required Secrets

```
DATABASE_URL          - PostgreSQL connection string
SESSION_SECRET        - Express session encryption
SUPABASE_URL          - Supabase project URL
SUPABASE_ANON_KEY     - Supabase anonymous key
SUPABASE_SERVICE_KEY  - Supabase service role key
GEMINI_API_KEY        - Google Gemini API key
OPENAI_API_KEY        - OpenAI API key
ENCRYPTION_KEY        - AES-256 encryption key
```

### Frontend Access

```typescript
// Must be prefixed with VITE_
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
```

---

## Common Gotchas

1. **apiRequest() returns Response** - Must call `.json()` to parse
2. **Numeric columns return strings** - Use `parseNumeric()` helper
3. **Date timezone issues** - Always use `YYYY-MM-DD` format
4. **Projects lack agencyId** - Join through clients table
5. **RLS bypass for SuperAdmin** - Application layer handles this
6. **TanStack Query v5** - Object form only: `useQuery({ queryKey: [...] })`
7. **Don't import React** - Vite JSX transformer handles it
8. **SelectItem requires value** - Always provide value prop

---

## Workflow Engine

### Architecture

The workflow engine provides deterministic automation with atomic transactions.

```typescript
// server/workflow/engine.ts
class WorkflowEngine {
  constructor(storage: IStorage) { ... }
  
  // Execute workflow with idempotency
  async executeWorkflow(
    workflowId: string, 
    input: WorkflowInput
  ): Promise<WorkflowExecution>
  
  // Check execution status
  async getExecutionStatus(executionId: string): Promise<WorkflowExecution>
}
```

### Step Handlers

```typescript
// All steps execute within transaction context
type StepHandler = (
  step: WorkflowStep, 
  context: ExecutionContext
) => Promise<StepResult>;

// Step types: signal, rule, action, transform, notification, branch
```

### Idempotency

```typescript
// Input hashing prevents duplicate executions
const inputHash = createHash('sha256')
  .update(JSON.stringify(input))
  .digest('hex');

// Check for existing execution with same hash
const existing = await db.query.workflowExecutions.findFirst({
  where: and(
    eq(workflowExecutions.workflowId, workflowId),
    eq(workflowExecutions.inputHash, inputHash)
  )
});
```

---

## Rule Engine

### Versioned Rules

```typescript
// Rules have versions: draft → published → deprecated
interface WorkflowRule {
  id: string;
  agencyId: string;
  name: string;
  category: 'threshold' | 'anomaly' | 'lifecycle' | 'integration' | 'custom';
  defaultVersionId?: string;
}

// Versions contain conditions and actions
interface WorkflowRuleVersion {
  id: string;
  ruleId: string;
  version: number;
  status: 'draft' | 'published' | 'deprecated';
  conditionLogic: 'all' | 'any';
}
```

### Rule Evaluation

```typescript
// server/workflow/rule-engine.ts
class RuleEngine {
  async evaluateRule(
    rule: WorkflowRule, 
    context: RuleEvaluationContext
  ): Promise<RuleEvaluationResult>
  
  // 16 operators including:
  // - Standard: eq, neq, gt, gte, lt, lte
  // - String: contains, starts_with, ends_with
  // - Advanced: percent_change_gt, anomaly_zscore_gt
  // - Lifecycle: inactivity_days_gt, changed_to, changed_from
}
```

### Workflow Integration

```typescript
// Rule steps can use inline conditions or reference versioned rules
const ruleStep: WorkflowStep = {
  id: 'step-1',
  type: 'rule',
  config: {
    ruleId: 'rule-uuid',  // Reference versioned rule
    // OR inline conditions:
    conditions: [{ field: 'value', operator: 'gt', value: 100 }]
  }
};
```

---

## Development Workflow

```bash
# Start development server
npm run dev

# Database operations
npm run db:push        # Sync schema to database
npm run db:push --force # Force sync (use cautiously)
npm run db:studio      # Open Drizzle Studio

# Type checking
npx tsc --noEmit
```

---

## Important Files Reference

| File | Purpose |
|------|---------|
| `server/workflow/engine.ts` | WorkflowEngine class with step execution |
| `server/workflow/rule-engine.ts` | RuleEngine with 16 operators |
| `shared/schema.ts` | All database schemas including workflow tables |
| `server/storage.ts` | Database operations including workflow/rule CRUD |
| `server/routes.ts` | All API endpoints including workflow/rule endpoints |
| `scripts/test-workflow.ts` | Workflow regression test suite |

---

## Multi-Agent Architecture

### Agent System Overview

The multi-agent system enables specialized AI agents for different domains to be orchestrated by the workflow engine.

```typescript
// server/agents/base-agent.ts
abstract class BaseAgent {
  abstract readonly domain: AgentDomain;      // 'seo' | 'ppc' | 'crm' | 'reporting'
  abstract readonly capabilities: string[];
  
  // Core lifecycle methods
  async analyze(context: AgentContext): Promise<AgentResult>;
  async recommend(context: AgentContext): Promise<AgentResult>;
  async execute(action: AgentAction): Promise<AgentResult>;
  
  // Audit trail with input/output hashing
  protected async logExecution(params: ExecutionLog): Promise<void>;
}
```

### Domain Agents

```typescript
// server/agents/domain-agents.ts
// SEOAgent - Keyword analysis, content optimization, technical SEO
// PPCAgent - Campaign analysis, bid optimization, budget allocation
// CRMAgent - Lead scoring, pipeline analysis, customer segmentation
// ReportingAgent - Report generation, data visualization, trend analysis
```

### Agent Orchestrator

```typescript
// server/agents/orchestrator.ts
class AgentOrchestrator {
  // Route signals to correct agent(s)
  async route(request: RouteRequest): Promise<AgentResult>;
  
  // Domain-based routing (SEO → SEOAgent)
  // Capability matching for cross-domain requests
  // Multi-agent collaboration with shared context
  // Priority-based agent selection
}
```

### Workflow Integration

```typescript
// Agent step type in workflow engine
const agentStep: WorkflowStep = {
  id: 'step-1',
  type: 'agent',
  config: {
    agent: {
      domain: 'seo',
      operation: 'analyze',
      capability: 'keyword_analysis',
      input: { /* agent-specific input */ }
    }
  }
};
```

### Agent Tables

```typescript
// Schema (shared/schema.ts)
agents: {
  id: uuid PRIMARY KEY,
  agencyId: uuid REFERENCES agencies,
  name: varchar,
  domain: varchar,           // 'seo' | 'ppc' | 'crm' | 'reporting'
  status: varchar,           // 'active' | 'inactive' | 'maintenance'
  aiProvider: varchar,       // 'gemini' | 'openai'
  aiModel: varchar,
  systemPrompt: text
}

agent_capabilities: {
  id: uuid PRIMARY KEY,
  agentId: uuid REFERENCES agents,
  name: varchar,
  description: text,
  enabled: boolean,
  config: jsonb
}

agent_executions: {
  id: uuid PRIMARY KEY,
  agentId: uuid REFERENCES agents,
  agencyId: uuid REFERENCES agencies,
  operation: varchar,        // 'analyze' | 'recommend' | 'execute'
  inputHash: varchar,        // SHA-256 for idempotency
  outputHash: varchar,       // SHA-256 for reproducibility
  status: varchar,
  tokenCount: integer,
  latencyMs: integer,
  metadata: jsonb
}

agent_collaborations: {
  id: uuid PRIMARY KEY,
  primaryAgentId: uuid REFERENCES agents,
  secondaryAgentId: uuid REFERENCES agents,
  agencyId: uuid REFERENCES agencies,
  sharedContext: jsonb,
  status: varchar
}
```

### API Endpoints

```
GET/POST    /api/agents                           - List/create agents
GET/PATCH   /api/agents/:id                       - Agent operations
DELETE      /api/agents/:id                       - Delete agent
GET/POST    /api/agents/:id/capabilities          - Capability management
DELETE      /api/agents/:id/capabilities/:capId   - Remove capability
GET         /api/agents/executions                - List all executions
GET         /api/agents/:id/executions            - List agent executions
POST        /api/agents/orchestrate               - Execute via orchestrator
```

---

## CRM Integration & Webhook Processing

### CRM Webhook Handler

The CRM system processes incoming webhook events from HubSpot and converts them into workflow signals.

```typescript
// server/crm/crm-webhook-handler.ts
class CRMWebhookHandler {
  // HubSpot signature verification for webhook security
  verifyHubSpotSignature(requestBody: string, signature: string, clientSecret: string): Promise<boolean>;
  
  // Find agency by HubSpot portal ID (agency isolation)
  findAgencyByPortalId(portalId: string): Promise<string | null>;
  
  // Normalize raw HubSpot events into standard format
  normalizeHubSpotEvent(payload: CRMWebhookPayload): NormalizedCRMEvent;
  
  // Batch process webhook payloads with deduplication
  processWebhookBatch(payloads: CRMWebhookPayload[]): Promise<ProcessResult>;
  
  // Route CRM events through SignalRouter for workflow triggering
  processAndRouteCRMEvent(agencyId: string, event: NormalizedCRMEvent): Promise<RoutingResult>;
}
```

### Supported CRM Event Types (16 total)

```typescript
type CRMEventType = 
  | 'deal.created' | 'deal.updated' | 'deal.deleted' | 'deal.propertyChange'
  | 'contact.created' | 'contact.updated' | 'contact.deleted' | 'contact.propertyChange'
  | 'company.created' | 'company.updated' | 'company.deleted' | 'company.propertyChange'
  | 'meeting.created' | 'meeting.updated'
  | 'form.submitted';
```

### Signal Type Mapping

| CRM Event | Signal Type | Urgency |
|-----------|-------------|---------|
| Deal stage change | `deal_stage_changed` | high |
| Deal created | `deal_created` | normal |
| Contact created | `contact_created` | normal |
| Form submission | `form_submission` | high |
| Meeting scheduled | `meeting_scheduled` | normal |

### CRM API Endpoints

```
POST /api/crm/webhooks/hubspot  - Public webhook endpoint (no auth)
GET  /api/crm/status/:agencyId  - Check HubSpot integration status
GET  /api/crm/events            - List CRM signals for agency
POST /api/crm/sync/:agencyId    - Trigger manual CRM data sync
```

### Agency Isolation

CRM webhooks are isolated by agency via `hubspotPortalId` mapping in `agency_settings`:
- Each agency configures their HubSpot portal ID
- Incoming webhooks are matched to agencies by portal ID
- Signals are created with agency-specific deduplication

---

## SLA & Escalation Engine

### SLA System Overview

The SLA engine monitors deadlines and escalates breaches automatically.

```typescript
// server/sla/sla-service.ts
class SlaService {
  // Detect breaches across all agencies
  async detectBreaches(): Promise<SLABreach[]>;
  
  // Process escalations for a breach
  async processEscalations(breachId: string): Promise<void>;
  
  // Check SLA compliance for a resource
  async checkCompliance(resourceType: string, resourceId: string): Promise<SLAStatus>;
}
```

### SLA Tables

```typescript
// Schema (shared/schema.ts)
sla_definitions: {
  id: uuid PRIMARY KEY,
  agencyId: uuid REFERENCES agencies,
  name: varchar,
  responseTimeMinutes: integer,
  resolutionTimeMinutes: integer,
  businessHoursOnly: boolean,
  businessHoursStart: time,
  businessHoursEnd: time,
  clientId: uuid REFERENCES clients,
  projectId: uuid REFERENCES projects
}

sla_breaches: {
  id: uuid PRIMARY KEY,
  slaDefinitionId: uuid REFERENCES sla_definitions,
  agencyId: uuid REFERENCES agencies,
  resourceType: varchar,
  resourceId: uuid,
  breachType: varchar,      // 'response' | 'resolution'
  status: varchar,          // 'detected' | 'acknowledged' | 'escalated' | 'resolved'
  detectedAt: timestamp,
  acknowledgedAt: timestamp,
  resolvedAt: timestamp
}

escalation_chains: {
  id: uuid PRIMARY KEY,
  slaDefinitionId: uuid REFERENCES sla_definitions,
  level: integer,
  escalateAfterMinutes: integer,
  assignToProfileId: uuid REFERENCES profiles,
  action: varchar           // 'notify' | 'reassign' | 'escalate' | 'pause_billing'
}
```

---

## Important Files Reference (Updated)

| File | Purpose |
|------|---------|
| `server/workflow/engine.ts` | WorkflowEngine class with step execution |
| `server/workflow/rule-engine.ts` | RuleEngine with 16 operators |
| `server/agents/base-agent.ts` | BaseAgent abstract class |
| `server/agents/domain-agents.ts` | SEO, PPC, CRM, Reporting agents |
| `server/agents/orchestrator.ts` | AgentOrchestrator for routing |
| `server/agents/agent-routes.ts` | Agent REST API endpoints |
| `server/sla/sla-service.ts` | SLA breach detection and escalation |
| `server/sla/sla-cron.ts` | Automated SLA monitoring (every 5 min) |
| `server/sla/sla-routes.ts` | SLA REST API endpoints |
| `shared/schema.ts` | All database schemas |
| `server/storage.ts` | Database operations |
| `server/routes.ts` | All API endpoints |

---

*Last Updated: December 2024*
