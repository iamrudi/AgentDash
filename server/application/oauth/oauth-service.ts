import type { IStorage } from "../../storage";
import { exchangeCodeForTokens, getAuthUrl } from "../../lib/googleOAuth";
import { generateOAuthState, verifyOAuthState } from "../../lib/oauthState";

type OAuthServiceName = "GA4" | "GSC";

type OAuthStateData = {
  clientId: string;
  initiatedBy: string;
  service: OAuthServiceName;
  returnTo: string;
  popup?: boolean;
  origin?: string;
};

interface OAuthDeps {
  getAuthUrl: (state: string, service: OAuthServiceName) => string;
  exchangeCodeForTokens: (code: string) => Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date | string | null;
  }>;
  generateOAuthState: (
    clientId: string,
    role: string,
    service: OAuthServiceName,
    returnTo: string,
    popup?: boolean,
    origin?: string
  ) => string;
  verifyOAuthState: (state: string) => OAuthStateData;
}

const defaultDeps: OAuthDeps = {
  getAuthUrl,
  exchangeCodeForTokens,
  generateOAuthState,
  verifyOAuthState,
};

export interface OAuthResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

type OAuthCallbackAction =
  | { kind: "redirect"; location: string }
  | { kind: "html"; html: string };

function asString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

function sanitizeReturnTo(returnTo: string | undefined, fallback: string): string {
  if (!returnTo) return fallback;
  const trimmed = returnTo.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("://")) {
    return fallback;
  }
  return trimmed;
}

function popupSuccessHtml(clientId: string, service: OAuthServiceName, origin: string): string {
  return `
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
        window.opener.postMessage({ type: 'GOOGLE_OAUTH_SUCCESS', clientId: ${JSON.stringify(clientId)}, service: ${JSON.stringify(service)} }, ${JSON.stringify(origin)});
        setTimeout(function() { window.close(); }, 100);
      } catch (e) {
        document.body.innerHTML = '<h1>OAuth Complete</h1><p>You can close this window.</p>';
      }
    })();
  </script>
  <p>OAuth successful. Closing window...</p>
</body>
</html>`;
}

function popupErrorHtml(errorMessage: string, origin: string): string {
  return `
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
        document.body.innerHTML = '<h1>OAuth Error</h1><p>${errorMessage}. You can close this window.</p>';
        return;
      }
      try {
        window.opener.postMessage({ type: 'GOOGLE_OAUTH_ERROR', error: ${JSON.stringify(errorMessage)} }, ${JSON.stringify(origin)});
        setTimeout(function() { window.close(); }, 100);
      } catch (e) {
        document.body.innerHTML = '<h1>OAuth Error</h1><p>You can close this window.</p>';
      }
    })();
  </script>
  <p>OAuth failed. Closing window...</p>
</body>
</html>`;
}

export class OAuthService {
  constructor(private readonly storage: IStorage, private readonly deps: OAuthDeps = defaultDeps) {}

  async initiate(input: {
    userId: string;
    service?: string;
    returnTo?: string;
    clientId?: string;
    popup?: boolean;
    origin?: string;
  }): Promise<OAuthResult<{ authUrl: string }>> {
    const profile = await this.storage.getProfileByUserId(input.userId);
    if (!profile) {
      return { ok: false, status: 404, error: "Profile not found" };
    }

    if (input.service !== "GA4" && input.service !== "GSC") {
      return { ok: false, status: 400, error: "service query parameter must be 'GA4' or 'GSC'" };
    }

    const defaultReturnTo = profile.role === "Admin" || profile.role === "SuperAdmin" ? "/agency/integrations" : "/client";
    const safeReturnTo = sanitizeReturnTo(input.returnTo, defaultReturnTo);

    let clientId: string;
    if (profile.role === "Admin" || profile.role === "SuperAdmin") {
      if (!input.clientId) {
        return { ok: false, status: 400, error: "clientId query parameter required for Admin/SuperAdmin" };
      }
      clientId = input.clientId;
    } else if (profile.role === "Client") {
      const client = await this.storage.getClientByProfileId(profile.id);
      if (!client) {
        return { ok: false, status: 404, error: "Client record not found" };
      }
      clientId = client.id;
    } else {
      return { ok: false, status: 403, error: "Only Admin, SuperAdmin, and Client can initiate OAuth" };
    }

    const state = this.deps.generateOAuthState(
      clientId,
      profile.role,
      input.service,
      safeReturnTo,
      input.popup,
      input.origin
    );

    return { ok: true, status: 200, data: { authUrl: this.deps.getAuthUrl(state, input.service) } };
  }

  async callback(query: Record<string, unknown>): Promise<OAuthResult<OAuthCallbackAction>> {
    const code = asString(query.code);
    const state = asString(query.state);
    const oauthError = asString(query.error);

    if (oauthError) {
      return {
        ok: true,
        status: 200,
        data: { kind: "redirect", location: `/client?oauth_error=${encodeURIComponent(oauthError)}` },
      };
    }

    if (!code || !state) {
      return {
        ok: true,
        status: 200,
        data: { kind: "redirect", location: "/client?oauth_error=missing_parameters" },
      };
    }

    let stateData: OAuthStateData;
    try {
      stateData = this.deps.verifyOAuthState(state);
    } catch {
      return {
        ok: true,
        status: 200,
        data: { kind: "redirect", location: "/client?oauth_error=invalid_state" },
      };
    }

    const defaultReturnTo = stateData.initiatedBy === "Admin" || stateData.initiatedBy === "SuperAdmin" ? "/agency/integrations" : "/client";
    const returnTo = sanitizeReturnTo(stateData.returnTo, defaultReturnTo);

    try {
      const tokens = await this.deps.exchangeCodeForTokens(code);
      const existing = await this.storage.getIntegrationByClientId(stateData.clientId, stateData.service);

      if (existing) {
        await this.storage.updateIntegration(existing.id, {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken || existing.refreshToken,
          expiresAt: tokens.expiresAt,
        });
      } else {
        await this.storage.createIntegration({
          clientId: stateData.clientId,
          serviceName: stateData.service,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
        });
      }

      if (stateData.popup && stateData.origin) {
        return {
          ok: true,
          status: 200,
          data: { kind: "html", html: popupSuccessHtml(stateData.clientId, stateData.service, stateData.origin) },
        };
      }

      const separator = returnTo.includes("?") ? "&" : "?";
      return {
        ok: true,
        status: 200,
        data: {
          kind: "redirect",
          location: `${returnTo}${separator}success=google_connected&clientId=${stateData.clientId}&service=${stateData.service}`,
        },
      };
    } catch (error: any) {
      const errorMessage = error?.message || "Authentication failed";

      try {
        const fallbackState = this.deps.verifyOAuthState(state);
        if (fallbackState?.popup && fallbackState?.origin) {
          return {
            ok: true,
            status: 200,
            data: { kind: "html", html: popupErrorHtml(errorMessage, fallbackState.origin) },
          };
        }
      } catch {
        // Ignore state parsing errors in error path.
      }

      return {
        ok: true,
        status: 200,
        data: { kind: "redirect", location: `/client?oauth_error=${encodeURIComponent(errorMessage)}` },
      };
    }
  }
}
