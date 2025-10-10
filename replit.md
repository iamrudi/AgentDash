# Agency Client Portal

## Overview

The Agency Client Portal is a multi-tenant B2B SaaS application that enables agencies to manage client relationships, projects, tasks, and billing. The system provides three distinct user portals:

- **Client Portal**: Allows clients to view their projects, invoices, tasks, and receive recommendations
- **Agency Portal (Admin)**: Comprehensive dashboard for agency administrators to manage all clients, projects, and analytics
- **Staff Portal**: Task management interface for agency staff members to track and update their assigned work

The application follows a modern SaaS dashboard design approach, combining shadcn/ui components with Linear's minimalist aesthetics and Notion's content hierarchy principles.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Language**
- React with TypeScript for type safety
- Vite as the build tool and development server
- Wouter for lightweight client-side routing
- All code must be strongly typed

**UI Component System**
- shadcn/ui as the primary component library (Radix UI primitives)
- Tailwind CSS for styling with custom design tokens
- "new-york" style variant with CSS variables for theming
- Support for light and dark modes via theme provider
- Component aliases configured: `@/components`, `@/lib`, `@/hooks`

**State Management**
- TanStack Query (React Query) for server state and data fetching
- Local state with React hooks
- Theme context for dark/light mode persistence

**Design System**
- Custom color palette with semantic tokens (primary, accent, destructive, muted, etc.)
- Custom border radius values (9px, 6px, 3px)
- Typography using Inter for body text and JetBrains Mono for numbers/metrics
- Hover and active elevation effects for interactive elements

### Backend Architecture

**Server Framework**
- Express.js with TypeScript
- ESM module system
- Development: tsx for hot reload
- Production: esbuild bundled output

**Authentication & Authorization**
- JWT-based authentication with Bearer tokens
- Password hashing using bcryptjs
- Role-based access control (Admin, Client, Staff)
- Protected routes enforce authentication and role requirements
- Security: Self-registration always assigns "Client" role; Admin/Staff roles must be assigned by administrators

**API Structure**
- RESTful API design with route prefixes:
  - `/api/auth/*` - Public authentication endpoints
  - `/api/client/*` - Client-specific endpoints (requires Client role)
  - `/api/agency/*` - Admin endpoints (requires Admin role)
  - `/api/staff/*` - Staff endpoints (requires Staff role)
- Middleware chain: auth verification → role checking → route handler
- Standardized error handling with status codes and JSON responses

### Data Storage

**Database**
- PostgreSQL via Neon serverless
- Drizzle ORM for type-safe database queries
- Schema-first approach with migrations in `/migrations`

**Schema Design**
- `users` - Authentication table (email, hashed password)
- `profiles` - User profiles linked to users (fullName, role)
- `clients` - Company information (companyName, profileId)
- `projects` - Client projects (name, status, description, clientId)
- `tasks` - Project tasks (description, status, dueDate, priority, projectId)
- `staffAssignments` - Links staff to projects
- `invoices` - Billing records (invoiceNumber, amount, status, clientId)
- `recommendations` - Strategic suggestions (title, description, impact, cost, status, clientId)
- `dailyMetrics` - Analytics data (date, source, sessions, conversions, spend, clicks, clientId)

**Relationships**
- Cascade deletes: Deleting a user removes profile, which removes client data
- Foreign key constraints enforce referential integrity
- Join queries using Drizzle's relational query builder for complex data fetching

**Data Access Pattern**
- Storage abstraction layer (`server/storage.ts`) provides interface for all database operations
- Repositories pattern: all DB queries centralized, not scattered across routes
- Type-safe queries and inserts using Drizzle schemas

### External Dependencies

**Database Service**
- Neon PostgreSQL (serverless)
- WebSocket connection with custom SSL configuration
- Connection pooling via `@neondatabase/serverless`

**UI Libraries**
- Radix UI primitives for accessible components
- Recharts for data visualization (line, area, bar charts)
- date-fns for date manipulation and formatting
- Lucide React for icons

**Development Tools**
- Replit-specific plugins (cartographer, dev-banner, runtime error overlay) for development environment
- TypeScript compiler for type checking (noEmit mode)
- PostCSS with Tailwind for CSS processing

**Authentication**
- jsonwebtoken for JWT token generation/verification
- bcryptjs for password hashing
- 7-day token expiration by default

**Form Handling**
- react-hook-form for form state management
- zod for schema validation
- @hookform/resolvers for zod integration