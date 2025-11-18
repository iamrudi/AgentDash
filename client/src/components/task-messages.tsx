import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { TaskMessageWithSender } from "@shared/schema";

interface TaskMessagesProps {
  taskId: string;
  currentUserId: string;
}

export function TaskMessages({ taskId, currentUserId }: TaskMessagesProps) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch messages with aggressive polling for near real-time updates
  const { data: messages = [], isLoading } = useQuery<TaskMessageWithSender[]>({
    queryKey: ["/api/tasks", taskId, "messages"],
    enabled: !!taskId,
    refetchInterval: 1000, // Poll every 1 second for near real-time updates
    refetchIntervalInBackground: true, // Continue polling even when tab is in background
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Mark unread messages as read when viewing
  useEffect(() => {
    if (!messages.length) return;
    
    // Filter for messages from other users that haven't been read
    // isRead is stored as text "true"/"false" in the database
    const unreadMessages = messages.filter(
      (msg) => msg.senderId !== currentUserId && msg.isRead !== "true"
    );

    unreadMessages.forEach((msg) => {
      apiRequest("PATCH", `/api/tasks/messages/${msg.id}/read`, {}).catch((error) => {
        console.error("Failed to mark message as read:", error);
      });
    });
  }, [messages, currentUserId]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageText: string) => {
      return await apiRequest("POST", `/api/tasks/${taskId}/messages`, {
        message: messageText,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId, "messages"] });
      setMessage("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessageMutation.mutate(message.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading messages...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-4 p-6">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground text-sm">
                No messages yet. Start a conversation!
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isCurrentUser = msg.senderId === currentUserId;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}
                  data-testid={`message-${msg.id}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      isCurrentUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-sm font-medium">
                        {msg.sender?.fullName || "Unknown User"}
                      </span>
                      <span className={`text-xs ${isCurrentUser ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="border-t p-4 space-y-2">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Shift+Enter for new line)"
          className="resize-none min-h-[80px]"
          data-testid="input-task-message"
        />
        <div className="flex justify-end">
          <Button
            onClick={handleSend}
            disabled={!message.trim() || sendMessageMutation.isPending}
            size="sm"
            data-testid="button-send-message"
          >
            <Send className="w-4 h-4 mr-2" />
            {sendMessageMutation.isPending ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
