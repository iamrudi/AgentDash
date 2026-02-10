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
- **Supabase Auth** + JWT for session management
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
│   ├── routes.ts               # Legacy file with 3 remaining routes
│   ├── routes/                 # Domain-specific routers (37 registrations, ~325 routes)
│   │   ├── index.ts            # Router composition and registration
│   │   ├── auth.ts             # Authentication (3 routes)
│   │   ├── user.ts             # User profile (2 routes)
│   │   ├── client.ts           # Client portal (10 routes)
│   │   ├── agency.ts           # Agency admin (17 routes)
│   │   ├── agency-clients.ts   # Client management (7 routes)
│   │   ├── agency-settings.ts  # Agency settings (5 routes)
│   │   ├── agency-tasks.ts     # Task management (13 routes)
│   │   ├── agency-users.ts     # User management (5 routes)
│   │   ├── staff.ts            # Staff portal (3 routes)
│   │   ├── crm.ts              # CRM (34 routes)
│   │   ├── settings.ts         # Settings (2 routes)
│   │   ├── superadmin.ts       # SuperAdmin governance (24 routes)
│   │   ├── superadmin-health.ts # Health checks (3 routes)
│   │   ├── invoices.ts         # Invoice management (6 routes)
│   │   ├── tasks.ts            # Task CRUD, subtasks (9 routes)
│   │   ├── intelligence.ts     # Duration intelligence (21 routes)
│   │   ├── intelligence-extended.ts # Extended intelligence (27 routes)
│   │   ├── knowledge.ts        # Knowledge ingestion/retrieval (12 routes)
│   │   ├── knowledge-documents.ts # Document management (12 routes)
│   │   ├── workflows.ts        # Workflow CRUD, execution (9 routes)
│   │   ├── workflow-executions.ts # Execution events (2 routes)
│   │   ├── lineage.ts          # Lineage tracing (2 routes)
│   │   ├── rule-engine.ts      # Workflow rules (12 routes)
│   │   ├── signals.ts          # Signal ingestion (11 routes)
│   │   ├── ai-execution.ts     # AI execution (5 routes)
│   │   ├── ai-chat.ts          # AI chat (2 routes)
│   │   ├── integrations.ts     # Integration management (19 routes)
│   │   ├── oauth.ts            # OAuth flows (2 routes)
│   │   ├── analytics.ts        # Analytics (6 routes)
│   │   ├── initiatives.ts      # Initiatives (9 routes)
│   │   ├── notifications.ts    # Notifications (5 routes)
│   │   ├── messages.ts         # Messaging (7 routes)
│   │   ├── objectives.ts       # Objectives (4 routes)
│   │   ├── proposals.ts        # Proposals (2 routes)
│   │   ├── retention-policies.ts # Retention policies (4 routes)
│   │   └── public.ts           # Public endpoints (2 routes)
│   ├── storage.ts              # DbStorage facade (3,245 lines - decomposition in progress)
│   ├── storage/
│   │   ├── index.ts            # Storage module exports
│   │   ├── contracts/          # Domain interfaces
│   │   │   ├── identity.ts     # Identity domain (12 methods)
│   │   │   ├── agency.ts       # Agency domain (4 methods)
│   │   │   └── task.ts         # Task domain (27 methods)
│   │   └── domains/            # Domain implementations
│   │       ├── identity.storage.ts  # User, profile, session
│   │       ├── agency.storage.ts    # Agency CRUD
│   │       └── task.storage.ts      # Tasks, lists, assignments
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

### Unit Testing with Vitest

```typescript
// tests/utils/test-helpers.ts
import { vi } from 'vitest';

// Mock Express request
export function createMockRequest(overrides?: Partial<AuthRequest>) {
  return {
    user: undefined,
    params: {},
    query: {},
    body: {},
    path: '/test',
    ...overrides
  };
}

// Mock Express response
export function createMockResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    _json: null
  };
  res.getJson = () => res._json;
  return res;
}

// Pre-configured test users
export const testUsers = {
  superAdmin: { id: 'super-admin-uuid', role: 'Admin', isSuperAdmin: true },
  adminAgencyA: { id: 'admin-a-uuid', role: 'Admin', agencyId: 'agency-a-uuid' },
  staffAgencyA: { id: 'staff-a-uuid', role: 'Staff', agencyId: 'agency-a-uuid' },
  clientUserA: { id: 'client-a-uuid', role: 'Client', clientId: 'client-a-uuid' }
};
```

### Running Tests

```bash
# Run 44 stability tests (auth, maintenance, SLA)
npx vitest run tests/middleware tests/sla

# Run all tests
npx vitest run

# Watch mode
npx vitest

# Coverage report
npx vitest run --coverage
```

### Test Categories

| Category | Path | Purpose |
|----------|------|---------|
| Middleware | `tests/middleware/*.test.ts` | Auth, role, maintenance logic |
| SLA | `tests/sla/*.test.ts` | Breach detection, deadline calculation |
| Integration | `tests/integration/*.test.ts` | API flow validation |

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

### Structured Logging Standards

```typescript
// Winston JSON logging format
import { logger } from './lib/logger';

// Info level - normal operations
logger.info('Operation completed', {
  service: 'agency-client-portal',
  userId: req.user?.id,
  path: req.path
});

// Warn level - potential issues
logger.warn('Cross-tenant access attempted', {
  service: 'agency-client-portal',
  userId: req.user?.id,
  userAgencyId: req.user?.agencyId,
  resourceAgencyId: resource.agencyId
});

// Error level - failures
logger.error('Database operation failed', {
  service: 'agency-client-portal',
  error: error.message,
  stack: error.stack
});
```

### Maintenance Mode API

```typescript
// Maintenance mode bypass logic
// server/middleware/maintenance.ts

// Allowed paths during maintenance
const BYPASS_PATHS = ['/api/auth/login', '/api/auth/session', '/api/auth/logout'];

// Bypass conditions (in order):
// 1. Path is in BYPASS_PATHS
// 2. User is SuperAdmin (isSuperAdmin: true)
// All other requests return 503

// 503 Response format
{
  error: 'maintenance_mode',
  message: 'System is under maintenance. Please try again later.',
  retryAfter: 300
}
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
| `server/storage.ts` | Database operations (legacy - new features should use domain storage modules) |
| `server/routes.ts` | Legacy shim (~300 lines, 3 routes) - routes decomposed to server/routes/ |
| `server/routes/` | Domain routers (37 registrations, ~325 routes) |
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

## Analytics Anomaly Detection

### Overview

The analytics anomaly detection service automatically identifies significant changes in GA4 and GSC metrics, converting detected anomalies into workflow signals for automated response.

### Core Service

```typescript
// server/analytics/anomaly-detection.ts
class AnomalyDetectionService {
  // Statistical Methods
  calculateZScore(value: number, dataset: number[]): number;
  calculateIQRBounds(dataset: number[]): IQRBounds;
  
  // Detection
  detectAnomaliesForClient(clientId: string, agencyId: string): Promise<DetectedAnomaly[]>;
  runAnomalyDetectionForAgency(agencyId: string): Promise<AnomalyResults[]>;
  
  // Trend Analysis
  analyzeTrends(clientId: string): Promise<TrendAnalysis[]>;
  
  // Signal Conversion
  convertAnomalyToSignal(anomaly: DetectedAnomaly): Promise<string | null>;
}
```

### Anomaly Types

```typescript
type AnomalyType = 
  | 'traffic_drop' | 'traffic_spike'
  | 'conversion_drop' | 'conversion_spike'
  | 'ranking_loss' | 'ranking_gain'
  | 'impression_drop' | 'click_drop'
  | 'spend_anomaly' | 'bounce_rate_spike';
```

### Detection Methods

| Method | Description | Use Case |
|--------|-------------|----------|
| Z-score | Standard deviation from mean | Traffic and conversion anomalies |
| IQR | Interquartile range outliers | Robust outlier detection |
| Percent Change | WoW/MoM comparison | Trend analysis |

### Threshold Configuration

```typescript
interface AnomalyThreshold {
  metricType: MetricType;
  zScoreThreshold: number;       // Default: 2.5
  percentChangeThreshold: number; // Default: 30%
  minDataPoints: number;          // Default: 14 days
  enabled: boolean;
}
```

### False Positive Filtering

The service filters false positives using:
- **Weekend Pattern Detection:** Reduced traffic on weekends is expected
- **Confidence Scoring:** Combines Z-score, data points, and IQR validation
- **Historical Similarity:** Checks if similar values occurred recently

### API Endpoints

```
GET  /api/analytics/anomalies/:clientId    - Detect anomalies for client
GET  /api/analytics/trends/:clientId       - WoW/MoM trend analysis
POST /api/analytics/anomalies/scan         - Scan all agency clients
POST /api/analytics/anomalies/:clientId/convert - Convert to signals
GET  /api/analytics/statistics/:clientId   - Statistical summary
```

### Signal Integration

Detected anomalies are converted to workflow signals via `AnalyticsAdapter`:

```typescript
// Signal type mapping
const signalTypeMap = {
  traffic_drop: 'traffic_anomaly',
  conversion_drop: 'conversion_anomaly',
  ranking_loss: 'ranking_anomaly',
  impression_drop: 'visibility_anomaly',
};
```

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

## Visual Workflow Builder UI

### Overview

A no-code visual workflow editor using React Flow (@xyflow/react) for drag-and-drop workflow creation.

### Routes

- `/agency/workflows` - Workflow list page with CRUD operations
- `/agency/workflow-builder/:id?` - Visual canvas editor

### Frontend Components

```typescript
// client/src/pages/agency/workflow-builder.tsx
// Three-panel layout: Step Palette (left), Canvas (center), Properties (right)

// Step Types with visual styling
const STEP_TYPES = [
  { type: 'signal', label: 'Signal', color: 'yellow', icon: Zap },
  { type: 'rule', label: 'Rule', color: 'blue', icon: Filter },
  { type: 'ai', label: 'AI', color: 'purple', icon: Brain },
  { type: 'action', label: 'Action', color: 'green', icon: Play },
  { type: 'transform', label: 'Transform', color: 'orange', icon: ArrowRightLeft },
  { type: 'notification', label: 'Notification', color: 'pink', icon: Bell },
  { type: 'branch', label: 'Branch', color: 'cyan', icon: GitBranch }
];

// Custom React Flow node with Handle components
function StepNode({ data, selected }) {
  return (
    <div className={`step-node ${data.type}`}>
      <Handle type="target" position={Position.Top} />
      <div className="node-content">
        <StepIcon type={data.type} />
        <span>{data.label}</span>
      </div>
      <Handle type="source" position={Position.Bottom} />
      {/* Branch nodes have additional left/right handles */}
      {data.type === 'branch' && (
        <>
          <Handle type="source" id="true" position={Position.Right} />
          <Handle type="source" id="false" position={Position.Left} />
        </>
      )}
    </div>
  );
}
```

### Backend API

```typescript
// POST /api/workflows/validate
// Validates workflow structure using Zod schema
const workflowValidationSchema = z.object({
  steps: z.array(z.object({
    id: z.string().min(1),
    type: z.enum(["signal", "rule", "ai", "action", "transform", "notification", "branch"]),
    name: z.string().optional(),
    config: z.record(z.unknown()).optional(),
    position: z.object({ x: z.number(), y: z.number() }).optional(),
  })),
  connections: z.array(z.object({
    source: z.string().min(1),
    target: z.string().min(1),
    sourceHandle: z.string().optional(),
    targetHandle: z.string().optional(),
  })).optional().default([]),
});

// POST /api/workflows/:id/duplicate
// Clones workflow with tenant isolation
```

### Key Files

| File | Purpose |
|------|---------|
| `client/src/pages/agency/workflows.tsx` | Workflow list page |
| `client/src/pages/agency/workflow-builder.tsx` | Visual canvas editor |
| `server/routes.ts` | Validate/duplicate endpoints |

---

## Intelligence Layer Implementation

### Duration Intelligence

```typescript
// server/intelligence/duration-model-service.ts
interface DurationPrediction {
  predictedMinutes: number;
  confidence: number;        // 0-1 based on sample count, variance
  sampleCount: number;
  varianceFactor: number;
  method: 'heuristic' | 'historical' | 'ml';
}

class DurationModelService {
  // Layered prediction: baseline → assignee offset → client adjustment
  async predictDuration(taskType: string, assigneeId?: string, clientId?: string): Promise<DurationPrediction>;
  
  // Cold start with global defaults, fast adaptation
  async getTaskTypeBaseline(taskType: string): Promise<number>;
  
  // Assignee-specific performance factor
  async getAssigneeOffset(assigneeId: string, taskType: string): Promise<number>;
}

// server/intelligence/resource-optimizer-service.ts
interface AllocationPlan {
  taskId: string;
  recommendedAssigneeId: string;
  score: number;             // Objective function result
  reasons: string[];
}

class ResourceOptimizerService {
  // Greedy allocation: skill fit + capacity + SLA risk
  async optimize(tasks: Task[], staff: Profile[]): Promise<AllocationPlan[]>;
  
  // Objective: minimize overload + SLA breach + context switching
  private calculateObjective(assignment: Assignment): number;
}

// server/intelligence/commercial-impact-service.ts
interface PriorityScore {
  taskId: string;
  score: number;
  components: {
    revenue: number;
    clientTier: number;
    deadlineRisk: number;
    strategicValue: number;
  };
}

class CommercialImpactService {
  // Configurable: revenue×w1 + tier×w2 + risk×w3 + strategic×w4
  async calculatePriority(task: Task): Promise<PriorityScore>;
  
  // SLA breach detection
  async detectBreachRisk(tasks: Task[]): Promise<Task[]>;
}
```

### Closed Feedback Loop

```typescript
// server/intelligence/outcome-feedback-service.ts
interface OutcomeRecord {
  initiativeId: string;
  accepted: boolean;
  actualImpact?: string;
  predictedImpact?: string;
  varianceScore?: number;
  capturedAt: Date;
}

class OutcomeFeedbackService {
  // Fire-and-forget: never blocks client response
  async captureOutcome(initiativeId: string, accepted: boolean): Promise<void>;
  
  // Called when initiative completes
  async recordActualOutcome(initiativeId: string, impact: string): Promise<void>;
  
  // Variance = |actual - predicted| / predicted
  async calculateImpactVariance(initiativeId: string): Promise<number>;
  
  // Rolling quality scores per recommendation type
  async updateQualityMetrics(type: string, accepted: boolean): Promise<void>;
}

// Pattern: Fire-and-forget integration
app.patch('/api/initiatives/:id/status', async (req, res) => {
  const initiative = await storage.updateInitiativeStatus(id, status);
  
  // Non-blocking outcome capture
  outcomeFeedbackService.captureOutcome(id, status === 'approved')
    .catch(err => logger.warn('Outcome capture failed', { err }));
  
  res.json(initiative);
});
```

### Knowledge Layer

```typescript
// server/intelligence/knowledge-ingestion-service.ts
interface KnowledgeValidation {
  valid: boolean;
  errors: string[];
  conflicts: { existingId: string; reason: string }[];
}

class KnowledgeIngestionService {
  // Validates against category schema
  async validateKnowledge(data: InsertClientKnowledge): Promise<KnowledgeValidation>;
  
  // Creates versioned entry with conflict detection
  async ingestKnowledge(data: InsertClientKnowledge): Promise<ClientKnowledge>;
  
  // Increments version, maintains audit trail
  async updateKnowledge(id: string, updates: Partial<ClientKnowledge>): Promise<ClientKnowledge>;
  
  // Soft delete with archival
  async archiveKnowledge(id: string): Promise<void>;
  
  // Initialize default category set
  async initializeDefaultCategories(agencyId: string): Promise<KnowledgeCategory[]>;
}

// server/intelligence/knowledge-retrieval-service.ts
interface RetrievalContext {
  documents: ClientKnowledge[];
  categories: KnowledgeCategory[];
  freshnessFactor: number;   // 0-1 recency weighting
}

class KnowledgeRetrievalService {
  // Freshness-weighted, tenant-isolated
  async getContextForClient(clientId: string): Promise<RetrievalContext>;
  
  // Category-filtered for specific AI tasks
  async getKnowledgeByCategory(clientId: string, categoryId: string): Promise<ClientKnowledge[]>;
  
  // Assembles context for AI prompt enrichment
  async assembleAIContext(clientId: string, taskType: string): Promise<string>;
}
```

### API Endpoints

| Endpoint | Method | Service | Purpose |
|----------|--------|---------|---------|
| `/api/intelligence/duration/predict` | POST | DurationModelService | Get duration prediction |
| `/api/intelligence/duration/history` | GET | Storage | Task execution history |
| `/api/intelligence/outcomes` | GET | Storage | Recommendation outcomes |
| `/api/intelligence/outcomes/:id` | PATCH | OutcomeFeedbackService | Record actual outcome |
| `/api/intelligence/quality-metrics` | GET | Storage | Quality metrics by type |
| `/api/intelligence/calibration` | GET | Storage | AI calibration parameters |
| `/api/knowledge` | GET/POST | KnowledgeIngestionService | CRUD knowledge |
| `/api/knowledge/:id` | PATCH | KnowledgeIngestionService | Update knowledge |
| `/api/knowledge/:id/archive` | POST | KnowledgeIngestionService | Archive knowledge |
| `/api/knowledge/:id/history` | GET | Storage | Ingestion audit trail |
| `/api/knowledge/categories` | GET | Storage | List categories |
| `/api/knowledge/context/:clientId` | GET | KnowledgeRetrievalService | AI context assembly |

---

## Important Files Reference (Updated)

### Core System
| File | Purpose |
|------|---------|
| `shared/schema.ts` | All database schemas (3,235 lines) |
| `server/storage.ts` | Database operations - legacy DbStorage (3,245 lines, decomposition in progress) |
| `server/routes.ts` | Legacy shim (~300 lines, 3 routes) |
| `server/routes/` | Domain routers (37 registrations, ~325 routes) - decomposition ✅ complete |
| `server/storage/` | Domain storage modules (43 methods extracted) |

### Workflow Engine
| File | Purpose |
|------|---------|
| `server/workflow/engine.ts` | WorkflowEngine class with step execution |
| `server/workflow/rule-engine.ts` | RuleEngine with 16 operators |
| `server/workflow/signal-router.ts` | Signal routing and matching |
| `server/workflow/signal-adapters.ts` | External signal adapters |

### Agent System
| File | Purpose |
|------|---------|
| `server/agents/base-agent.ts` | BaseAgent abstract class |
| `server/agents/domain-agents.ts` | SEO, PPC, CRM, Reporting agents |
| `server/agents/orchestrator.ts` | AgentOrchestrator for routing |
| `server/agents/agent-routes.ts` | Agent REST API endpoints |

### SLA & Scheduling
| File | Purpose |
|------|---------|
| `server/sla/sla-service.ts` | SLA breach detection and escalation |
| `server/sla/sla-cron.ts` | Automated SLA monitoring (every 5 min) |
| `server/sla/sla-routes.ts` | SLA REST API endpoints |

### Intelligence Layer
| File | Purpose |
|------|---------|
| `server/intelligence/duration-model-service.ts` | Task duration prediction |
| `server/intelligence/resource-optimizer-service.ts` | Greedy resource allocation |
| `server/intelligence/commercial-impact-service.ts` | Priority scoring |
| `server/intelligence/outcome-feedback-service.ts` | Recommendation outcome tracking |
| `server/intelligence/knowledge-ingestion-service.ts` | Knowledge validation and versioning |
| `server/intelligence/knowledge-retrieval-service.ts` | Freshness-weighted retrieval |
| `server/intelligence/signal-emitter.ts` | Quality threshold signals |
| `server/intelligence/priority-engine.ts` | Task prioritization |

### AI Providers
| File | Purpose |
|------|---------|
| `server/ai/hardened-executor.ts` | Retry, caching, validation |
| `server/ai/gemini-provider.ts` | Gemini API integration |
| `server/ai/openai-provider.ts` | OpenAI API integration |
| `server/ai/provider.ts` | Provider interface |

### Vector & Embeddings
| File | Purpose |
|------|---------|
| `server/vector/embedding-service.ts` | Tenant-isolated vector stores |

### Frontend
| File | Purpose |
|------|---------|
| `client/src/App.tsx` | Main router and layout |
| `client/src/lib/queryClient.ts` | TanStack Query configuration |
| `client/src/pages/agency/workflows.tsx` | Workflow list page |
| `client/src/pages/agency/workflow-builder.tsx` | Visual workflow canvas editor |
| `client/src/pages/agency/knowledge.tsx` | Knowledge management UI |

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture, diagrams |
| [PRIORITY_LIST.md](./PRIORITY_LIST.md) | Roadmap, technical debt |
| [maintenance-matrix.md](./maintenance-matrix.md) | Module health scores |
| [frontend-backend-map.md](./frontend-backend-map.md) | API integration map |
| [README.md](./README.md) | Documentation hub, authoritative metrics |

---

*Last Updated: December 2025*

## Guardrails & Phase 0 Tests (AI/Gates)

### How to run the enforcement checks

- `npm run check` runs guardrails + full Vitest suite.
- `npm run guardrails` runs only the direct-LLM-call guardrail.
- `npm run check:fast` runs guardrails + the Phase 0 enforcement subset.

### What the guardrail enforces

- Direct model/LLM provider calls (OpenAI/Gemini patterns) are only allowed in `server/ai/**`.
- Allowlist entries are restricted to `docs/**`, `tests/**`, and `scripts/**` only.
- Legacy runtime violations (outside `server/ai/**`) are tracked as CRITICAL migration debt in `documentation/PRIORITY_LIST.md`.

### Phase 0 vs Phase 1

- Phase 0 surfaces violations via guardrails + tests without changing runtime behavior.
- Phase 1 migrates legacy direct calls into `server/ai/hardened-executor.ts` and removes the CRITICAL debt list.

### Where to add future gate tests

- Add Opportunity Gate, SKU freeze, and Acceptance Gate tests under `tests/` using a `*.gate.test.ts` naming convention.
- Keep gate tests contract-focused (schema + policy checks) and avoid runtime behavior changes in Phase 0.
