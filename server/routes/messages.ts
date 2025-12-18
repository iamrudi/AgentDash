import { Router } from 'express';
import { storage } from '../storage';
import { 
  requireAuth, 
  requireRole, 
  requireClientAccess,
  type AuthRequest 
} from '../middleware/supabase-auth';
import { EventEmitter } from 'events';

const router = Router();

const messageEmitter = new EventEmitter();

export { messageEmitter };

router.get("/stream", async (req, res) => {
  try {
    const token = req.query.token as string;
    
    if (!token) {
      res.status(401).json({ message: "Authentication token required" });
      return;
    }

    const { supabaseAdmin } = await import("../lib/supabase");
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      res.status(401).json({ message: "Invalid or expired token" });
      return;
    }

    const profile = await storage.getProfileByUserId(user.id);
    
    if (!profile || profile.role !== "Admin") {
      res.status(403).json({ message: "Admin access required" });
      return;
    }

    const agencyId = profile.agencyId;
    
    if (!agencyId) {
      res.status(403).json({ message: "Agency association required" });
      return;
    }

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

    messageEmitter.on('new-message', messageHandler);

    const heartbeat = setInterval(() => {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeat);
      messageEmitter.off('new-message', messageHandler);
    });
  } catch (error: any) {
    console.error('[SSE] Error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.patch("/:id/read", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await storage.markMessageAsRead(id);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const { clientId, message, senderRole } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Message is required" });
    }

    if (!clientId) {
      return res.status(400).json({ message: "Client ID is required" });
    }

    const newMessage = await storage.createMessage({
      clientId,
      message: message.trim(),
      senderRole: senderRole || "Admin",
    });

    const client = await storage.getClientById(clientId);
    if (client) {
      messageEmitter.emit('new-message', { ...newMessage, agencyId: client.agencyId });
    }

    res.status(201).json(newMessage);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/:clientId", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    const { message } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Message is required" });
    }

    const newMessage = await storage.createMessage({
      clientId,
      message: message.trim(),
      senderRole: "Admin",
    });

    const client = await storage.getClientById(clientId);
    if (client) {
      messageEmitter.emit('new-message', { ...newMessage, agencyId: client.agencyId });
    }

    res.status(201).json(newMessage);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/:messageId/mark-read", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const { messageId } = req.params;
    await storage.markMessageAsRead(messageId);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/client/:clientId/mark-all-read", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    const messages = await storage.getMessagesByClientId(clientId);
    await Promise.all(
      messages
        .filter(m => m.isRead === "false" && m.senderRole === "Client")
        .map(m => storage.markMessageAsRead(m.id))
    );
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/analyze/:clientId", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    
    const client = await storage.getClientById(clientId);
    const messages = await storage.getMessagesByClientId(clientId);
    
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    if (messages.length === 0) {
      return res.status(400).json({ message: "No messages to analyze" });
    }

    const conversationText = messages
      .map(m => `${m.senderRole === "Client" ? "Client" : "Agency"}: ${m.message}`)
      .join("\n");

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
    
    const prompt = `Analyze this conversation between an agency and their client (${client.companyName}).

Conversation:
${conversationText}

Provide a brief analysis covering:
1. Main topics and concerns discussed
2. Client sentiment and engagement level
3. Action items or follow-ups needed
4. Potential opportunities for strategic initiatives or recommendations

Keep the analysis concise and actionable (2-3 paragraphs).`;

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: prompt,
    });
    const analysis = result.text;

    res.json({ analysis, suggestions: [] });
  } catch (error: any) {
    console.error("Error analyzing conversation:", error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
