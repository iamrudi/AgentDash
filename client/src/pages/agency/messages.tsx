import { useQuery, useMutation } from "@tanstack/react-query";
import { AgencyLayout } from "@/components/agency-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Plus } from "lucide-react";
import { ClientMessage, Client } from "@shared/schema";
import { format } from "date-fns";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function AgencyMessagesPage() {
  const { data: messages } = useQuery<ClientMessage[]>({
    queryKey: ["/api/agency/messages"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/agency/clients"],
  });

  const [selectedMessage, setSelectedMessage] = useState<ClientMessage | null>(null);
  const [replyText, setReplyText] = useState("");
  const { toast } = useToast();

  const replyMutation = useMutation({
    mutationFn: async (data: { clientId: string; message: string }) => {
      return await apiRequest("/api/client/messages", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/messages"] });
      setReplyText("");
      setSelectedMessage(null);
      toast({
        title: "Reply sent",
        description: "Your message has been sent to the client.",
      });
    },
  });

  const handleReply = () => {
    if (!selectedMessage || !replyText.trim()) return;
    replyMutation.mutate({
      clientId: selectedMessage.clientId,
      message: replyText,
    });
  };

  const unreadCount = messages?.filter(m => m.isRead === "false" && m.senderRole === "Client").length || 0;

  return (
    <AgencyLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Client Messages</h1>
            <p className="text-muted-foreground">
              Manage and respond to client communications
            </p>
          </div>
          <Badge variant="secondary" className="text-lg px-4 py-2">
            {unreadCount} Unread
          </Badge>
        </div>

        <Card>
          <CardContent className="p-0">
            {!messages || messages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">No messages yet</p>
              </div>
            ) : (
              <div className="divide-y">
                {messages.map((message) => {
                  const client = clients?.find(c => c.id === message.clientId);
                  return (
                    <div
                      key={message.id}
                      className={`p-4 ${message.isRead === "false" && message.senderRole === "Client" ? "bg-muted/50" : ""}`}
                      data-testid={`message-item-${message.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="font-semibold">{client?.companyName || "Unknown Client"}</p>
                            <Badge variant={message.senderRole === "Client" ? "default" : "outline"} className="text-xs">
                              {message.senderRole}
                            </Badge>
                            {message.isRead === "false" && message.senderRole === "Client" && (
                              <Badge variant="secondary" className="text-xs">New</Badge>
                            )}
                          </div>
                          <p className="text-sm mb-2">{message.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(message.createdAt), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedMessage(message)}
                                data-testid={`button-reply-${message.id}`}
                              >
                                <Send className="h-4 w-4 mr-1" />
                                Reply
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Reply to {client?.companyName}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 mt-4">
                                <div className="p-3 bg-muted rounded-md">
                                  <p className="text-sm text-muted-foreground mb-1">Original message:</p>
                                  <p className="text-sm">{message.message}</p>
                                </div>
                                <Textarea
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  placeholder="Type your reply here..."
                                  rows={4}
                                  data-testid="textarea-reply"
                                />
                                <div className="flex justify-end gap-2">
                                  <Button
                                    onClick={handleReply}
                                    disabled={!replyText.trim() || replyMutation.isPending}
                                    data-testid="button-send-reply"
                                  >
                                    <Send className="h-4 w-4 mr-1" />
                                    Send Reply
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Button variant="outline" size="sm" data-testid={`button-create-task-${message.id}`}>
                            <Plus className="h-4 w-4 mr-1" />
                            Create Task
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AgencyLayout>
  );
}
