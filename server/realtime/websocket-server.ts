import { Server } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { getAuthUserFromToken } from "../middleware/supabase-auth";
import logger from "../middleware/logger";
import { nanoid } from "nanoid";
import { EventEmitter } from "events";

export interface WebSocketClient {
  id: string;
  ws: WebSocket;
  userId: string;
  agencyId: string | null;
  clientId: string | null;
  role: string;
  channels: Set<string>;
  lastPing: number;
  status: "online" | "away" | "offline";
}

export interface RealtimeMessage {
  id: string;
  type: string;
  channel: string;
  data: any;
  timestamp: number;
  senderId?: string;
}

interface RealtimeAuthUser {
  id: string;
  email: string;
  role: string;
  agencyId?: string;
  clientId?: string;
  isSuperAdmin?: boolean;
}

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const HEARTBEAT_TIMEOUT = 35000; // 35 seconds (grace period)
const AWAY_TIMEOUT = 300000; // 5 minutes for away status
const MESSAGE_BUFFER_SIZE = 100; // Messages to keep for replay

export interface WebSocketMetrics {
  connections: {
    current: number;
    peak: number;
    totalSinceStart: number;
  };
  channels: {
    active: number;
    subscriptions: number;
  };
  messages: {
    broadcast: number;
    direct: number;
    errors: number;
  };
  uptime: number;
  status: "healthy" | "degraded" | "unhealthy";
}

class RealtimeServer extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocketClient> = new Map();
  private userClients: Map<string, Set<string>> = new Map(); // userId -> clientIds
  private channelClients: Map<string, Set<string>> = new Map(); // channel -> clientIds
  private messageBuffer: Map<string, RealtimeMessage[]> = new Map(); // channel -> messages
  private heartbeatInterval: NodeJS.Timeout | null = null;
  
  private metricsData = {
    peakConnections: 0,
    totalConnections: 0,
    broadcastCount: 0,
    directMessageCount: 0,
    errorCount: 0,
    startTime: Date.now(),
  };

  initialize(server: Server): void {
    this.wss = new WebSocketServer({ 
      server, 
      path: "/ws",
      verifyClient: async (info, callback) => {
        try {
          const url = new URL(info.req.url || "", `http://${info.req.headers.host}`);
          const token = url.searchParams.get("token");
          
          if (!token) {
            callback(false, 401, "No authentication token provided");
            return;
          }

          const user = await getAuthUserFromToken(token);
          if (!user) {
            callback(false, 401, "Invalid or expired token");
            return;
          }

          (info.req as any).user = user;
          callback(true);
        } catch (error) {
          logger.error("[WS] Authentication error:", error);
          callback(false, 401, "Authentication failed");
        }
      }
    });

    this.wss.on("connection", (ws, req) => this.handleConnection(ws, req));
    this.wss.on("error", (error) => {
      logger.error("[WS] Server error:", error);
    });

    this.startHeartbeat();
    logger.info("[WS] WebSocket server initialized");
  }

  private handleConnection(ws: WebSocket, req: any): void {
    const user = req.user as RealtimeAuthUser;
    const clientId = nanoid();

    const client: WebSocketClient = {
      id: clientId,
      ws,
      userId: user.id,
      agencyId: user.agencyId ?? null,
      clientId: user.clientId ?? null,
      role: user.role,
      channels: new Set(),
      lastPing: Date.now(),
      status: "online"
    };

    this.clients.set(clientId, client);
    
    this.metricsData.totalConnections++;
    if (this.clients.size > this.metricsData.peakConnections) {
      this.metricsData.peakConnections = this.clients.size;
    }

    if (!this.userClients.has(user.id)) {
      this.userClients.set(user.id, new Set());
    }
    this.userClients.get(user.id)!.add(clientId);

    if (user.agencyId) {
      this.subscribeToChannel(clientId, `agency:${user.agencyId}`);
    }

    this.sendToClient(clientId, {
      type: "connected",
      data: {
        clientId,
        userId: user.id,
        agencyId: user.agencyId
      }
    });

    this.broadcastPresence(user.id, "online", user.agencyId ?? null);

    ws.on("message", (data) => this.handleMessage(clientId, data));
    ws.on("close", () => this.handleDisconnect(clientId));
    ws.on("error", (error) => {
      logger.error(`[WS] Client ${clientId} error:`, error);
    });
    ws.on("pong", () => {
      client.lastPing = Date.now();
      if (client.status === "away") {
        client.status = "online";
        this.broadcastPresence(user.id, "online", user.agencyId ?? null);
      }
    });

    logger.info(`[WS] Client connected: ${clientId}, user: ${user.id}`);
  }

  private handleMessage(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastPing = Date.now();

    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case "subscribe":
          this.handleSubscribe(clientId, message.channel);
          break;
        case "unsubscribe":
          this.handleUnsubscribe(clientId, message.channel);
          break;
        case "ping":
          this.sendToClient(clientId, { type: "pong", timestamp: Date.now() });
          break;
        case "presence":
          this.handlePresenceUpdate(clientId, message.status);
          break;
        case "message":
          this.handleClientMessage(clientId, message);
          break;
        case "replay":
          this.handleReplayRequest(clientId, message.channel, message.since);
          break;
        default:
          logger.warn(`[WS] Unknown message type: ${message.type}`);
      }
    } catch (error) {
      logger.error(`[WS] Failed to parse message from ${clientId}:`, error);
    }
  }

  subscribeToChannel(clientId: string, channel: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.channels.add(channel);

    if (!this.channelClients.has(channel)) {
      this.channelClients.set(channel, new Set());
    }
    this.channelClients.get(channel)!.add(clientId);

    logger.debug(`[WS] Client ${clientId} auto-subscribed to ${channel}`);
  }

  private handleSubscribe(clientId: string, channel: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (!this.canAccessChannel(client, channel)) {
      this.sendToClient(clientId, {
        type: "error",
        data: { message: "Access denied to channel", channel }
      });
      return;
    }

    client.channels.add(channel);

    if (!this.channelClients.has(channel)) {
      this.channelClients.set(channel, new Set());
    }
    this.channelClients.get(channel)!.add(clientId);

    this.sendToClient(clientId, {
      type: "subscribed",
      data: { channel }
    });

    logger.debug(`[WS] Client ${clientId} subscribed to ${channel}`);
  }

  private handleUnsubscribe(clientId: string, channel: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.channels.delete(channel);
    this.channelClients.get(channel)?.delete(clientId);

    this.sendToClient(clientId, {
      type: "unsubscribed",
      data: { channel }
    });

    logger.debug(`[WS] Client ${clientId} unsubscribed from ${channel}`);
  }

  private handlePresenceUpdate(clientId: string, status: "online" | "away"): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.status = status;
    this.broadcastPresence(client.userId, status, client.agencyId);
  }

  private handleClientMessage(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { channel, data } = message;

    if (!client.channels.has(channel)) {
      this.sendToClient(clientId, {
        type: "error",
        data: { message: "Not subscribed to channel", channel }
      });
      return;
    }

    this.broadcast(channel, {
      type: "message",
      data,
      senderId: client.userId
    }, clientId);
  }

  private handleReplayRequest(clientId: string, channel: string, since: number): void {
    const client = this.clients.get(clientId);
    if (!client || !client.channels.has(channel)) return;

    const messages = this.messageBuffer.get(channel) || [];
    const replayMessages = messages.filter(m => m.timestamp > since);

    this.sendToClient(clientId, {
      type: "replay",
      data: { channel, messages: replayMessages }
    });
  }

  private handleDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const channels = Array.from(client.channels);
    for (const channel of channels) {
      this.channelClients.get(channel)?.delete(clientId);
    }

    this.userClients.get(client.userId)?.delete(clientId);
    
    const remainingConnections = this.userClients.get(client.userId)?.size || 0;
    if (remainingConnections === 0) {
      this.userClients.delete(client.userId);
      this.broadcastPresence(client.userId, "offline", client.agencyId);
    }

    this.clients.delete(clientId);
    logger.info(`[WS] Client disconnected: ${clientId}`);
  }

  private canAccessChannel(client: WebSocketClient, channel: string): boolean {
    const parts = channel.split(":");
    const type = parts[0];

    switch (type) {
      case "agency":
        return client.role === "SuperAdmin" || client.agencyId === parts[1];
      case "project":
        if (parts.length < 3) return false;
        const projectAgencyId = parts[1];
        return client.role === "SuperAdmin" || client.agencyId === projectAgencyId;
      case "task":
        if (parts.length < 3) return false;
        const taskAgencyId = parts[1];
        return client.role === "SuperAdmin" || client.agencyId === taskAgencyId;
      case "user":
        return client.userId === parts[1] || client.role === "SuperAdmin";
      default:
        return false;
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const clientEntries = Array.from(this.clients.entries());

      for (const [clientId, client] of clientEntries) {
        if (now - client.lastPing > HEARTBEAT_TIMEOUT) {
          logger.info(`[WS] Client ${clientId} timed out`);
          client.ws.terminate();
          this.handleDisconnect(clientId);
          continue;
        }

        if (now - client.lastPing > AWAY_TIMEOUT && client.status === "online") {
          client.status = "away";
          this.broadcastPresence(client.userId, "away", client.agencyId);
        }

        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      }
    }, HEARTBEAT_INTERVAL);
  }

  private sendToClient(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    try {
      client.ws.send(JSON.stringify({
        ...message,
        timestamp: Date.now()
      }));
    } catch (error) {
      this.metricsData.errorCount++;
      logger.error(`[WS] Failed to send to client ${clientId}:`, error);
    }
  }

  private broadcastPresence(userId: string, status: string, agencyId: string | null): void {
    if (!agencyId) return;

    this.broadcast(`agency:${agencyId}`, {
      type: "presence",
      data: { userId, status }
    });

    this.emit("presence", { userId, status, agencyId });
  }

  broadcast(channel: string, message: Omit<RealtimeMessage, "id" | "channel" | "timestamp">, excludeClientId?: string): void {
    const fullMessage: RealtimeMessage = {
      ...message,
      id: nanoid(),
      channel,
      timestamp: Date.now()
    };

    if (!this.messageBuffer.has(channel)) {
      this.messageBuffer.set(channel, []);
    }
    const buffer = this.messageBuffer.get(channel)!;
    buffer.push(fullMessage);
    if (buffer.length > MESSAGE_BUFFER_SIZE) {
      buffer.shift();
    }

    const channelClients = this.channelClients.get(channel);
    if (!channelClients) return;

    this.metricsData.broadcastCount++;
    
    const clientIds = Array.from(channelClients);
    for (const clientId of clientIds) {
      if (clientId === excludeClientId) continue;
      this.sendToClient(clientId, fullMessage);
    }
  }

  sendToUser(userId: string, message: Omit<RealtimeMessage, "id" | "channel" | "timestamp">): void {
    const clientIds = this.userClients.get(userId);
    if (!clientIds) return;

    this.metricsData.directMessageCount++;
    
    const ids = Array.from(clientIds);
    for (const clientId of ids) {
      this.sendToClient(clientId, {
        ...message,
        id: nanoid(),
        channel: `user:${userId}`,
        timestamp: Date.now()
      });
    }
  }

  getOnlineUsers(agencyId: string): string[] {
    const onlineUsers: string[] = [];
    const clientEntries = Array.from(this.clients.entries());

    for (const [_, client] of clientEntries) {
      if (client.agencyId === agencyId && client.status === "online") {
        if (!onlineUsers.includes(client.userId)) {
          onlineUsers.push(client.userId);
        }
      }
    }

    return onlineUsers;
  }

  getPresence(agencyId: string): Array<{ userId: string; status: string }> {
    const presenceMap = new Map<string, string>();
    const clientEntries = Array.from(this.clients.entries());

    for (const [_, client] of clientEntries) {
      if (client.agencyId === agencyId) {
        const existing = presenceMap.get(client.userId);
        if (!existing || client.status === "online") {
          presenceMap.set(client.userId, client.status);
        }
      }
    }

    return Array.from(presenceMap.entries()).map(([userId, status]) => ({
      userId,
      status
    }));
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getMetrics(): WebSocketMetrics {
    let totalSubscriptions = 0;
    const channelValues = Array.from(this.channelClients.values());
    for (const clients of channelValues) {
      totalSubscriptions += clients.size;
    }

    const errorRate = this.metricsData.broadcastCount + this.metricsData.directMessageCount > 0
      ? this.metricsData.errorCount / (this.metricsData.broadcastCount + this.metricsData.directMessageCount)
      : 0;

    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (errorRate > 0.1) {
      status = "unhealthy";
    } else if (errorRate > 0.01 || !this.wss) {
      status = "degraded";
    }

    return {
      connections: {
        current: this.clients.size,
        peak: this.metricsData.peakConnections,
        totalSinceStart: this.metricsData.totalConnections,
      },
      channels: {
        active: this.channelClients.size,
        subscriptions: totalSubscriptions,
      },
      messages: {
        broadcast: this.metricsData.broadcastCount,
        direct: this.metricsData.directMessageCount,
        errors: this.metricsData.errorCount,
      },
      uptime: Date.now() - this.metricsData.startTime,
      status,
    };
  }

  isHealthy(): boolean {
    return this.wss !== null && this.getMetrics().status !== "unhealthy";
  }

  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    const clientEntries = Array.from(this.clients.entries());
    for (const [_, client] of clientEntries) {
      client.ws.close(1000, "Server shutting down");
    }

    this.clients.clear();
    this.userClients.clear();
    this.channelClients.clear();
    this.messageBuffer.clear();

    if (this.wss) {
      this.wss.close();
    }

    logger.info("[WS] WebSocket server shut down");
  }
}

export const realtimeServer = new RealtimeServer();
