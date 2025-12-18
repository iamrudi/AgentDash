import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, type AuthRequest } from "../middleware/supabase-auth";
import { getAuthUrl, exchangeCodeForTokens } from "../lib/googleOAuth";
import { generateOAuthState, verifyOAuthState } from "../lib/oauthState";

const router = Router();

router.get("/google/initiate", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const profile = await storage.getProfileByUserId(req.user!.id);
    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    const service = req.query.service as 'GA4' | 'GSC';
    if (!service || (service !== 'GA4' && service !== 'GSC')) {
      return res.status(400).json({ message: "service query parameter must be 'GA4' or 'GSC'" });
    }

    let returnTo = req.query.returnTo as string;
    
    const defaultReturnTo = (profile.role === "Admin" || profile.role === "SuperAdmin") 
      ? "/agency/integrations" 
      : "/client";
    
    if (returnTo) {
      returnTo = returnTo.trim();
      
      if (!returnTo.startsWith('/') || returnTo.startsWith('//') || returnTo.includes('://')) {
        console.warn(`[OAuth Security] Rejected unsafe returnTo: ${returnTo}`);
        returnTo = defaultReturnTo;
      }
    } else {
      returnTo = defaultReturnTo;
    }

    let clientId: string;
    
    if (profile.role === "Admin" || profile.role === "SuperAdmin") {
      const targetClientId = req.query.clientId as string;
      if (!targetClientId) {
        return res.status(400).json({ message: "clientId query parameter required for Admin/SuperAdmin" });
      }
      clientId = targetClientId;
    } else if (profile.role === "Client") {
      const client = await storage.getClientByProfileId(profile.id);
      if (!client) {
        return res.status(404).json({ message: "Client record not found" });
      }
      clientId = client.id;
    } else {
      return res.status(403).json({ message: "Only Admin, SuperAdmin, and Client can initiate OAuth" });
    }

    const popup = req.query.popup === 'true';
    const origin = popup ? req.get('origin') || req.get('referer')?.split('/').slice(0, 3).join('/') : undefined;

    const state = generateOAuthState(clientId, profile.role, service, returnTo, popup, origin);

    const authUrl = getAuthUrl(state, service);
    res.json({ authUrl });
  } catch (error: any) {
    console.error("OAuth initiation error:", error);
    res.status(500).json({ message: error.message || "OAuth initiation failed" });
  }
});

router.get("/google/callback", async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`/client?oauth_error=${encodeURIComponent(error as string)}`);
    }

    if (!code || !state) {
      return res.redirect('/client?oauth_error=missing_parameters');
    }

    let stateData;
    try {
      stateData = verifyOAuthState(state as string);
    } catch (error: any) {
      console.error("State verification failed:", error.message);
      return res.redirect(`/client?oauth_error=invalid_state`);
    }
    
    const { clientId, service, returnTo: stateReturnTo } = stateData;

    let returnTo = stateReturnTo;
    const defaultReturnTo = (stateData.initiatedBy === "Admin" || stateData.initiatedBy === "SuperAdmin") 
      ? "/agency/integrations" 
      : "/client";
    
    if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//') || returnTo.includes('://')) {
      console.warn(`[OAuth Security] Invalid returnTo in callback, using fallback: ${returnTo}`);
      returnTo = defaultReturnTo;
    }

    const tokens = await exchangeCodeForTokens(code as string);

    const serviceName = service;
    const existing = await storage.getIntegrationByClientId(clientId, serviceName);
    
    if (existing) {
      await storage.updateIntegration(existing.id, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken || existing.refreshToken,
        expiresAt: tokens.expiresAt,
      });
    } else {
      await storage.createIntegration({
        clientId,
        serviceName,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      });
    }

    if (stateData.popup && stateData.origin) {
      const htmlResponse = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="referrer" content="no-referrer">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; connect-src 'self';">
  <title>OAuth Success</title>
</head>
<body>
  <script>
    (function() {
      if (!window.opener) {
        document.body.innerHTML = '<h1>OAuth Complete</h1><p>You can close this window.</p>';
        return;
      }
      
      try {
        window.opener.postMessage({
          type: 'GOOGLE_OAUTH_SUCCESS',
          clientId: ${JSON.stringify(clientId)},
          service: ${JSON.stringify(service)}
        }, ${JSON.stringify(stateData.origin)});
        
        setTimeout(function() {
          window.close();
        }, 100);
      } catch (e) {
        console.error('Failed to post message:', e);
        document.body.innerHTML = '<h1>OAuth Complete</h1><p>You can close this window.</p>';
      }
    })();
  </script>
  <p>OAuth successful. Closing window...</p>
</body>
</html>`;
      return res.type('text/html').send(htmlResponse);
    }

    const separator = returnTo.includes('?') ? '&' : '?';
    res.redirect(`${returnTo}${separator}success=google_connected&clientId=${clientId}&service=${service}`);
  } catch (error: any) {
    console.error("OAuth callback error:", error);
    
    let stateData;
    try {
      stateData = verifyOAuthState(req.query.state as string);
    } catch (e) {
      return res.redirect(`/client?oauth_error=${encodeURIComponent(error.message)}`);
    }
    
    if (stateData?.popup && stateData?.origin) {
      const htmlResponse = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="referrer" content="no-referrer">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; connect-src 'self';">
  <title>OAuth Error</title>
</head>
<body>
  <script>
    (function() {
      if (!window.opener) {
        document.body.innerHTML = '<h1>OAuth Error</h1><p>${error.message || 'Authentication failed'}. You can close this window.</p>';
        return;
      }
      
      try {
        window.opener.postMessage({
          type: 'GOOGLE_OAUTH_ERROR',
          error: ${JSON.stringify(error.message || 'Authentication failed')}
        }, ${JSON.stringify(stateData.origin)});
        
        setTimeout(function() {
          window.close();
        }, 100);
      } catch (e) {
        console.error('Failed to post message:', e);
        document.body.innerHTML = '<h1>OAuth Error</h1><p>You can close this window.</p>';
      }
    })();
  </script>
  <p>OAuth failed. Closing window...</p>
</body>
</html>`;
      return res.type('text/html').send(htmlResponse);
    }
    
    res.redirect(`/client?oauth_error=${encodeURIComponent(error.message)}`);
  }
});

export default router;
