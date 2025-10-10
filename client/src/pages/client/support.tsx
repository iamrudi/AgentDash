import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle, Mail, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ClientMessage } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Support() {
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  const { data: messages = [], isLoading } = useQuery<ClientMessage[]>({
    queryKey: ["/api/client/messages"],
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageText: string) => {
      return await apiRequest("POST", "/api/client/messages", { message: messageText });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/messages"] });
      setMessage("");
      toast({
        title: "Message Sent",
        description: "Your message has been sent to your account manager",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!message.trim()) {
      toast({
        title: "Empty Message",
        description: "Please enter a message before sending",
        variant: "destructive",
      });
      return;
    }
    sendMessageMutation.mutate(message);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-support">Chat with Account Manager</h1>
        <p className="text-muted-foreground mt-1">Send messages to your dedicated account manager</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chat Interface */}
        <div className="lg:col-span-2">
          <Card data-testid="card-chat-interface">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Message Your Account Manager
              </CardTitle>
              <CardDescription>Get personalized support and guidance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Message History */}
              <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                {isLoading ? (
                  <div className="text-center text-muted-foreground">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No messages yet. Start a conversation with your account manager!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.senderRole === "Client" ? "justify-end" : "justify-start"}`}
                        data-testid={`message-${msg.id}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${
                            msg.senderRole === "Client"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap" data-testid={`message-text-${msg.id}`}>
                            {msg.message}
                          </p>
                          <p className="text-xs mt-1 opacity-70">
                            {format(new Date(msg.createdAt), "MMM d, h:mm a")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Message Input */}
              <div className="space-y-2">
                <Textarea
                  placeholder="Type your message here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="min-h-[100px]"
                  data-testid="input-message"
                />
                <div className="flex justify-end">
                  <Button
                    onClick={handleSendMessage}
                    disabled={sendMessageMutation.isPending || !message.trim()}
                    data-testid="button-send-message"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {sendMessageMutation.isPending ? "Sending..." : "Send Message"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contact Info */}
        <div className="space-y-4">
          <Card data-testid="card-contact-email">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4" />
                Email Support
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                For urgent matters, email us directly
              </p>
              <Button variant="outline" className="w-full" data-testid="button-email-support">
                <Mail className="h-4 w-4 mr-2" />
                support@agency.com
              </Button>
            </CardContent>
          </Card>

          <Card data-testid="card-faq">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <HelpCircle className="h-4 w-4" />
                Quick Help
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h4 className="font-semibold text-sm mb-1">Response Time</h4>
                <p className="text-sm text-muted-foreground">
                  Your account manager typically responds within 24 hours on business days.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-1">Business Hours</h4>
                <p className="text-sm text-muted-foreground">
                  Monday - Friday, 9am - 5pm EST
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
