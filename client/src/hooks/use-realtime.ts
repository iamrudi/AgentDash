import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useAuthStatus } from "@/context/auth-provider";
import { getAuthUser, isAuthenticated as checkIsAuthenticated } from "@/lib/auth";

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export interface RealtimeMessage {
  id: string;
  type: string;
  channel: string;
  data: any;
  timestamp: number;
  senderId?: string;
}

export interface UseRealtimeOptions {
  channels?: string[];
  onMessage?: (message: RealtimeMessage) => void;
  onPresence?: (presence: { userId: string; status: string }) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  fallbackToSSE?: boolean;
}

const DEFAULT_RECONNECT_DELAY = 3000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 5;

export function useRealtime(options: UseRealtimeOptions = {}) {
  const { authReady, isAuthenticated } = useAuthStatus();
  const authUser = useMemo(() => getAuthUser(), []);
  const token = authUser?.token;
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [lastMessage, setLastMessage] = useState<RealtimeMessage | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const lastEventTimestamp = useRef<number>(0);
  const subscribedChannels = useRef<Set<string>>(new Set(options.channels || []));

  const {
    channels = [],
    onMessage,
    onPresence,
    onConnect,
    onDisconnect,
    autoReconnect = true,
    reconnectDelay = DEFAULT_RECONNECT_DELAY,
    maxReconnectAttempts = DEFAULT_MAX_RECONNECT_ATTEMPTS,
    fallbackToSSE = true,
  } = options;

  const cleanup = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
  }, []);

  const handleMessage = useCallback((message: RealtimeMessage) => {
    lastEventTimestamp.current = message.timestamp;
    setLastMessage(message);

    switch (message.type) {
      case "presence":
        if (message.data.status === "online") {
          setOnlineUsers(prev => 
            prev.includes(message.data.userId) 
              ? prev 
              : [...prev, message.data.userId]
          );
        } else if (message.data.status === "offline") {
          setOnlineUsers(prev => prev.filter(id => id !== message.data.userId));
        }
        onPresence?.(message.data);
        break;
      default:
        onMessage?.(message);
    }
  }, [onMessage, onPresence]);

  const connectSSE = useCallback(() => {
    if (!token || !isAuthenticated) return;

    const channelParams = channels.length > 0 ? `&channels=${channels.join(",")}` : "";
    const url = `/api/realtime/stream?token=${token}${channelParams}`;

    try {
      const eventSource = new EventSource(url);
      sseRef.current = eventSource;

      eventSource.onopen = () => {
        setStatus("connected");
        reconnectAttempts.current = 0;
        onConnect?.();
      };

      eventSource.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error("[SSE] Failed to parse message:", error);
        }
      };

      eventSource.addEventListener("connected", (event: any) => {
        try {
          const data = JSON.parse(event.data);
          console.log("[SSE] Connected:", data);
        } catch (error) {
          console.error("[SSE] Failed to parse connected event:", error);
        }
      });

      eventSource.addEventListener("heartbeat", () => {
        // Heartbeat received, connection is alive
      });

      eventSource.onerror = () => {
        setStatus("error");
        eventSource.close();
        sseRef.current = null;

        if (autoReconnect && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          reconnectTimer.current = setTimeout(() => {
            connectSSE();
          }, reconnectDelay * reconnectAttempts.current);
        } else {
          onDisconnect?.();
        }
      };
    } catch (error) {
      console.error("[SSE] Connection error:", error);
      setStatus("error");
    }
  }, [token, isAuthenticated, channels, handleMessage, onConnect, onDisconnect, autoReconnect, reconnectDelay, maxReconnectAttempts]);

  const connectWebSocket = useCallback(() => {
    if (!token || !isAuthenticated) return;

    setStatus("connecting");

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws?token=${token}`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        reconnectAttempts.current = 0;
        
        // Subscribe to channels
        const channelList = Array.from(subscribedChannels.current);
        for (const channel of channelList) {
          ws.send(JSON.stringify({ type: "subscribe", channel }));
        }

        // Request message replay if reconnecting
        if (lastEventTimestamp.current > 0) {
          for (const channel of channelList) {
            ws.send(JSON.stringify({ 
              type: "replay", 
              channel, 
              since: lastEventTimestamp.current 
            }));
          }
        }

        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === "replay") {
            // Handle replayed messages
            for (const replayedMessage of message.data.messages) {
              handleMessage(replayedMessage);
            }
          } else {
            handleMessage(message);
          }
        } catch (error) {
          console.error("[WS] Failed to parse message:", error);
        }
      };

      ws.onclose = (event) => {
        setStatus("disconnected");
        wsRef.current = null;

        if (event.code !== 1000 && autoReconnect && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          reconnectTimer.current = setTimeout(() => {
            connectWebSocket();
          }, reconnectDelay * reconnectAttempts.current);
        } else if (fallbackToSSE && event.code !== 1000) {
          // Fallback to SSE if WebSocket fails
          console.log("[WS] Falling back to SSE");
          connectSSE();
        } else {
          onDisconnect?.();
        }
      };

      ws.onerror = () => {
        setStatus("error");
      };
    } catch (error) {
      console.error("[WS] Connection error:", error);
      if (fallbackToSSE) {
        connectSSE();
      } else {
        setStatus("error");
      }
    }
  }, [token, isAuthenticated, handleMessage, onConnect, onDisconnect, autoReconnect, reconnectDelay, maxReconnectAttempts, fallbackToSSE, connectSSE]);

  const subscribe = useCallback((channel: string) => {
    subscribedChannels.current.add(channel);
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "subscribe", channel }));
    }
  }, []);

  const unsubscribe = useCallback((channel: string) => {
    subscribedChannels.current.delete(channel);
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "unsubscribe", channel }));
    }
  }, []);

  const send = useCallback((channel: string, data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "message", channel, data }));
    }
  }, []);

  const updatePresence = useCallback((presenceStatus: "online" | "away") => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "presence", status: presenceStatus }));
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && token) {
      // Update subscribed channels
      subscribedChannels.current = new Set(channels);
      connectWebSocket();
    }

    return cleanup;
  }, [isAuthenticated, token, connectWebSocket, cleanup, channels]);

  // Handle visibility change for presence
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        updatePresence("away");
      } else {
        updatePresence("online");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [updatePresence]);

  return {
    status,
    lastMessage,
    onlineUsers,
    subscribe,
    unsubscribe,
    send,
    updatePresence,
    isConnected: status === "connected",
  };
}

export function useRealtimeChannel(channel: string, onMessage?: (data: any) => void) {
  const { subscribe, unsubscribe, send, status } = useRealtime({
    channels: [channel],
    onMessage: (message) => {
      if (message.channel === channel) {
        onMessage?.(message.data);
      }
    },
  });

  useEffect(() => {
    subscribe(channel);
    return () => unsubscribe(channel);
  }, [channel, subscribe, unsubscribe]);

  const sendMessage = useCallback((data: any) => {
    send(channel, data);
  }, [channel, send]);

  return {
    send: sendMessage,
    isConnected: status === "connected",
  };
}
