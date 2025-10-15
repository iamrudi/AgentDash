# Production URL Configuration

## Overview
The Forms API automatically adapts to use the correct URL based on your deployment environment.

## How It Works

### Development
In development, URLs automatically use your current domain:
```
http://localhost:5000/api/public/forms/{formId}
```

### Production
When deploying to production, URLs automatically adapt to your production domain:
```
https://your-app.replit.app/api/public/forms/{formId}
```

## Custom Domain Configuration

If you have a custom domain, you can override the automatic detection by setting the `VITE_PUBLIC_URL` environment variable.

### Steps to Configure Custom Domain:

1. **In Replit Secrets** (for production deployments):
   - Add secret: `VITE_PUBLIC_URL`
   - Value: `https://yourdomain.com` (without trailing slash)

2. **The URLs will automatically update** in:
   - API documentation
   - Embed codes
   - Code examples (cURL, JavaScript, PHP)

## Examples

### Default Behavior (No Configuration Needed)
```typescript
// Automatically uses current domain
const url = getPublicUrl(); // Returns: https://your-app.replit.app
```

### With Custom Domain
```bash
# Set environment variable
VITE_PUBLIC_URL=https://api.yourdomain.com
```

```typescript
// Now uses your custom domain
const url = getPublicUrl(); // Returns: https://api.yourdomain.com
```

## Supported Endpoints

All public form endpoints automatically use the configured URL:

- **Get Form Metadata**: `GET {publicUrl}/api/public/forms/{formId}`
- **Submit Form Data**: `POST {publicUrl}/api/public/forms/{formId}/submit`
- **Embed Form**: `{publicUrl}/forms/embed/{formId}`

## Testing

To verify URLs in your environment:

1. Navigate to Agency Portal → CRM → Forms
2. Click "API" on any form
3. Check the displayed URLs - they should match your configured domain

## Important Notes

- URLs are generated client-side using JavaScript
- No server restart needed when changing `VITE_PUBLIC_URL`
- The environment variable must be prefixed with `VITE_` to be accessible in the frontend
- Remove trailing slashes from the URL value
