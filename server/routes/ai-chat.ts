import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/supabase-auth';
import { storage } from '../storage';
import { hardenedAIExecutor } from "../ai/hardened-executor";
import { AiChatService } from "../application/ai/ai-chat-service";

const router = Router();
const aiChatService = new AiChatService(storage, hardenedAIExecutor);

export function createAnalyzeDataHandler(service: AiChatService = aiChatService) {
  return async (req: AuthRequest, res: Response) => {
    try {
      const result = await service.analyzeData(req.user!.id, req.body);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("On-demand AI analysis error:", error);
      return res.status(500).json({ message: error.message || "Failed to get analysis" });
    }
  };
}

router.post("/analyze-data", requireAuth, createAnalyzeDataHandler());

export function createRequestActionHandler(service: AiChatService = aiChatService) {
  return async (req: AuthRequest, res: Response) => {
    try {
      const result = await service.requestAction(req.user!.id, req.body);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("AI request action error:", error);
      return res.status(500).json({ message: error.message || "Failed to submit recommendation" });
    }
  };
}

router.post("/request-action", requireAuth, createRequestActionHandler());

export default router;
