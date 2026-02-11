import { Router } from "express";
import { storage } from "../storage";
import { requireAuth, type AuthRequest } from "../middleware/supabase-auth";
import { OAuthService } from "../application/oauth/oauth-service";

const router = Router();
const oauthService = new OAuthService(storage);

export function createOAuthInitiateHandler(service: OAuthService = oauthService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const popup = req.query.popup === "true";
      const origin = popup ? req.get("origin") || req.get("referer")?.split("/").slice(0, 3).join("/") : undefined;

      const result = await service.initiate({
        userId: req.user!.id,
        service: req.query.service as string | undefined,
        returnTo: req.query.returnTo as string | undefined,
        clientId: req.query.clientId as string | undefined,
        popup,
        origin,
      });

      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("OAuth initiation error:", error);
      return res.status(500).json({ message: error.message || "OAuth initiation failed" });
    }
  };
}

router.get("/google/initiate", requireAuth, createOAuthInitiateHandler());

export function createOAuthCallbackHandler(service: OAuthService = oauthService) {
  return async (req: any, res: any) => {
    try {
      const result = await service.callback(req.query ?? {});
      if (!result.ok || !result.data) {
        return res.redirect(`/client?oauth_error=${encodeURIComponent(result.error || "oauth_failed")}`);
      }

      if (result.data.kind === "html") {
        return res.type("text/html").send(result.data.html);
      }
      return res.redirect(result.data.location);
    } catch (error: any) {
      console.error("OAuth callback error:", error);
      return res.redirect(`/client?oauth_error=${encodeURIComponent(error.message || "oauth_failed")}`);
    }
  };
}

router.get("/google/callback", createOAuthCallbackHandler());

export default router;
