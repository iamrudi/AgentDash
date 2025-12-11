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
│   └── ai/
│       ├── openai-provider.ts  # OpenAI integration
│       └── gemini-provider.ts  # Gemini integration
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

*Last Updated: December 2024*
