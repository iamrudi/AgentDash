import { Router } from 'express';
import { storage } from '../storage';
import { 
  requireAuth, 
  requireRole, 
  requireClientAccess,
  type AuthRequest 
} from '../middleware/supabase-auth';
import { EventEmitter } from 'events';
import { MessageService } from "../application/messages/message-service";
import { MessageStreamService } from "../application/messages/message-stream-service";

const router = Router();
const messageService = new MessageService(storage);
const messageStreamService = new MessageStreamService(storage);

const messageEmitter = new EventEmitter();

export { messageEmitter };

export function createMessageStreamHandler(
  service: MessageStreamService = messageStreamService,
  emitter: EventEmitter = messageEmitter,
  timers: { setInterval: typeof setInterval; clearInterval: typeof clearInterval } = {
    setInterval,
    clearInterval,
  }
) {
  return async (req: any, res: any) => {
    try {
      const result = await service.authenticateStream(req.query.token as string | undefined);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }

      const agencyId = result.data!.agencyId;
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

      const messageHandler = (message: any) => {
        if (message.agencyId === agencyId) {
          res.write(`data: ${JSON.stringify({ type: 'message', data: message })}\n\n`);
        }
      };

      emitter.on('new-message', messageHandler);
      const heartbeat = timers.setInterval(() => {
        res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
      }, 30000);

      req.on('close', () => {
        timers.clearInterval(heartbeat);
        emitter.off('new-message', messageHandler);
      });
      return undefined;
    } catch (error: any) {
      console.error('[SSE] Error:', error);
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get("/stream", createMessageStreamHandler());

export function createMessageMarkReadHandler(service: MessageService = messageService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.markRead(req.params.id);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).send();
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.patch("/:id/read", requireAuth, requireRole("Admin"), createMessageMarkReadHandler());

export function createMessageCreateHandler(service: MessageService = messageService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.createMessage({
        clientId: req.body?.clientId,
        message: req.body?.message,
        senderRole: req.body?.senderRole,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }

      if (result.data?.agencyId) {
        messageEmitter.emit('new-message', { ...(result.data.message as object), agencyId: result.data.agencyId });
      }

      return res.status(result.status).json(result.data?.message);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.post("/", requireAuth, requireRole("Admin"), createMessageCreateHandler());

export function createMessageCreateForClientHandler(service: MessageService = messageService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.createMessage({
        clientId: req.params.clientId,
        message: req.body?.message,
        senderRole: "Admin",
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }

      if (result.data?.agencyId) {
        messageEmitter.emit('new-message', { ...(result.data.message as object), agencyId: result.data.agencyId });
      }

      return res.status(result.status).json(result.data?.message);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.post("/:clientId", requireAuth, requireRole("Admin"), requireClientAccess(storage), createMessageCreateForClientHandler());

export function createMessageMarkReadPostHandler(service: MessageService = messageService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.markRead(req.params.messageId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).send();
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.post("/:messageId/mark-read", requireAuth, requireRole("Admin"), createMessageMarkReadPostHandler());

export function createMessageMarkAllReadHandler(service: MessageService = messageService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.markAllReadForClient(req.params.clientId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).send();
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.post("/client/:clientId/mark-all-read", requireAuth, requireRole("Admin"), requireClientAccess(storage), createMessageMarkAllReadHandler());

export function createMessageAnalyzeHandler(service: MessageService = messageService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.analyzeConversation(req.params.clientId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error analyzing conversation:", error);
      return res.status(500).json({ message: error.message });
    }
  };
}

router.post("/analyze/:clientId", requireAuth, requireRole("Admin"), requireClientAccess(storage), createMessageAnalyzeHandler());

export default router;
