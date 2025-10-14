# Production Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Variables

#### Required Secrets (Must be set):
```bash
# Database
DATABASE_URL=postgresql://...  # PostgreSQL connection string

# Authentication & Sessions
SESSION_SECRET=<32-byte-base64-secret>  # For session management
JWT_SECRET=<32-byte-base64-secret>      # MUST be different from SESSION_SECRET

# Encryption
ENCRYPTION_KEY=<32-byte-base64-secret>  # For OAuth token encryption

# Supabase
SUPABASE_URL=https://...
SUPABASE_SERVICE_KEY=...
SUPABASE_ANON_KEY=...

# Google OAuth (for GA4 & GSC integrations)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
REDIRECT_URI=https://yourdomain.com/api/oauth/google/callback

# Google Gemini AI
GEMINI_API_KEY=...
```

#### Generate Secure Secrets:
```bash
# Generate JWT_SECRET (must be different from SESSION_SECRET)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Generate SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Generate ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 2. Critical Security Requirements

#### JWT_SECRET Configuration
- **PRODUCTION**: JWT_SECRET MUST be set and MUST be different from SESSION_SECRET
- **DEVELOPMENT**: JWT_SECRET falls back to SESSION_SECRET with warning
- **Why**: Prevents credential leakage and enables independent secret rotation

#### Row-Level Security (RLS)
Before deploying to production, verify RLS is enabled:

```sql
-- Check RLS is enabled on all tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('agencies', 'profiles', 'clients', 'projects', 'tasks', 'invoices', 'initiatives', 'clientIntegrations', 'metrics')
ORDER BY tablename;

-- All tables should show rowsecurity = t (true)
```

#### Verify Agency ID in JWT
All users must have `agency_id` in their JWT `app_metadata`:

```sql
-- Check all users have agency_id in JWT
SELECT 
  email,
  raw_app_meta_data->>'agency_id' as agency_id_in_jwt
FROM auth.users
ORDER BY email;

-- All users should show a UUID in agency_id_in_jwt column
```

### 3. Database Setup

#### Run Migrations (if needed)
```bash
npm run db:push
```

#### Verify Helper Functions
```sql
-- Verify RLS helper functions exist
SELECT routine_name, routine_schema 
FROM information_schema.routines 
WHERE routine_name IN ('get_agency_id', 'is_authenticated')
  AND routine_schema = 'auth';

-- Should return 2 rows
```

### 4. Security Validation

#### Tenant Isolation
The following middleware functions enforce tenant isolation:
- `requireClientAccess(storage)` - Validates client access
- `requireProjectAccess(storage)` - Validates project access via client
- `requireTaskAccess(storage)` - Validates task access via project → client
- `requireInitiativeAccess(storage)` - Validates initiative access via client
- `requireInvoiceAccess(storage)` - Validates invoice access via client

**Protected Routes:**
- `/api/agency/projects/:id` - GET, PATCH
- `/api/agency/tasks/:id` - PATCH, DELETE, assign operations
- `/api/invoices/:invoiceId/*` - All invoice operations
- `/api/initiatives/:id/*` - All initiative operations

#### Staff Authorization
- Staff users have agency-scoped read access to clients
- Staff cannot access clients from other agencies
- Staff cannot modify sensitive data (invoices, billing)

### 5. External Integrations

#### Google OAuth (GA4 & Search Console)
- **Rate Limiting**: Per-client hourly/daily quotas enforced
- **Retry Logic**: Exponential backoff with jitter (3 attempts: 1s→2s→4s)
- **Error Handling**: User-friendly messages for all Google API errors
- **Token Storage**: Encrypted with AES-256-GCM

#### Data for SEO API
- **Credential Storage**: Encrypted in `clientIntegrations` table
- **Decryption**: Requires ENCRYPTION_KEY environment variable

#### Google Gemini AI
- **API Key**: GEMINI_API_KEY environment variable required
- **Models Used**: `gemini-2.0-flash-exp` (fast), `gemini-2.5-pro` (strategic)
- **Error Handling**: All AI calls wrapped in try-catch

### 6. Production Environment Settings

```bash
# Set NODE_ENV to production
NODE_ENV=production

# This triggers:
# - JWT_SECRET requirement (no fallback to SESSION_SECRET)
# - Production-optimized builds
# - Proper error handling
```

### 7. Monitoring & Logging

#### Log Files to Monitor:
- Application logs (stdout/stderr)
- Rate limit warnings: `[Google API Retry]` messages
- Authentication failures: `[AUTH]` messages
- Encryption errors: `Encryption key validation failed`

#### Key Metrics:
- Google API quota usage (hourly/daily per client)
- Failed authentication attempts
- Cross-agency access attempts (should be 0)
- Token refresh failures

### 8. Deployment Checklist

- [ ] Set NODE_ENV=production
- [ ] Configure JWT_SECRET (separate from SESSION_SECRET)
- [ ] Configure ENCRYPTION_KEY (32-byte base64)
- [ ] Configure DATABASE_URL (PostgreSQL)
- [ ] Configure Supabase credentials (URL, service key, anon key)
- [ ] Configure Google OAuth credentials
- [ ] Configure GEMINI_API_KEY
- [ ] Verify RLS policies are enabled on all tables
- [ ] Verify all users have agency_id in JWT app_metadata
- [ ] Run database migrations (`npm run db:push`)
- [ ] Test tenant isolation (admin cannot access other agency's data)
- [ ] Test staff authorization (staff can access agency clients)
- [ ] Verify Google API rate limiting is working
- [ ] Set up SSL/TLS certificates
- [ ] Configure REDIRECT_URI for production domain

### 9. Security Testing

#### Test Cross-Agency Isolation:
1. Create two agencies with separate admins
2. Attempt to access resources from Agency A using Agency B admin
3. Verify all requests return 403 Forbidden
4. Check logs for isolation warnings

#### Test Staff Access:
1. Create staff user in Agency A
2. Verify staff can view clients in Agency A
3. Verify staff cannot access clients in Agency B
4. Verify staff cannot modify invoices or billing

### 10. Backup & Recovery

#### Critical Data:
- PostgreSQL database (all tables)
- Encrypted OAuth tokens (clientIntegrations table)
- Generated invoice PDFs (`public/invoices/`)

#### Recovery Process:
1. Restore database from backup
2. Ensure ENCRYPTION_KEY matches original (required to decrypt tokens)
3. Restore invoice PDF files
4. Restart application

### 11. Common Issues & Solutions

#### "JWT_SECRET must be set in production"
**Solution**: Set JWT_SECRET environment variable (different from SESSION_SECRET)

#### "Encryption key validation failed"
**Solution**: Ensure ENCRYPTION_KEY is exactly 32 bytes (base64-encoded)

#### "Access denied to this client's resources"
**Solution**: User trying to access resource from different agency - check tenant isolation

#### "Google API quota exceeded"
**Solution**: Rate limiting is working - user needs to wait or quota needs to be increased

#### "RLS policy violation"
**Solution**: Database-level isolation blocked the request - verify user's agency_id in JWT

## Support & Troubleshooting

For production issues:
1. Check application logs for error messages
2. Verify environment variables are set correctly
3. Confirm RLS policies are enabled
4. Test tenant isolation with cross-agency access attempts
5. Monitor Google API quota usage

## Security Audit Results

✅ **Tenant Isolation**: All resource routes protected with middleware
✅ **Staff Authorization**: Agency-scoped access implemented
✅ **JWT Security**: Separate secrets required in production
✅ **Encryption**: AES-256-GCM for sensitive data
✅ **RLS Policies**: Database-level isolation active
✅ **Rate Limiting**: Per-client quotas enforced
✅ **Error Handling**: All async operations wrapped in try-catch

**Production Ready**: All critical security vulnerabilities have been addressed.
