import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { AgencyLayout } from "@/components/agency-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send, Sparkles, CheckCheck, User, Bot, Lightbulb } from "lucide-react";
import { ClientMessage, Client } from "@shared/schema";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

type ConversationGroup = {
  client: Client;
  messages: ClientMessage[];
  lastMessage: ClientMessage;
  unreadCount: number;
};

export default function AgencyMessagesPage() {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [analyzingConversation, setAnalyzingConversation] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: messages } = useQuery<ClientMessage[]>({
    queryKey: ["/api/agency/messages"],
    refetchInterval: 5000, // Refresh every 5 seconds for real-time feel
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/agency/clients"],
  });

  // Group messages by client and get conversation stats
  const conversations: ConversationGroup[] = clients?.map(client => {
    const clientMessages = messages?.filter(m => m.clientId === client.id) || [];
    const unreadCount = clientMessages.filter(m => m.isRead === "false" && m.senderRole === "Client").length;
    const lastMessage = clientMessages[0]; // Messages are ordered by createdAt desc
    
    return {
      client,
      messages: clientMessages.reverse(), // Reverse for chronological order in chat
      lastMessage,
      unreadCount,
    };
  }).filter(conv => conv.lastMessage) // Only show clients with messages
    .sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()) || [];

  // Get selected conversation
  const selectedConversation = conversations.find(c => c.client.id === selectedClientId);

  // Auto-select first conversation if none selected
  useEffect(() => {
    if (!selectedClientId && conversations.length > 0) {
      setSelectedClientId(conversations[0].client.id);
    }
  }, [conversations, selectedClientId]);

  // Clear AI analysis when conversation changes
  useEffect(() => {
    setAiAnalysis(null);
    setAnalyzingConversation(false);
  }, [selectedClientId]);

  // Mark messages as read when conversation is selected
  useEffect(() => {
    if (selectedClientId && selectedConversation && selectedConversation.unreadCount > 0) {
      apiRequest("POST", `/api/agency/messages/client/${selectedClientId}/mark-all-read`, {})
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/agency/messages"] });
          queryClient.invalidateQueries({ queryKey: ["/api/agency/notifications/counts"] });
        });
    }
  }, [selectedClientId, selectedConversation]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [selectedConversation?.messages]);

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { clientId: string; message: string }) => {
      return await apiRequest("POST", `/api/agency/messages/${data.clientId}`, { message: data.message });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/messages"] });
      setMessageText("");
      toast({
        title: "Message sent",
        description: "Your message has been delivered.",
      });
    },
  });

  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedClientId) return;
    sendMessageMutation.mutate({
      clientId: selectedClientId,
      message: messageText,
    });
  };

  const analyzeConversationMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const response = await apiRequest(
        "POST", 
        `/api/agency/messages/analyze/${clientId}`, 
        {}
      );
      return { 
        clientId, 
        ...response as unknown as { analysis: string; suggestions: string[] } 
      };
    },
    onSuccess: (data) => {
      // Only update analysis if it's for the currently selected client
      if (data.clientId === selectedClientId) {
        setAiAnalysis(data.analysis);
      }
    },
    onError: () => {
      toast({
        title: "Analysis failed",
        description: "Could not analyze the conversation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAnalyzeConversation = () => {
    if (!selectedClientId) return;
    setAnalyzingConversation(true);
    analyzeConversationMutation.mutate(selectedClientId);
  };

  return (
    <AgencyLayout>
      <div className="h-[calc(100vh-4rem)] flex">
        {/* Conversation List */}
        <div className="w-80 border-r flex flex-col">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Conversations</h2>
            <p className="text-sm text-muted-foreground">Client messages</p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2">
              {conversations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No conversations yet</p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <Card
                    key={conv.client.id}
                    className={`mb-2 cursor-pointer transition-colors hover-elevate active-elevate-2 ${
                      selectedClientId === conv.client.id ? "border-primary bg-accent/50" : ""
                    }`}
                    onClick={() => setSelectedClientId(conv.client.id)}
                    data-testid={`conversation-${conv.client.id}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            {conv.client.companyName?.charAt(0) || "C"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-semibold text-sm truncate">{conv.client.companyName}</p>
                            {conv.unreadCount > 0 && (
                              <Badge variant="default" className="h-5 min-w-5 px-1 text-xs">
                                {conv.unreadCount}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {conv.lastMessage.senderRole === "Client" ? "Client: " : "You: "}
                            {conv.lastMessage.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(conv.lastMessage.createdAt), "MMM d, h:mm a")}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Chat Interface */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {selectedConversation.client.companyName?.charAt(0) || "C"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">{selectedConversation.client.companyName}</h3>
                    <p className="text-xs text-muted-foreground">
                      {selectedConversation.messages.length} messages
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAnalyzeConversation}
                  disabled={analyzeConversationMutation.isPending}
                  data-testid="button-analyze-conversation"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {analyzeConversationMutation.isPending ? "Analyzing..." : "Analyze with AI"}
                </Button>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
                <div className="space-y-4">
                  {selectedConversation.messages.map((message) => {
                    const isClient = message.senderRole === "Client";
                    return (
                      <div
                        key={message.id}
                        className={`flex items-start gap-3 ${isClient ? "" : "flex-row-reverse"}`}
                        data-testid={`message-${message.id}`}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className={isClient ? "bg-primary/10" : "bg-accent"}>
                            {isClient ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`flex-1 max-w-[70%] ${isClient ? "" : "flex flex-col items-end"}`}>
                          <div
                            className={`rounded-lg p-3 ${
                              isClient 
                                ? "bg-muted" 
                                : "bg-primary text-primary-foreground"
                            }`}
                          >
                            <p className="text-sm">{message.message}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-1 px-1">
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(message.createdAt), "h:mm a")}
                            </p>
                            {!isClient && message.isRead === "true" && (
                              <CheckCheck className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Message Input */}
              <div className="p-4 border-t">
                <div className="flex items-end gap-2">
                  <Textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Type your message..."
                    className="min-h-[60px] resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    data-testid="textarea-message"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!messageText.trim() || sendMessageMutation.isPending}
                    size="icon"
                    className="h-[60px] w-[60px]"
                    data-testid="button-send-message"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Select a conversation to start messaging</p>
              </div>
            </div>
          )}
        </div>

        {/* AI Analysis Panel */}
        {selectedConversation && (
          <div className="w-96 border-l flex flex-col">
            <div className="p-4 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                AI Insights
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Conversation analysis and recommendations
              </p>
            </div>
            <ScrollArea className="flex-1 p-4">
              {aiAnalysis ? (
                <div className="space-y-4">
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-primary" />
                        Analysis
                      </h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{aiAnalysis}</p>
                    </CardContent>
                  </Card>
                  <Button className="w-full" variant="outline" data-testid="button-create-recommendation">
                    <Lightbulb className="h-4 w-4 mr-2" />
                    Create Recommendation
                  </Button>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Click "Analyze with AI" to get insights</p>
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>
    </AgencyLayout>
  );
}
