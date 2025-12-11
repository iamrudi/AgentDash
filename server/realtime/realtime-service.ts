import { Response } from "express";
import { realtimeServer, RealtimeMessage } from "./websocket-server";
import logger from "../middleware/logger";
import { nanoid } from "nanoid";

interface SSEClient {
  id: string;
  res: Response;
  userId: string;
  agencyId: string | null;
  channels: Set<string>;
  lastEventId: string | null;
}

const SSE_HEARTBEAT_INTERVAL = 15000; // 15 seconds

class RealtimeService {
  private sseClients: Map<string, SSEClient> = new Map();
  private sseHeartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startSSEHeartbeat();
  }

  registerSSEClient(
    res: Response,
    userId: string,
    agencyId: string | null,
    channels: string[],
    lastEventId: string | null
  ): string {
    const clientId = nanoid();

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const client: SSEClient = {
      id: clientId,
      res,
      userId,
      agencyId,
      channels: new Set(channels),
      lastEventId
    };

    this.sseClients.set(clientId, client);

    this.sendSSE(clientId, {
      type: "connected",
      data: { clientId, userId, agencyId }
    });

    if (agencyId) {
      client.channels.add(`agency:${agencyId}`);
    }

    res.on("close", () => {
      this.sseClients.delete(clientId);
      logger.info(`[SSE] Client disconnected: ${clientId}`);
    });

    logger.info(`[SSE] Client connected: ${clientId}, user: ${userId}`);

    return clientId;
  }

  private sendSSE(clientId: string, data: any): void {
    const client = this.sseClients.get(clientId);
    if (!client) return;

    try {
      const eventId = nanoid();
      const eventData = JSON.stringify({ ...data, timestamp: Date.now() });
      
      client.res.write(`id: ${eventId}\n`);
      client.res.write(`event: ${data.type || "message"}\n`);
      client.res.write(`data: ${eventData}\n\n`);
    } catch (error) {
      logger.error(`[SSE] Failed to send to client ${clientId}:`, error);
      this.sseClients.delete(clientId);
    }
  }

  private startSSEHeartbeat(): void {
    this.sseHeartbeatInterval = setInterval(() => {
      const clientIds = Array.from(this.sseClients.keys());
      for (const clientId of clientIds) {
        this.sendSSE(clientId, { type: "heartbeat" });
      }
    }, SSE_HEARTBEAT_INTERVAL);
  }

  broadcast(
    channel: string,
    message: Omit<RealtimeMessage, "id" | "channel" | "timestamp">,
    excludeUserId?: string
  ): void {
    realtimeServer.broadcast(channel, message, undefined);

    const sseClientEntries = Array.from(this.sseClients.entries());
    for (const [clientId, client] of sseClientEntries) {
      if (client.channels.has(channel) && client.userId !== excludeUserId) {
        this.sendSSE(clientId, {
          ...message,
          channel,
          id: nanoid()
        });
      }
    }
  }

  broadcastToAgency(
    agencyId: string,
    message: Omit<RealtimeMessage, "id" | "channel" | "timestamp">,
    excludeUserId?: string
  ): void {
    this.broadcast(`agency:${agencyId}`, message, excludeUserId);
  }

  broadcastToProject(
    agencyId: string,
    projectId: string,
    message: Omit<RealtimeMessage, "id" | "channel" | "timestamp">,
    excludeUserId?: string
  ): void {
    this.broadcast(`project:${agencyId}:${projectId}`, message, excludeUserId);
  }

  broadcastToTask(
    agencyId: string,
    taskId: string,
    message: Omit<RealtimeMessage, "id" | "channel" | "timestamp">,
    excludeUserId?: string
  ): void {
    this.broadcast(`task:${agencyId}:${taskId}`, message, excludeUserId);
  }

  sendToUser(
    userId: string,
    message: Omit<RealtimeMessage, "id" | "channel" | "timestamp">
  ): void {
    realtimeServer.sendToUser(userId, message);

    const sseClientEntries = Array.from(this.sseClients.entries());
    for (const [clientId, client] of sseClientEntries) {
      if (client.userId === userId) {
        this.sendSSE(clientId, {
          ...message,
          channel: `user:${userId}`,
          id: nanoid()
        });
      }
    }
  }

  notifyNewMessage(
    agencyId: string,
    message: {
      id: string;
      content: string;
      senderId: string;
      senderName: string;
      taskId?: string;
      projectId?: string;
    }
  ): void {
    this.broadcastToAgency(agencyId, {
      type: "new-message",
      data: message
    }, message.senderId);
  }

  notifyTaskUpdate(
    agencyId: string,
    task: {
      id: string;
      title: string;
      status: string;
      projectId: string;
    },
    updatedBy: string
  ): void {
    this.broadcastToAgency(agencyId, {
      type: "task-updated",
      data: { task, updatedBy }
    }, updatedBy);

    this.broadcastToProject(agencyId, task.projectId, {
      type: "task-updated",
      data: { task, updatedBy }
    }, updatedBy);
  }

  notifyProjectUpdate(
    agencyId: string,
    project: {
      id: string;
      name: string;
      status: string;
    },
    updatedBy: string
  ): void {
    this.broadcastToAgency(agencyId, {
      type: "project-updated",
      data: { project, updatedBy }
    }, updatedBy);
  }

  notifyNotification(
    userId: string,
    notification: {
      id: string;
      type: string;
      title: string;
      message: string;
    }
  ): void {
    this.sendToUser(userId, {
      type: "notification",
      data: notification
    });
  }

  notifyWorkflowExecution(
    agencyId: string,
    execution: {
      id: string;
      workflowId: string;
      status: string;
      stepResults?: any[];
    }
  ): void {
    this.broadcastToAgency(agencyId, {
      type: "workflow-execution",
      data: execution
    });
  }

  getOnlineUsers(agencyId: string): string[] {
    const wsUsers = realtimeServer.getOnlineUsers(agencyId);
    const sseUsers: string[] = [];

    const sseClientEntries = Array.from(this.sseClients.entries());
    for (const [_, client] of sseClientEntries) {
      if (client.agencyId === agencyId && !sseUsers.includes(client.userId)) {
        sseUsers.push(client.userId);
      }
    }

    const allUsers = new Set([...wsUsers, ...sseUsers]);
    return Array.from(allUsers);
  }

  getPresence(agencyId: string): Array<{ userId: string; status: string; connectionType: string }> {
    const wsPresence = realtimeServer.getPresence(agencyId);
    const presenceMap = new Map<string, { status: string; connectionType: string }>();

    for (const p of wsPresence) {
      presenceMap.set(p.userId, { status: p.status, connectionType: "websocket" });
    }

    const sseClientEntries = Array.from(this.sseClients.entries());
    for (const [_, client] of sseClientEntries) {
      if (client.agencyId === agencyId && !presenceMap.has(client.userId)) {
        presenceMap.set(client.userId, { status: "online", connectionType: "sse" });
      }
    }

    return Array.from(presenceMap.entries()).map(([userId, info]) => ({
      userId,
      ...info
    }));
  }

  getConnectionStats(): {
    websocketClients: number;
    sseClients: number;
    totalClients: number;
  } {
    return {
      websocketClients: realtimeServer.getClientCount(),
      sseClients: this.sseClients.size,
      totalClients: realtimeServer.getClientCount() + this.sseClients.size
    };
  }

  shutdown(): void {
    if (this.sseHeartbeatInterval) {
      clearInterval(this.sseHeartbeatInterval);
    }

    const sseClientEntries = Array.from(this.sseClients.entries());
    for (const [_, client] of sseClientEntries) {
      client.res.end();
    }
    this.sseClients.clear();

    realtimeServer.shutdown();

    logger.info("[Realtime] Service shut down");
  }
}

export const realtimeService = new RealtimeService();
