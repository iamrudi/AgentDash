# Security Policy

## Supported Versions

We release security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please follow these steps:

### 1. Do NOT Open a Public Issue

**Never** report security vulnerabilities through public GitHub issues, discussions, or pull requests.

### 2. Report Privately

Send a detailed report to: **security@agencyportal.com**

Include in your report:
- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Suggested fix (if you have one)
- Your contact information

### 3. Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 5 business days
- **Status Update**: Within 10 business days
- **Resolution**: Depends on severity (typically 30-90 days)

### 4. Disclosure Policy

We follow **coordinated disclosure**:

1. You report the vulnerability privately
2. We confirm and assess the issue
3. We develop and test a fix
4. We release the security patch
5. We publish a security advisory (with credit to you, if desired)
6. You may publicly disclose after patch release

## Security Best Practices

### For Users

#### Environment Variables

- **Never commit** `.env` files to version control
- Generate strong secrets:
  \`\`\`bash
  openssl rand -hex 32
  \`\`\`
- Use different values for `SESSION_SECRET` and `JWT_SECRET`
- Use minimum 256-bit encryption keys (64 hex characters)

#### Database Security

- Enable SSL/TLS for database connections
- Use Row-Level Security (RLS) policies
- Regularly backup your database
- Limit database user permissions

#### API Keys & OAuth

- Rotate API keys regularly (every 90 days recommended)
- Use separate credentials for development/production
- Restrict OAuth redirect URIs to your domains
- Monitor OAuth usage for anomalies

#### Network Security

- Always use HTTPS in production
- Configure proper CORS settings
- Use secure cookies (`secure: true, httpOnly: true`)
- Implement rate limiting (already configured)

### For Developers

#### Authentication & Authorization

- **Multi-tenant isolation**: Enforce agency-level data segregation
- **Role-based access**: Validate user roles on every request
- **Session management**: Use secure session configuration
- **Password security**: Use bcrypt with appropriate cost factor

#### Input Validation

- **Always validate**: Use Zod schemas for all inputs
- **Sanitize outputs**: Prevent XSS attacks
- **Parameterized queries**: Use Drizzle ORM (prevents SQL injection)
- **File uploads**: Validate file types and sizes

#### Encryption

- **Sensitive data**: Encrypt using AES-256-GCM
- **Passwords**: Hash with bcrypt (never store plaintext)
- **Tokens**: Use secure random generation
- **Transport**: Always use HTTPS/TLS

#### Dependencies

- **Regular updates**: Run `npm audit` weekly
- **Automated scanning**: Use Dependabot or similar tools
- **Review changes**: Check changelogs before updating
- **Lock files**: Commit package-lock.json

#### Error Handling

- **Never expose**: Don't leak sensitive info in errors
- **Log properly**: Use structured logging (Winston)
- **Fail securely**: Default to deny on errors

## Security Features

### Current Implementation

#### Multi-Tenant Security

- **Row-Level Security (RLS)**: Database-level tenant isolation
- **Middleware checks**: Application-level validation
- **JWT context**: Agency ID in secure token metadata

#### Encryption

- **Algorithm**: AES-256-GCM
- **Key management**: Environment-based keys
- **Encrypted fields**: OAuth tokens, API keys, sensitive client data

#### Rate Limiting

- **General API**: 100 requests / 15 minutes
- **Authentication**: 5 requests / 15 minutes
- **API routes**: 60 requests / minute
- **AI endpoints**: 20 requests / hour

#### Logging & Monitoring

- **Request logging**: Every API call tracked
- **Error tracking**: Comprehensive error logging
- **Audit trail**: Database changes logged
- **Security events**: Failed auth attempts logged

#### Headers & CORS

- **Helmet.js**: Security headers configured
- **CORS**: Restricted to allowed origins
- **CSP**: Content Security Policy enabled
- **HSTS**: HTTP Strict Transport Security

### Planned Enhancements

- [ ] Two-factor authentication (2FA)
- [ ] IP allowlisting/blocklisting
- [ ] Advanced anomaly detection
- [ ] Automated security scanning in CI/CD
- [ ] Security information and event management (SIEM)

## Operational Security Procedures

### ENCRYPTION_KEY Rotation

⚠️ **CRITICAL**: Changing the ENCRYPTION_KEY renders all existing encrypted data unreadable. Follow this procedure carefully to prevent data loss.

#### When to Rotate

Rotate the ENCRYPTION_KEY in these scenarios:
- Suspected key compromise or exposure
- Security audit recommendation
- Quarterly/annual security maintenance
- Before major production deployment (planned migration)
- Employee with key access departures

#### Pre-Rotation Checklist

1. **Backup Database**
   ```bash
   # Create full database backup
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Schedule Maintenance Window**
   - Notify all users of downtime
   - Plan for 30-60 minutes of downtime
   - Schedule during low-traffic hours

3. **Document Current Key**
   - Store current ENCRYPTION_KEY in secure password manager
   - Label with date and version (e.g., "ENCRYPTION_KEY_2025_Q4")
   - Keep until migration is verified successful

4. **Generate New Key**
   ```bash
   # Generate new 32-byte key (base64-encoded, 44 chars)
   node -e "console.log(crypto.randomBytes(32).toString('base64'))"
   ```

#### Migration Steps

1. **Test in Development First**
   ```bash
   # Development environment
   OLD_KEY="your-old-key-here==" 
   NEW_KEY="your-new-key-here=="
   
   # Run migration script
   tsx scripts/migrate-encryption-key.ts "$OLD_KEY" "$NEW_KEY"
   ```

2. **Verify Development Migration**
   - Test all integrations (GA4, GSC, DataForSEO)
   - Verify OAuth flows work correctly
   - Check all encrypted credentials decrypt properly
   - Run comprehensive test suite

3. **Production Migration**
   ```bash
   # PRODUCTION - during maintenance window
   
   # Step 1: Stop all application instances
   # (Replit: stop workflow, VPS: stop services)
   
   # Step 2: Run migration with OLD and NEW keys
   tsx scripts/migrate-encryption-key.ts "$OLD_ENCRYPTION_KEY" "$NEW_ENCRYPTION_KEY"
   
   # Step 3: Update environment variable
   # Set ENCRYPTION_KEY to NEW_ENCRYPTION_KEY
   
   # Step 4: Restart application
   # (Replit: start workflow, VPS: start services)
   ```

4. **Post-Migration Verification**
   - [ ] Test user login functionality
   - [ ] Verify GA4 data sync works
   - [ ] Verify GSC data sync works
   - [ ] Test DataForSEO API calls
   - [ ] Check Content Co-pilot features
   - [ ] Review application logs for decryption errors
   - [ ] Monitor for 24 hours

5. **Rollback Procedure (if migration fails)**
   ```bash
   # Step 1: Stop application
   
   # Step 2: Restore database from backup
   psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql
   
   # Step 3: Restore OLD_ENCRYPTION_KEY
   # Set ENCRYPTION_KEY back to old value
   
   # Step 4: Restart application
   ```

#### Affected Database Tables

The migration script automatically handles these tables:

| Table | Encrypted Fields |
|-------|-----------------|
| `client_integrations` | `access_token`, `refresh_token`, `dataforseo_login`, `dataforseo_password` |
| `agency_integrations` | `dataforseo_login`, `dataforseo_password` |

Each encrypted field has associated `_iv` and `_auth_tag` fields for AES-256-GCM encryption.

#### Migration Script Usage

```bash
# Script location: scripts/migrate-encryption-key.ts

# Basic usage
tsx scripts/migrate-encryption-key.ts <OLD_KEY> <NEW_KEY>

# Example
tsx scripts/migrate-encryption-key.ts "abc123old==" "xyz789new=="

# What it does:
# 1. Validates both keys (must be 32 bytes)
# 2. Decrypts all credentials with OLD_KEY
# 3. Re-encrypts all credentials with NEW_KEY
# 4. Updates database records
# 5. Reports migration statistics
```

#### Common Issues & Solutions

**Issue**: "Decryption failed: Unsupported state or unable to authenticate data"
- **Cause**: Wrong OLD_KEY provided or credentials corrupted
- **Solution**: Verify OLD_KEY matches current ENCRYPTION_KEY, restore from backup if needed

**Issue**: Migration script shows "Failed: X" credentials
- **Cause**: Some credentials were already corrupted or encrypted with different key
- **Solution**: These credentials must be manually re-entered via Settings UI

**Issue**: Application shows "credential not configured" after migration
- **Cause**: NEW_ENCRYPTION_KEY not updated in environment variables
- **Solution**: Update ENCRYPTION_KEY to NEW_KEY and restart application

#### Security Best Practices

- **Never** commit encryption keys to version control
- **Never** share encryption keys via email or chat
- **Always** use secure password managers for key storage
- **Always** test migration in development first
- **Always** maintain database backups before rotation
- **Document** all key rotations in security log

#### Emergency Key Rotation

If key compromise is suspected:

1. **Immediate Actions** (< 1 hour)
   - Revoke all active sessions
   - Generate new ENCRYPTION_KEY
   - Stop application to prevent further exposure

2. **Data Assessment** (< 4 hours)
   - Identify which credentials were potentially exposed
   - Contact affected integration providers (Google, DataForSEO)
   - Rotate all OAuth tokens and API keys

3. **Recovery** (< 24 hours)
   - Run migration with old (compromised) and new keys
   - Force all users to re-authenticate
   - Audit all API access logs
   - Notify affected clients if required

4. **Post-Incident** (< 1 week)
   - Document incident in security log
   - Review and update access controls
   - Implement additional monitoring
   - Security team debrief

## Known Security Considerations

### Google OAuth Tokens

- Stored encrypted in database
- Automatic refresh implemented
- Rate limiting prevents token abuse

### Data for SEO API

- Client-level credentials stored encrypted
- Per-client quota enforcement
- No cross-client data leakage

### AI Processing

- Input sanitization before Gemini API
- Output validation after generation
- Rate limiting per user/client

## Compliance

### Data Protection

- **GDPR**: User data deletion capabilities
- **Data retention**: Configurable retention policies
- **Encryption**: At-rest and in-transit encryption

### Access Control

- **Principle of least privilege**: Minimal permissions
- **Separation of duties**: Role-based access
- **Audit logging**: Comprehensive activity logs

## Security Contacts

- **Primary**: security@agencyportal.com
- **PGP Key**: Available at https://agencyportal.com/.well-known/pgp-key.txt
- **Bug Bounty**: Coming soon

## Acknowledgments

We appreciate the security research community and will acknowledge researchers who report vulnerabilities responsibly:

- **Hall of Fame**: Public recognition (with permission)
- **Swag**: Agency Portal merchandise
- **Rewards**: Case-by-case basis for critical findings

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Supabase Security](https://supabase.com/docs/guides/platform/going-into-prod#security)
- [Database Security Checklist](https://www.postgresql.org/docs/current/security.html)

---

Last updated: October 2025

Thank you for helping keep Agency Client Portal secure! 🔒
