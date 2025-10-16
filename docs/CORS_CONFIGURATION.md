# CORS Configuration Guide

## Overview
Cross-Origin Resource Sharing (CORS) is configured to allow external websites to securely interact with your public API endpoints, such as form submissions and form metadata retrieval.

## How It Works

The Agency Client Portal uses a **whitelist-based CORS policy** with automatic same-origin allowance for maximum security:

- **Same-Origin Allowed**: Requests from the current domain (localhost, Replit, or production) are automatically allowed
- **Whitelist Origins**: Domains explicitly listed in `CORS_ALLOWED_ORIGINS` can make API requests
- **Blocked Origins**: All other domains receive a CORS error and cannot access the API
- **No Origin**: Requests without an origin (mobile apps, curl, Postman) are allowed

### Security Features

The implementation uses **strict URL parsing and exact hostname comparison** to prevent bypass attacks:
- Origins are parsed using `new URL(origin)` for secure validation
- Hostname and port are compared exactly (no substring matching)
- Malicious domains like `https://trusted.com.evil.com` are correctly blocked

## Configuration

### Environment Variable

Set the `CORS_ALLOWED_ORIGINS` environment variable with a comma-separated list of allowed domains:

```bash
# .env
CORS_ALLOWED_ORIGINS=http://localhost:5000,http://localhost:5173,https://example.com,https://www.example.com
```

### Default Configuration

The default configuration (if not set) allows:
- `http://localhost:5000` (development server)
- `http://localhost:5173` (Vite dev server)

### Production Configuration

When deploying to production, update `CORS_ALLOWED_ORIGINS` to include:

1. **Your production domain(s)**:
   ```bash
   CORS_ALLOWED_ORIGINS=https://your-app.replit.app,https://yourdomain.com,https://www.yourdomain.com
   ```

2. **Client websites** where forms are embedded:
   ```bash
   CORS_ALLOWED_ORIGINS=https://your-app.replit.app,https://client1.com,https://client2.com
   ```

### 1. Secure URL Parsing
- All origins are validated using `new URL(origin)` for proper parsing
- Invalid origins are immediately rejected
- Prevents malicious URL crafting attacks

### 2. Same-Origin Auto-Allowance
- Automatically allows requests from the current domain
- Built from: `localhost:{PORT}`, `VITE_PUBLIC_URL`, and `REPLIT_DOMAINS`
- Uses strict hostname:port comparison (no substring matching)
- Secure against bypass attacks like `https://trusted.com.evil.com`

### 3. Dynamic Whitelist
- Origins are checked against the whitelist on every request
- Unauthorized origins are automatically blocked

### 4. Request Logging
- Blocked origins are logged with a warning:
  ```
  [CORS] Blocked request from unauthorized origin: https://malicious-site.com
  ```

### 5. Credentials Support
- Cookies and authentication headers are supported for whitelisted origins
- `credentials: true` is enabled for secure cross-origin authentication

### 6. Legacy Browser Support
- `optionsSuccessStatus: 200` ensures compatibility with older browsers (IE11, SmartTVs)

## Common Use Cases

### 1. Single Production Domain
```bash
CORS_ALLOWED_ORIGINS=https://your-app.replit.app
```

### 2. Multiple Domains (with/without www)
```bash
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### 3. Multiple Client Websites
```bash
CORS_ALLOWED_ORIGINS=https://client1.com,https://www.client1.com,https://client2.com
```

### 4. Development + Production
```bash
CORS_ALLOWED_ORIGINS=http://localhost:5000,http://localhost:5173,https://your-app.replit.app
```

## Adding a New Domain

To allow a new website to embed your forms or access your API:

1. **Add the domain** to `CORS_ALLOWED_ORIGINS`:
   ```bash
   # Before
   CORS_ALLOWED_ORIGINS=https://your-app.replit.app
   
   # After
   CORS_ALLOWED_ORIGINS=https://your-app.replit.app,https://newclient.com
   ```

2. **Restart the server** (on Replit, the deployment will automatically restart)

3. **Test the integration** by embedding a form on the new domain

## Troubleshooting

### CORS Error in Browser Console

**Error Message:**
```
Access to fetch at 'https://your-api.com/api/public/forms/123' from origin 'https://client.com' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```

**Solution:**
1. Add `https://client.com` to `CORS_ALLOWED_ORIGINS`
2. Ensure there are no typos (including `http` vs `https`, `www` vs no `www`)
3. Check server logs for `[CORS] Blocked request` messages
4. Restart the server after updating environment variables

### Preflight Request Failures

**Symptoms:**
- OPTIONS requests fail
- POST/PUT/DELETE requests blocked

**Solution:**
- Ensure the domain is added to `CORS_ALLOWED_ORIGINS`
- Verify `optionsSuccessStatus: 200` is configured (already set by default)

### Wildcard Origin (Not Recommended)

For testing purposes only, you can allow all origins:

```bash
# ⚠️ NEVER USE IN PRODUCTION
CORS_ALLOWED_ORIGINS=*
```

⚠️ **Security Warning**: This allows ANY website to access your API. Only use for local testing.

## Implementation Details

### Middleware Location
CORS middleware is configured in `server/index.ts`:

```typescript
app.use(cors(corsOptions));
```

### Validation Function
```typescript
origin: (origin, callback) => {
  // Allow requests with no origin (mobile apps, curl)
  if (!origin) {
    return callback(null, true);
  }

  // Check whitelist
  if (env.CORS_ALLOWED_ORIGINS.includes(origin)) {
    callback(null, true);
  } else {
    console.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  }
}
```

### Environment Parsing
The `CORS_ALLOWED_ORIGINS` string is parsed in `server/env.ts`:

```typescript
CORS_ALLOWED_ORIGINS: z.string()
  .default('http://localhost:5000,http://localhost:5173')
  .transform((val) => val.split(',').map(origin => origin.trim()))
```

## Best Practices

1. **Always use HTTPS** in production domains
2. **Include both www and non-www** versions if your client uses both
3. **Keep the whitelist minimal** - only add domains you control or trust
4. **Monitor logs** for blocked requests to identify legitimate domains that need to be added
5. **Test thoroughly** before deploying to production
6. **Document client domains** in your deployment notes

## Related Documentation
- [Production URL Configuration](./PRODUCTION_URLS.md)
- [Forms API Documentation](../README.md)
- [Security Best Practices](./SECURITY.md)
