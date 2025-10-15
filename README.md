# Agency Client Portal

[![CI Status](https://github.com/your-org/agency-portal/workflows/CI/badge.svg)](https://github.com/your-org/agency-portal/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A production-ready, multi-tenant SaaS platform for agency-client relationship management with AI-powered insights, project tracking, and automated workflows.

## 🚀 Features

### Core Functionality
- **Multi-Tenant Architecture** - Strict tenant isolation with Row-Level Security (RLS)
- **Role-Based Access Control** - Admin, Staff, and Client portals with granular permissions
- **Real-Time Chat** - WhatsApp-style messaging with Server-Sent Events (SSE)
- **Project & Task Management** - Comprehensive workflow tracking and assignment
- **Invoice Automation** - Automated retainer invoicing with PDF generation

### AI & Analytics
- **AI Recommendations** - Google Gemini-powered strategic insights with preset-driven UX
- **Google Analytics 4 Integration** - Automated metrics sync and lead tracking
- **Google Search Console** - Performance metrics and SEO insights
- **SEO Audit Tools** - Lighthouse-powered website audits with AI summaries
- **Content Co-pilot** - AI content generation using Data for SEO API

### Security & Performance
- **Supabase Auth** - Secure authentication with session management
- **AES-256-GCM Encryption** - Sensitive data protection
- **Rate Limiting** - API protection against abuse
- **Centralized Logging** - Winston-powered structured logging
- **Error Handling** - Comprehensive error middleware

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Development](#-development)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [API Documentation](#-api-documentation)
- [Database Migrations](#-database-migrations)
- [Architecture](#-architecture)
- [Contributing](#-contributing)

## ⚡ Quick Start

\`\`\`bash
# Clone repository
git clone https://github.com/your-org/agency-portal.git
cd agency-portal

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your credentials

# Run database migrations
npm run db:push

# Seed initial data (optional)
npm run seed

# Start development server
npm run dev
\`\`\`

Visit `http://localhost:5000` and login with seeded credentials.

## 📦 Prerequisites

- **Node.js** >= 20.x
- **PostgreSQL** >= 14.x (or Supabase account)
- **Google Cloud Project** (for GA4, GSC, Gemini AI)
- **Data for SEO API** account (optional, for content features)

## 🛠️ Installation

### Local Development

1. **Clone and install:**
   \`\`\`bash
   git clone https://github.com/your-org/agency-portal.git
   cd agency-portal
   npm install
   \`\`\`

2. **Configure environment:**
   \`\`\`bash
   cp .env.example .env
   \`\`\`
   
   Edit `.env` with your credentials (see [Configuration](#-configuration))

3. **Database setup:**
   \`\`\`bash
   # Push schema to database
   npm run db:push
   
   # Seed initial data
   npm run seed
   \`\`\`

4. **Start development:**
   \`\`\`bash
   npm run dev
   \`\`\`

### Replit Deployment

1. Fork this Repl
2. Configure Secrets in Replit:
   - `DATABASE_URL`
   - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
   - `GEMINI_API_KEY`
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `ENCRYPTION_KEY`, `SESSION_SECRET`, `JWT_SECRET`
3. Click "Run" - migrations run automatically

## ⚙️ Configuration

### Required Environment Variables

\`\`\`bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Security (Generate with: openssl rand -hex 32)
ENCRYPTION_KEY=your-256-bit-key
SESSION_SECRET=your-session-secret
JWT_SECRET=your-jwt-secret  # Must differ from SESSION_SECRET

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
REDIRECT_URI=http://localhost:5000/api/oauth/google/callback

# Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# Application
NODE_ENV=development
PORT=5000
\`\`\`

See `.env.example` for complete reference.

### Google Cloud Setup

1. **Create Project**: [Google Cloud Console](https://console.cloud.google.com)
2. **Enable APIs**:
   - Google Analytics Data API
   - Google Search Console API
   - Gemini AI API (via AI Studio)
3. **OAuth Credentials**:
   - Create OAuth 2.0 Client ID
   - Add authorized redirect URI: `http://localhost:5000/api/oauth/google/callback`
4. **Gemini API Key**: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)

## 💻 Development

### Available Scripts

\`\`\`bash
# Development
npm run dev              # Start dev server (frontend + backend)
npm run build            # Build for production
npm run start            # Start production server

# Database
npm run db:generate      # Generate migrations from schema
npm run db:push          # Push schema to database
npm run db:studio        # Open Drizzle Studio GUI
npm run db:seed          # Seed initial data

# Code Quality
npm run typecheck        # TypeScript type checking
npm run lint             # Lint code
\`\`\`

### Project Structure

\`\`\`
agency-portal/
├── client/              # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Route pages
│   │   ├── lib/         # Utilities
│   │   └── App.tsx      # Main app component
├── server/              # Backend (Express + Drizzle)
│   ├── routes.ts        # API routes
│   ├── storage.ts       # Database layer
│   ├── middleware/      # Auth, logging, error handling
│   ├── lib/             # OAuth, encryption, utilities
│   └── services/        # Business logic
├── shared/              # Shared types & schemas
│   └── schema.ts        # Drizzle schema definitions
├── .github/             # GitHub Actions workflows
├── docs/                # Documentation
└── drizzle/             # Database migrations
\`\`\`

### Tech Stack

**Frontend:**
- React 18 + TypeScript
- Wouter (routing)
- TanStack Query (state management)
- Tailwind CSS + Shadcn/UI
- Lucide React (icons)

**Backend:**
- Node.js + Express
- Drizzle ORM + PostgreSQL
- Supabase Auth
- Winston (logging)

**Integrations:**
- Google Gemini AI
- Google Analytics 4
- Google Search Console
- Data for SEO API
- Puppeteer (PDF generation)

## 🧪 Testing

\`\`\`bash
# Run tests (when configured)
npm test

# Run with coverage
npm run test:coverage

# E2E tests (when configured)
npm run test:e2e
\`\`\`

## 🚢 Deployment

### GitHub Actions CI/CD

Automated workflows are configured in `.github/workflows/`:

- **CI (`ci.yml`)**: Runs on PRs - linting, type-checking, tests
- **Deploy (`deploy.yml`)**: Runs on main branch - migrations, build, deployment

#### Setup GitHub Secrets:

\`\`\`bash
DATABASE_URL
SUPABASE_URL
SUPABASE_SERVICE_KEY
SUPABASE_ANON_KEY
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
ENCRYPTION_KEY
SESSION_SECRET
JWT_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GEMINI_API_KEY
REPLIT_TOKEN  # or RAILWAY_TOKEN, VERCEL_TOKEN
\`\`\`

### Manual Deployment

#### Option 1: Replit

1. Import repository to Replit
2. Configure Secrets
3. Click "Run"

#### Option 2: Railway/Render/Heroku

\`\`\`bash
# Build
npm run build

# Set environment variables on platform
# DATABASE_URL, SUPABASE_*, etc.

# Deploy
railway up
# or
render deploy
# or
git push heroku main
\`\`\`

#### Option 3: VPS/Docker

\`\`\`bash
# Build Docker image
docker build -t agency-portal .

# Run container
docker run -p 5000:5000 \\
  -e DATABASE_URL=... \\
  -e SUPABASE_URL=... \\
  agency-portal
\`\`\`

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure unique `JWT_SECRET` (≠ `SESSION_SECRET`)
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Configure production `REDIRECT_URI` for OAuth
- [ ] Run database migrations: `npm run db:push`
- [ ] Verify RLS policies are enabled
- [ ] Set up monitoring & alerting
- [ ] Configure backup strategy
- [ ] Update CORS settings for production domain
- [ ] Review rate limiting thresholds

## 📚 API Documentation

### OpenAPI/Swagger

Access interactive API documentation:

\`\`\`bash
# Development
http://localhost:5000/api-docs

# Production
https://your-domain.com/api-docs
\`\`\`

### Key Endpoints

#### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - User registration
- `POST /api/auth/logout` - User logout
- `GET /api/auth/user` - Get current user

#### Clients
- `GET /api/agency/clients` - List all clients
- `POST /api/agency/clients/create-user` - Create client user
- `GET /api/clients/:id` - Get client details

#### Projects & Tasks
- `GET /api/agency/projects` - List projects
- `POST /api/agency/projects` - Create project
- `GET /api/agency/tasks` - List tasks
- `POST /api/agency/tasks` - Create task

#### AI & Analytics
- `POST /api/ai/recommendations` - Generate AI recommendations
- `POST /api/ai/analyze-data` - Chat with data
- `GET /api/agency/metrics` - Get analytics metrics

See [API Documentation](./docs/API.md) for complete reference.

## 🗄️ Database Migrations

### Development Workflow

\`\`\`bash
# 1. Edit schema in shared/schema.ts

# 2. Generate migration
npm run db:generate

# 3. Apply migration
npm run db:push

# 4. Verify sync
npm run db:check
\`\`\`

### Production Migrations

Migrations run automatically via GitHub Actions on deployment.

For manual migration:

\`\`\`bash
export DATABASE_URL="postgresql://..."
npm run db:push
\`\`\`

**⚠️ Important**: Never change existing primary key ID types. See [Database Migrations Guide](./docs/DATABASE_MIGRATIONS.md).

## 🏗️ Architecture

### Multi-Tenancy

**Three-Layer Tenant Isolation:**

1. **Application Layer**: Middleware validates agency context
2. **Database Layer**: PostgreSQL RLS policies enforce row-level security
3. **Resource Layer**: Entity-specific access checks

### Security Model

- **Authentication**: Supabase Auth with session cookies
- **Authorization**: Role-based (Admin, Staff, Client) with resource-level checks
- **Encryption**: AES-256-GCM for sensitive data (OAuth tokens, API keys)
- **Rate Limiting**: Endpoint-specific limits (100/15min general, 5/15min auth, 20/hr AI)

### Data Flow

1. **Request** → Authentication middleware → Role/tenant validation
2. **Business Logic** → Zod validation → Storage layer
3. **Database** → RLS policy check → Encrypted data handling
4. **Response** → Structured JSON → Client

See [Architecture Documentation](./replit.md) for detailed design decisions.

## 🤝 Contributing

### Development Guidelines

1. **Create feature branch**: `git checkout -b feature/your-feature`
2. **Make changes** with proper TypeScript types
3. **Add tests** for new functionality
4. **Run checks**: `npm run typecheck && npm run lint`
5. **Submit PR** with clear description

### Code Standards

- **TypeScript**: Strict mode, no implicit any
- **Zod Validation**: All API inputs validated
- **Error Handling**: Use `ApiError` class, centralized middleware
- **Security**: Never expose secrets, always encrypt sensitive data
- **Documentation**: Update README/docs with significant changes

## 📄 License

MIT License - see [LICENSE](./LICENSE) file

## 🆘 Support

- **Documentation**: [/docs](./docs)
- **Issues**: [GitHub Issues](https://github.com/your-org/agency-portal/issues)
- **Email**: support@agencyportal.com

---

Built with ❤️ for agencies worldwide
