# Agency Client Portal — Frontend-Backend Integration Map

## Overview

This document maps React pages to their backend API endpoints, query keys, and storage methods. Use this as a reference for debugging, testing, and feature development.

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND LAYER                                    │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         React Component                               │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │   │
│  │  │ useQuery()      │  │ useMutation()   │  │ Form State      │      │   │
│  │  │ Data fetching   │  │ Data mutations  │  │ react-hook-form │      │   │
│  │  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘      │   │
│  └───────────┼────────────────────┼────────────────────┼────────────────┘   │
│              │                    │                    │                     │
│              ▼                    ▼                    ▼                     │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     TanStack Query (queryClient)                      │   │
│  │                                                                        │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Query Key Convention:                                            │ │   │
│  │  │ • Simple: ['/api/endpoint']                                     │ │   │
│  │  │ • With ID: ['/api/endpoint', id]                                │ │   │
│  │  │ • With Params: ['/api/endpoint', { status: 'active' }]          │ │   │
│  │  │                                                                  │ │   │
│  │  │ buildUrlFromQueryKey() converts array to URL:                   │ │   │
│  │  │ ['/api/tasks', { status: 'pending' }] → /api/tasks?status=pending │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                        │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │ apiRequest(method, url, data) → fetch with auth headers          │ │   │
│  │  │ • Automatic token refresh before request                        │ │   │
│  │  │ • Authorization header injection                                │ │   │
│  │  │ • JSON body serialization                                       │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
└────────────────────────────────────┼─────────────────────────────────────────┘
                                     │
                                     │ HTTP Request
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            BACKEND LAYER                                     │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Domain Router Architecture (Dec 2025) ✅ COMPLETE  │   │
│  │                                                                        │   │
│  │  server/routes/ (37 registrations, ~294 routes mounted)              │   │
│  │  ├── index.ts                (router composition)                    │   │
│  │  ├── auth.ts                 (3 routes)                              │   │
│  │  ├── user.ts                 (2 routes)                              │   │
│  │  ├── client.ts               (10 routes)                             │   │
│  │  ├── agency.ts               (17 routes)                             │   │
│  │  ├── agency-clients.ts       (7 routes)                              │   │
│  │  ├── agency-settings.ts      (5 routes)                              │   │
│  │  ├── agency-tasks.ts         (13 routes)                             │   │
│  │  ├── agency-users.ts         (5 routes)                              │   │
│  │  ├── staff.ts                (3 routes)                              │   │
│  │  ├── crm.ts                  (34 routes)                             │   │
│  │  ├── settings.ts             (2 routes)                              │   │
│  │  ├── superadmin.ts           (24 routes)                             │   │
│  │  ├── superadmin-health.ts    (3 routes)                              │   │
│  │  ├── invoices.ts             (6 routes)                              │   │
│  │  ├── tasks.ts                (9 routes)                              │   │
│  │  ├── intelligence.ts         (21 routes)                             │   │
│  │  ├── intelligence-extended.ts (27 routes)                            │   │
│  │  ├── knowledge.ts            (12 routes)                             │   │
│  │  ├── knowledge-documents.ts  (12 routes)                             │   │
│  │  ├── workflows.ts            (9 routes)                              │   │
│  │  ├── workflow-executions.ts  (2 routes)                              │   │
│  │  ├── lineage.ts              (2 routes)                              │   │
│  │  ├── rule-engine.ts          (12 routes)                             │   │
│  │  ├── signals.ts              (11 routes)                             │   │
│  │  ├── ai-execution.ts         (5 routes)                              │   │
│  │  ├── ai-chat.ts              (2 routes)                              │   │
│  │  ├── integrations.ts         (19 routes)                             │   │
│  │  ├── oauth.ts                (2 routes)                              │   │
│  │  ├── analytics.ts            (6 routes)                              │   │
│  │  ├── initiatives.ts          (9 routes)                              │   │
│  │  ├── notifications.ts        (5 routes)                              │   │
│  │  ├── messages.ts             (7 routes)                              │   │
│  │  ├── objectives.ts           (4 routes)                              │   │
│  │  ├── proposals.ts            (2 routes)                              │   │
│  │  ├── retention-policies.ts   (4 routes)                              │   │
│  │  └── public.ts               (2 routes)                              │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                       Express.js Middleware Chain                     │   │
│  │                                                                        │   │
│  │  Request → [requestId] → [logger] → [rateLimiter] →                  │   │
│  │            [requireAuth] → [requireRole] → [agencyContext] →          │   │
│  │            [Route Handler]                                            │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         Route Handler                                 │   │
│  │                                                                        │   │
│  │  1. Validate request body with Zod schema                            │   │
│  │  2. Extract agencyId from req.user (tenant isolation)                │   │
│  │  3. Call storage.method() with parameters                            │   │
│  │  4. Return JSON response                                              │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         Storage Layer (IStorage)                      │   │
│  │                                                                        │   │
│  │  • Drizzle ORM queries with agency filtering                         │   │
│  │  • Row-Level Security enforced at DB level                           │   │
│  │  • Returns typed results matching schema.ts types                    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         PostgreSQL (Supabase)                         │   │
│  │                                                                        │   │
│  │  • 40+ RLS policies for tenant isolation                             │   │
│  │  • Drizzle schema in shared/schema.ts                                │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Agency Portal Routes

### Dashboard (`/agency`)

| Page | Query Key | API Endpoint | Storage Method | Response Type |
|------|-----------|--------------|----------------|---------------|
| `agency/index.tsx` | `['/api/agency/metrics']` | `GET /api/agency/metrics` | `storage.getAnalyticsMetrics()` | `AnalyticsMetric[]` |
| | `['/api/agency/projects']` | `GET /api/agency/projects` | `storage.getProjects()` | `Project[]` |
| | `['/api/agency/messages']` | `GET /api/agency/messages` | `storage.getMessages()` | `Message[]` |
| | `['/api/agency/recommendations']` | `GET /api/agency/recommendations` | `storage.getInitiatives()` | `Initiative[]` |

### Clients (`/agency/clients`)

| Page | Query Key | API Endpoint | Storage Method | Response Type |
|------|-----------|--------------|----------------|---------------|
| `agency/clients.tsx` | `['/api/agency/clients']` | `GET /api/agency/clients` | `storage.getClients()` | `Client[]` |
| Create | Mutation | `POST /api/agency/clients` | `storage.createClient()` | `Client` |
| Update | Mutation | `PATCH /api/agency/clients/:id` | `storage.updateClient()` | `Client` |
| Delete | Mutation | `DELETE /api/agency/clients/:id` | `storage.deleteClient()` | `void` |

### Projects (`/agency/projects`)

| Page | Query Key | API Endpoint | Storage Method | Response Type |
|------|-----------|--------------|----------------|---------------|
| `agency/projects.tsx` | `['/api/agency/projects']` | `GET /api/agency/projects` | `storage.getProjects()` | `Project[]` |
| | `['/api/agency/clients']` | `GET /api/agency/clients` | `storage.getClients()` | `Client[]` |
| Create | Mutation | `POST /api/agency/projects` | `storage.createProject()` | `Project` |

### Project Detail (`/agency/projects/:id`)

| Page | Query Key | API Endpoint | Storage Method | Response Type |
|------|-----------|--------------|----------------|---------------|
| `agency/project-detail.tsx` | `['/api/agency/projects', id]` | `GET /api/agency/projects/:id` | `storage.getProjectById()` | `Project` |
| | `['/api/projects', id, 'lists']` | `GET /api/projects/:id/lists` | `storage.getTaskLists()` | `TaskList[]` |
| | `['/api/projects', id, 'tasks']` | `GET /api/projects/:id/tasks` | `storage.getProjectTasks()` | `Task[]` |
| Create Task | Mutation | `POST /api/agency/tasks` | `storage.createTask()` | `Task` |
| Update Task | Mutation | `PATCH /api/agency/tasks/:id` | `storage.updateTask()` | `Task` |
| Create List | Mutation | `POST /api/projects/:id/lists` | `storage.createTaskList()` | `TaskList` |
| Create Subtask | Mutation | `POST /api/tasks/:taskId/subtasks` | `storage.createSubtask()` | `Task` |

### Tasks (`/agency/tasks`)

| Page | Query Key | API Endpoint | Storage Method | Response Type |
|------|-----------|--------------|----------------|---------------|
| `agency/tasks.tsx` | `['/api/agency/tasks']` | `GET /api/agency/tasks` | `storage.getAllTasks()` | `Task[]` |
| | `['/api/agency/staff']` | `GET /api/agency/staff` | `storage.getStaff()` | `Profile[]` |
| | `['/api/agency/clients']` | `GET /api/agency/clients` | `storage.getClients()` | `Client[]` |
| Update | Mutation | `PATCH /api/agency/tasks/:id` | `storage.updateTask()` | `Task` |
| Delete | Mutation | `DELETE /api/agency/tasks/:id` | `storage.deleteTask()` | `void` |

### Staff (`/agency/staff`)

| Page | Query Key | API Endpoint | Storage Method | Response Type |
|------|-----------|--------------|----------------|---------------|
| `agency/staff.tsx` | `['/api/agency/staff']` | `GET /api/agency/staff` | `storage.getStaff()` | `Profile[]` |
| Update | Mutation | `PATCH /api/agency/staff/:id` | `storage.updateStaffProfile()` | `Profile` |

### Invoices (`/agency/invoices`)

| Page | Query Key | API Endpoint | Storage Method | Response Type |
|------|-----------|--------------|----------------|---------------|
| `agency/invoices.tsx` | `['/api/invoices']` | `GET /api/invoices` | `storage.getInvoices()` | `Invoice[]` |
| | `['/api/agency/clients']` | `GET /api/agency/clients` | `storage.getClients()` | `Client[]` |
| Create | Mutation | `POST /api/invoices` | `storage.createInvoice()` | `Invoice` |
| Update Status | Mutation | `PATCH /api/invoices/:id/status` | `storage.updateInvoiceStatus()` | `Invoice` |

### Messages (`/agency/messages`)

| Page | Query Key | API Endpoint | Storage Method | Response Type |
|------|-----------|--------------|----------------|---------------|
| `agency/messages.tsx` | `['/api/agency/messages']` | `GET /api/agency/messages` | `storage.getMessages()` | `Message[]` |
| | `['/api/agency/clients']` | `GET /api/agency/clients` | `storage.getClients()` | `Client[]` |
| Send | Mutation | `POST /api/agency/messages` | `storage.createMessage()` | `Message` |

### Knowledge (`/agency/knowledge`)

| Page | Query Key | API Endpoint | Storage Method | Response Type |
|------|-----------|--------------|----------------|---------------|
| `agency/knowledge.tsx` | `['/api/knowledge', { status, clientId, categoryId }]` | `GET /api/knowledge` | `storage.getClientKnowledge()` | `ClientKnowledge[]` |
| | `['/api/knowledge/categories']` | `GET /api/knowledge/categories` | `storage.getKnowledgeCategories()` | `KnowledgeCategory[]` |
| | `['/api/agency/clients']` | `GET /api/agency/clients` | `storage.getClients()` | `Client[]` |
| Create | Mutation | `POST /api/knowledge` | `knowledgeIngestionService.ingestKnowledge()` | `ClientKnowledge` |
| Update | Mutation | `PATCH /api/knowledge/:id` | `knowledgeIngestionService.updateKnowledge()` | `ClientKnowledge` |
| Archive | Mutation | `POST /api/knowledge/:id/archive` | `knowledgeIngestionService.archiveKnowledge()` | `void` |
| History | `['/api/knowledge', id, 'history']` | `GET /api/knowledge/:id/history` | `storage.getKnowledgeIngestionHistory()` | `KnowledgeIngestionLog[]` |

### Recommendations (`/agency/recommendations`)

| Page | Query Key | API Endpoint | Storage Method | Response Type |
|------|-----------|--------------|----------------|---------------|
| `agency/recommendations.tsx` | `['/api/agency/recommendations']` | `GET /api/agency/recommendations` | `storage.getInitiatives()` | `Initiative[]` |
| | `['/api/agency/clients']` | `GET /api/agency/clients` | `storage.getClients()` | `Client[]` |
| Generate | Mutation | `POST /api/agency/clients/:id/generate-recommendations` | AI Provider | `Initiative[]` |
| Update Status | Mutation | `PATCH /api/initiatives/:id/status` | `storage.updateInitiativeStatus()` | `Initiative` |

### Workflows (`/agency/workflows`)

| Page | Query Key | API Endpoint | Storage Method | Response Type |
|------|-----------|--------------|----------------|---------------|
| `agency/workflows.tsx` | `['/api/workflows']` | `GET /api/workflows` | `storage.getWorkflows()` | `Workflow[]` |
| Create | Mutation | `POST /api/workflows` | `storage.createWorkflow()` | `Workflow` |
| Duplicate | Mutation | `POST /api/workflows/:id/duplicate` | `storage.duplicateWorkflow()` | `Workflow` |

### Workflow Builder (`/agency/workflow-builder/:id?`)

| Page | Query Key | API Endpoint | Storage Method | Response Type |
|------|-----------|--------------|----------------|---------------|
| `agency/workflow-builder.tsx` | `['/api/workflows', id]` | `GET /api/workflows/:id` | `storage.getWorkflowById()` | `Workflow` |
| | `['/api/workflows', id, 'steps']` | `GET /api/workflows/:id/steps` | `storage.getWorkflowSteps()` | `WorkflowStep[]` |
| Save | Mutation | `PATCH /api/workflows/:id` | `storage.updateWorkflow()` | `Workflow` |
| Execute | Mutation | `POST /api/workflows/:id/execute` | `workflowEngine.executeWorkflow()` | `WorkflowExecution` |

### Integrations (`/agency/integrations`)

| Page | Query Key | API Endpoint | Storage Method | Response Type |
|------|-----------|--------------|----------------|---------------|
| `agency/integrations.tsx` | `['/api/agency/integrations']` | `GET /api/agency/integrations` | `storage.getIntegrations()` | `Integration[]` |
| Connect GA4 | Mutation | `POST /api/oauth/google/connect` | OAuth Flow | Redirect |
| Connect HubSpot | Mutation | `POST /api/oauth/hubspot/connect` | OAuth Flow | Redirect |

### Settings (`/agency/settings`)

| Page | Query Key | API Endpoint | Storage Method | Response Type |
|------|-----------|--------------|----------------|---------------|
| `agency/settings.tsx` | `['/api/agency/settings']` | `GET /api/agency/settings` | `storage.getAgencySettings()` | `AgencySettings` |
| | `['/api/agency/settings/branding']` | `GET /api/agency/settings/branding` | `storage.getAgencyBranding()` | `AgencyBranding` |
| Update | Mutation | `PUT /api/agency/settings` | `storage.updateAgencySettings()` | `AgencySettings` |
| Upload Logo | Mutation | `POST /api/agency/settings/logo` | Multer → file storage | `{ url: string }` |

---

## Client Portal Routes

### Dashboard (`/client`)

| Page | Query Key | API Endpoint | Storage Method | Response Type |
|------|-----------|--------------|----------------|---------------|
| `client/dashboard.tsx` | `['/api/client/profile']` | `GET /api/client/profile` | `storage.getClientById()` | `Client` |
| | `['/api/client/projects']` | `GET /api/client/projects` | `storage.getClientProjects()` | `Project[]` |
| | `['/api/client/tasks/recent']` | `GET /api/client/tasks/recent` | `storage.getClientRecentTasks()` | `Task[]` |

### Projects (`/client/projects`)

| Page | Query Key | API Endpoint | Storage Method | Response Type |
|------|-----------|--------------|----------------|---------------|
| `client/projects.tsx` | `['/api/client/projects']` | `GET /api/client/projects` | `storage.getClientProjects()` | `Project[]` |
| | `['/api/client/projects-with-tasks']` | `GET /api/client/projects-with-tasks` | `storage.getClientProjectsWithTasks()` | `ProjectWithTasks[]` |

### Billing (`/client/billing`)

| Page | Query Key | API Endpoint | Storage Method | Response Type |
|------|-----------|--------------|----------------|---------------|
| `client/billing.tsx` | `['/api/client/invoices']` | `GET /api/client/invoices` | `storage.getClientInvoices()` | `Invoice[]` |

### Recommendations (`/client/recommendations`)

| Page | Query Key | API Endpoint | Storage Method | Response Type |
|------|-----------|--------------|----------------|---------------|
| `client/recommendations.tsx` | `['/api/client/initiatives']` | `GET /api/client/initiatives` | `storage.getClientInitiatives()` | `Initiative[]` |
| Respond | Mutation | `POST /api/initiatives/:id/client-response` | `storage.updateInitiativeClientResponse()` | `Initiative` |

---

## Staff Portal Routes

### Dashboard (`/staff`)

| Page | Query Key | API Endpoint | Storage Method | Response Type |
|------|-----------|--------------|----------------|---------------|
| `staff-dashboard.tsx` | `['/api/staff/tasks']` | `GET /api/staff/tasks` | `storage.getStaffTasks()` | `Task[]` |
| | `['/api/staff/tasks/full']` | `GET /api/staff/tasks/full` | `storage.getStaffTasksFull()` | `TaskWithProject[]` |
| Update Task | Mutation | `PATCH /api/agency/tasks/:id` | `storage.updateTask()` | `Task` |

### Hours (`/staff/hours`)

| Page | Query Key | API Endpoint | Storage Method | Response Type |
|------|-----------|--------------|----------------|---------------|
| `staff-hours.tsx` | `['/api/staff/time-entries']` | `GET /api/staff/time-entries` | `storage.getStaffTimeEntries()` | `TimeEntry[]` |
| Log Time | Mutation | `POST /api/time-entries` | `storage.createTimeEntry()` | `TimeEntry` |

---

## SuperAdmin Portal Routes

### Dashboard (`/superadmin`)

| Page | Query Key | API Endpoint | Storage Method | Response Type |
|------|-----------|--------------|----------------|---------------|
| `superadmin/index.tsx` | `['/api/superadmin/agencies']` | `GET /api/superadmin/agencies` | `storage.getAllAgencies()` | `Agency[]` |
| | `['/api/superadmin/users']` | `GET /api/superadmin/users` | `storage.getAllUsers()` | `Profile[]` |
| | `['/api/superadmin/metrics']` | `GET /api/superadmin/metrics` | `storage.getPlatformMetrics()` | `PlatformMetrics` |

---

## Intelligence API Endpoints

### Duration Intelligence

| Endpoint | Method | Handler | Service |
|----------|--------|---------|---------|
| `/api/intelligence/duration/predict` | POST | Route handler | `durationModelService.predictDuration()` |
| `/api/intelligence/duration/history` | GET | Route handler | `storage.getTaskExecutionHistory()` |

### Feedback Loop

| Endpoint | Method | Handler | Service |
|----------|--------|---------|---------|
| `/api/intelligence/outcomes` | GET | Route handler | `storage.getRecommendationOutcomes()` |
| `/api/intelligence/outcomes/:id` | PATCH | Route handler | `outcomeFeedbackService.recordActualOutcome()` |
| `/api/intelligence/quality-metrics` | GET | Route handler | `storage.getRecommendationQualityMetrics()` |
| `/api/intelligence/calibration` | GET | Route handler | `storage.getAICalibrationParameters()` |

### Knowledge Layer

| Endpoint | Method | Handler | Service |
|----------|--------|---------|---------|
| `/api/knowledge` | GET | Route handler | `storage.getClientKnowledge()` |
| `/api/knowledge` | POST | Route handler | `knowledgeIngestionService.ingestKnowledge()` |
| `/api/knowledge/:id` | PATCH | Route handler | `knowledgeIngestionService.updateKnowledge()` |
| `/api/knowledge/:id/archive` | POST | Route handler | `knowledgeIngestionService.archiveKnowledge()` |
| `/api/knowledge/:id/history` | GET | Route handler | `storage.getKnowledgeIngestionHistory()` |
| `/api/knowledge/categories` | GET | Route handler | `storage.getKnowledgeCategories()` |
| `/api/knowledge/categories/initialize` | POST | Route handler | `knowledgeIngestionService.initializeDefaultCategories()` |
| `/api/knowledge/context/:clientId` | GET | Route handler | `knowledgeRetrievalService.getContextForClient()` |

---

## Query Key Conventions

### Simple Keys
```typescript
// Base endpoint
useQuery({ queryKey: ['/api/agency/clients'] })
// Resolves to: GET /api/agency/clients
```

### Hierarchical Keys (with ID)
```typescript
// Entity with ID
useQuery({ queryKey: ['/api/agency/projects', projectId] })
// Resolves to: GET /api/agency/projects/{projectId}

// Nested resource
useQuery({ queryKey: ['/api/projects', projectId, 'lists'] })
// Resolves to: GET /api/projects/{projectId}/lists
```

### Keys with Parameters
```typescript
// With query parameters
useQuery({ 
  queryKey: ['/api/knowledge', { status: 'active', clientId: selectedClient }] 
})
// Resolves to: GET /api/knowledge?status=active&clientId={selectedClient}
```

### Cache Invalidation
```typescript
// Invalidate all under prefix
queryClient.invalidateQueries({ queryKey: ['/api/agency/projects'] })

// Invalidate specific entity
queryClient.invalidateQueries({ queryKey: ['/api/agency/projects', projectId] })
```

---

## Mutation Pattern

```typescript
const mutation = useMutation({
  mutationFn: async (data: InsertType) => {
    const res = await apiRequest('POST', '/api/endpoint', data);
    return res.json();
  },
  onSuccess: () => {
    // Invalidate related queries
    queryClient.invalidateQueries({ queryKey: ['/api/endpoint'] });
    toast({ title: 'Success', description: 'Created successfully' });
  },
  onError: (error: Error) => {
    toast({ 
      title: 'Error', 
      description: error.message,
      variant: 'destructive'
    });
  }
});
```

---

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Token Refresh Flow                            │
│                                                                  │
│  1. API Request initiated                                       │
│         │                                                        │
│         ▼                                                        │
│  2. refreshTokenIfNeeded()                                      │
│     ├── Check if token expired or near expiry                   │
│     ├── If expired: POST /api/auth/refresh                      │
│     └── Update tokens in localStorage                           │
│         │                                                        │
│         ▼                                                        │
│  3. getAuthHeaders()                                            │
│     └── Add Authorization: Bearer {token}                       │
│         │                                                        │
│         ▼                                                        │
│  4. fetch(url, { headers, credentials: 'include' })             │
│         │                                                        │
│         ▼                                                        │
│  5. Backend validates JWT                                       │
│     ├── requireAuth middleware                                  │
│     └── Attaches user to req.user                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## SuperAdmin Health & Maintenance API

### Health Monitoring

| Endpoint | Method | Handler | Response |
|----------|--------|---------|----------|
| `/api/superadmin/health` | GET | Route handler | `{ db, rls, cron, ai, realtime }` status |
| `/api/superadmin/health/db` | GET | Route handler | Database connection status |
| `/api/superadmin/health/rls` | GET | Route handler | RLS policy verification |
| `/api/superadmin/health/realtime` | GET | Route handler | WebSocket/SSE health |

### Maintenance Mode

| Endpoint | Method | Handler | Response |
|----------|--------|---------|----------|
| `/api/superadmin/maintenance` | GET | Route handler | Current maintenance state |
| `/api/superadmin/maintenance` | POST | Route handler | Toggle maintenance mode |

**Maintenance Mode Behavior:**
- SuperAdmin can always access all endpoints
- Auth endpoints (`/api/auth/*`) remain accessible
- All other endpoints return 503 with `retryAfter: 300`

---

## Test Infrastructure Mapping

### Test Files → Middleware → Storage

| Test File | Tests | Middleware | Storage Methods |
|-----------|-------|------------|-----------------|
| `tests/middleware/auth.test.ts` | 18 | `requireAuth`, `requireRole`, `requireSuperAdmin` | `storage.getClient()` |
| `tests/middleware/maintenance.test.ts` | 8 | `maintenanceMiddleware` | `db.select().from(settings)` |
| `tests/sla/sla-service.test.ts` | 18 | None (unit tests) | None (pure functions) |

### Test Utilities

| Utility | Purpose | Used By |
|---------|---------|---------|
| `createMockRequest()` | Mock Express request | Auth, maintenance tests |
| `createMockResponse()` | Mock Express response with `getJson()` | All middleware tests |
| `createMockNext()` | Mock Express next function | All middleware tests |
| `createMockStorage()` | Mock IStorage interface | Auth tests |
| `testUsers.*` | Pre-configured user fixtures | All tests |

---

*Generated: December 2025*
