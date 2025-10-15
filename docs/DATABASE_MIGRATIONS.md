# Database Migrations Guide

## Overview

This project uses **Drizzle ORM** with **PostgreSQL** (Supabase) for database management. The database includes Row-Level Security (RLS) policies for tenant isolation and security.

## Database Architecture

### Multi-Tenancy & Security
- **Tenant Isolation**: Every table includes `agency_id` for multi-tenant data separation
- **Row-Level Security (RLS)**: PostgreSQL RLS policies enforce tenant isolation at the database level
- **Defense-in-Depth**: Application-layer middleware + database-layer RLS policies

### Key Tables
- `profiles` - User authentication records (matches Supabase Auth user IDs)
- `clients` - Company/client records with agency association
- `projects` - Client projects
- `tasks` - Project tasks
- `strategic_initiatives` - AI-generated recommendations
- `invoices` & `invoice_line_items` - Billing management
- `daily_metrics` - GA4/GSC analytics data
- `client_integrations` - OAuth tokens (encrypted)
- `agency_integrations` - Agency-level integrations
- `chat_messages` - Real-time chat messages

## Migration Workflow

### Development (Local/Replit)

#### 1. Schema Changes
Edit the schema in `shared/schema.ts`:

\`\`\`typescript
// Example: Add new field
export const clients = pgTable("clients", {
  // ... existing fields
  website: text("website"), // New field
});
\`\`\`

#### 2. Generate Migration
\`\`\`bash
npm run db:generate
\`\`\`

This creates a new migration file in `drizzle/` directory.

#### 3. Apply Migration
\`\`\`bash
npm run db:push
\`\`\`

If issues occur:
\`\`\`bash
npm run db:push --force
\`\`\`

**⚠️ CRITICAL: Never change existing primary key ID types (serial ↔ varchar/uuid). This breaks existing data.**

#### 4. Verify Schema Sync
\`\`\`bash
npm run db:check
\`\`\`

### Production Deployment

#### Option 1: Automated CI/CD Migration
GitHub Actions automatically runs migrations on deployment:

\`\`\`yaml
- name: Run Database Migrations
  run: npm run db:push
  env:
    DATABASE_URL: \${{ secrets.DATABASE_URL }}
\`\`\`

#### Option 2: Manual Migration
1. Connect to production database:
   \`\`\`bash
   export DATABASE_URL="postgresql://..."
   npm run db:push
   \`\`\`

2. Verify migration success:
   \`\`\`bash
   npm run db:check
   \`\`\`

## Row-Level Security (RLS)

### Enabling RLS on New Tables

When adding a new table, you **must** enable RLS:

\`\`\`sql
-- Enable RLS
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- Create policy for agency isolation
CREATE POLICY "agency_isolation_policy" ON new_table
  USING (agency_id = (auth.jwt() -> 'app_metadata' ->> 'agency_id')::uuid);

-- Create policy for service role (bypass for server operations)
CREATE POLICY "service_role_policy" ON new_table
  USING (auth.role() = 'service_role');
\`\`\`

### Verifying RLS Policies

\`\`\`sql
-- Check enabled RLS tables
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true;

-- List policies for a table
SELECT * FROM pg_policies WHERE tablename = 'clients';
\`\`\`

## Schema Sync Strategy

### Development → Production

1. **Test migrations locally** using development database
2. **Commit schema changes** and migration files to Git
3. **Deploy via CI/CD** which auto-runs migrations
4. **Verify production** schema matches expected state

### Rollback Strategy

If migration fails in production:

1. **Immediate rollback**:
   \`\`\`bash
   # Restore from Supabase backup
   # Or manually revert migration SQL
   \`\`\`

2. **Fix schema** in development
3. **Generate new migration**
4. **Test thoroughly** before redeploying

## Best Practices

### DO ✅
- Always test migrations in development first
- Use `npm run db:generate` to create migration files
- Add RLS policies to all new tables
- Include rollback SQL in migration comments
- Back up production database before major schema changes
- Use `npm run db:push --force` only when necessary

### DON'T ❌
- Never change primary key ID types in existing tables
- Don't write manual SQL migrations (use Drizzle)
- Don't skip RLS policies on multi-tenant tables
- Don't deploy untested migrations to production
- Don't delete migration files from version control
- Don't use `--force` flag in production CI/CD

## Troubleshooting

### Migration Conflicts
\`\`\`bash
# View current schema state
npm run db:introspect

# Force sync (use cautiously)
npm run db:push --force
\`\`\`

### RLS Policy Errors
\`\`\`sql
-- Temporarily disable RLS for debugging (development only!)
ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;

-- Re-enable after fixing
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
\`\`\`

### Connection Issues
- Verify `DATABASE_URL` environment variable
- Check Supabase connection pooler settings
- Ensure SSL mode is correct: `?sslmode=require`

## Useful Commands

\`\`\`bash
# Generate migration from schema changes
npm run db:generate

# Push schema to database
npm run db:push

# Force push (careful!)
npm run db:push --force

# Open Drizzle Studio (GUI)
npm run db:studio

# Check schema sync status
npm run db:check
\`\`\`

## Additional Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
