import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Lightbulb, ThumbsUp, ThumbsDown, MessageSquare, CheckCircle, TrendingUp, TrendingDown, MousePointerClick, BarChart } from "lucide-react";
import { InitiativeWithClient } from "@shared/schema";
import { format } from "date-fns";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Helper function to get an icon for a given metric
const getMetricIcon = (metric: string | null) => {
  if (!metric) return <BarChart className="h-6 w-6 text-primary" />;
  const lowerMetric = metric.toLowerCase();
  if (lowerMetric.includes('ctr') || lowerMetric.includes('rate')) return <TrendingUp className="h-6 w-6 text-primary" />;
  if (lowerMetric.includes('clicks')) return <MousePointerClick className="h-6 w-6 text-primary" />;
  if (lowerMetric.includes('position')) return <TrendingDown className="h-6 w-6 text-destructive" />;
  return <BarChart className="h-6 w-6 text-primary" />;
};

export default function Recommendations() {
  const { data: initiatives = [], isLoading } = useQuery<InitiativeWithClient[]>({
    queryKey: ["/api/client/initiatives"],
  });

  const { toast } = useToast();
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseType, setResponseType] = useState<"approved" | "rejected" | "discussing" | null>(null);
  const [feedback, setFeedback] = useState("");

  const respondMutation = useMutation({
    mutationFn: async (data: { id: string; response: string; feedback?: string }) => {
      return await apiRequest("POST", `/api/initiatives/${data.id}/respond`, {
        response: data.response,
        feedback: data.feedback
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/initiatives"] });
      setRespondingId(null);
      setResponseType(null);
      setFeedback("");
      toast({
        title: "Response recorded",
        description: "Your feedback has been shared with your account manager.",
      });
    },
  });

  const openResponseDialog = (id: string, type: "approved" | "rejected" | "discussing") => {
    setRespondingId(id);
    setResponseType(type);
    setFeedback("");
  };

  const handleSubmitResponse = () => {
    if (!respondingId || !responseType) return;
    
    respondMutation.mutate({
      id: respondingId,
      response: responseType,
      feedback: feedback.trim() || undefined
    });
  };

  const getDialogTitle = () => {
    switch (responseType) {
      case "approved": return "Approve Recommendation";
      case "rejected": return "Reject Recommendation";
      case "discussing": return "Discuss Recommendation";
      default: return "Respond to Recommendation";
    }
  };

  const getDialogDescription = () => {
    switch (responseType) {
      case "approved": return "Confirm your approval. You can add any additional comments.";
      case "rejected": return "Please explain why you're rejecting this recommendation.";
      case "discussing": return "Share your questions or concerns to discuss with your account manager.";
      default: return "";
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "Approved": return "default";
      case "Rejected": return "destructive";
      case "Discussing": return "outline";
      case "Awaiting Approval": return "secondary";
      case "Sent": return "secondary";
      default: return "outline";
    }
  };

  const canRespond = (init: InitiativeWithClient) => {
    return init.sentToClient === "true" && 
           init.clientResponse === "pending" && 
           init.status === "Awaiting Approval";
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-recommendations">Recommendations</h1>
        <p className="text-muted-foreground mt-1">AI-powered insights and suggestions for your business</p>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Loading initiatives...
            </CardContent>
          </Card>
        ) : initiatives.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No new recommendations available at this time.</p>
            </CardContent>
          </Card>
        ) : (
          initiatives
            .filter(rec => rec.sentToClient === "true")
            .map((recommendation) => (
            <Card key={recommendation.id} data-testid={`recommendation-card-${recommendation.id}`} className="overflow-hidden hover-elevate">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Lightbulb className="h-5 w-5 text-primary" />
                      <span data-testid={`recommendation-title-${recommendation.id}`}>
                        {recommendation.title}
                      </span>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Proposed on {format(new Date(recommendation.createdAt), "MMM d, yyyy")}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusBadgeVariant(recommendation.status)} data-testid={`recommendation-status-${recommendation.id}`}>
                      {recommendation.status}
                    </Badge>
                    {recommendation.clientResponse === "approved" && (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Data-Driven Hook */}
                {recommendation.triggerMetric && recommendation.baselineValue && (
                  <div className="p-4 bg-muted rounded-lg flex items-center gap-4" data-testid={`data-hook-${recommendation.id}`}>
                    {getMetricIcon(recommendation.triggerMetric)}
                    <div>
                      <p className="text-2xl font-bold font-mono">
                        {recommendation.baselineValue}
                        {(recommendation.triggerMetric.toLowerCase().includes('rate') || 
                          recommendation.triggerMetric.toLowerCase().includes('ctr')) && '%'}
                      </p>
                      <p className="text-sm text-muted-foreground">{recommendation.triggerMetric}</p>
                    </div>
                  </div>
                )}
                
                {/* Enhanced Observation with Structured Data */}
                <div>
                  <h4 className="font-semibold mb-3">The Observation</h4>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground" data-testid={`recommendation-observation-${recommendation.id}`}>
                      {recommendation.observation}
                    </p>
                    
                    {/* Structured Observation Insights */}
                    {recommendation.observationInsights && Array.isArray(recommendation.observationInsights) && recommendation.observationInsights.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                        {(recommendation.observationInsights as Array<{label: string; value: string; context?: string}>).map((insight, idx) => (
                          <div 
                            key={idx} 
                            className="bg-muted/50 rounded-lg p-4 border border-border"
                            data-testid={`observation-insight-${recommendation.id}-${idx}`}
                          >
                            <p className="text-xs font-medium text-muted-foreground mb-1">{insight.label}</p>
                            <p className="text-lg font-bold font-mono">{insight.value}</p>
                            {insight.context && (
                              <p className="text-xs text-muted-foreground mt-1">{insight.context}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Our Proposed Action</h4>
                  <p className="text-sm text-muted-foreground mb-3" data-testid={`recommendation-action-${recommendation.id}`}>
                    {recommendation.proposedAction}
                  </p>
                  
                  {/* Action Tasks List */}
                  {recommendation.actionTasks && Array.isArray(recommendation.actionTasks) && recommendation.actionTasks.length > 0 && (
                    <div className="bg-muted/30 rounded-lg p-4 border border-border">
                      <p className="text-xs font-semibold text-muted-foreground mb-3">Implementation Steps</p>
                      <ol className="space-y-2">
                        {(recommendation.actionTasks as string[]).map((task, idx) => (
                          <li 
                            key={idx} 
                            className="text-sm flex gap-3"
                            data-testid={`action-task-${recommendation.id}-${idx}`}
                          >
                            <span className="font-semibold text-primary min-w-[1.5rem]">{idx + 1}.</span>
                            <span className="text-muted-foreground">{task}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
                
                {/* Value Proposition */}
                <div className="pt-4 border-t space-y-3">
                  <div className="flex items-center gap-4 flex-wrap">
                    {recommendation.impact && (
                      <Badge variant="outline" data-testid={`recommendation-impact-${recommendation.id}`}>
                        Impact: {recommendation.impact}
                      </Badge>
                    )}
                  </div>

                  {/* Only show pricing for initiatives awaiting client approval */}
                  {recommendation.status === "Awaiting Approval" && (
                    <>
                      {recommendation.billingType === "hours" && recommendation.estimatedHours ? (
                        <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">Estimated Time</span>
                            <span className="text-sm font-mono">{recommendation.estimatedHours} Retainer Hours</span>
                          </div>
                          <p className="text-xs text-muted-foreground" data-testid={`recommendation-billing-info-${recommendation.id}`}>
                            Upon approval, {recommendation.estimatedHours} hours will be deducted from your monthly retainer.
                          </p>
                        </div>
                      ) : recommendation.cost ? (
                        <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">Estimated Cost</span>
                            <span className="text-sm font-mono">${recommendation.cost}</span>
                          </div>
                          <p className="text-xs text-muted-foreground" data-testid={`recommendation-billing-info-${recommendation.id}`}>
                            Upon approval, this will generate an invoice for ${recommendation.cost}.
                          </p>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>

                {canRespond(recommendation) && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-3">What would you like to do?</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Dialog open={respondingId === recommendation.id && responseType === "approved"} onOpenChange={(open) => !open && setRespondingId(null)}>
                        <DialogTrigger asChild>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => openResponseDialog(recommendation.id, "approved")}
                            data-testid={`button-approve-${recommendation.id}`}
                          >
                            <ThumbsUp className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{getDialogTitle()}</DialogTitle>
                            <DialogDescription>{getDialogDescription()}</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 mt-4">
                            <div>
                              <Label htmlFor="feedback">Additional Comments (Optional)</Label>
                              <Textarea
                                id="feedback"
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                placeholder="Any additional thoughts or comments..."
                                rows={4}
                                data-testid="textarea-feedback"
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" onClick={() => setRespondingId(null)}>
                                Cancel
                              </Button>
                              <Button
                                onClick={handleSubmitResponse}
                                disabled={respondMutation.isPending}
                                data-testid="button-submit-response"
                              >
                                {respondMutation.isPending ? "Submitting..." : "Submit Response"}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Dialog open={respondingId === recommendation.id && responseType === "discussing"} onOpenChange={(open) => !open && setRespondingId(null)}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openResponseDialog(recommendation.id, "discussing")}
                            data-testid={`button-discuss-${recommendation.id}`}
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Discuss
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{getDialogTitle()}</DialogTitle>
                            <DialogDescription>{getDialogDescription()}</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 mt-4">
                            <div>
                              <Label htmlFor="feedback-discuss">Your Questions or Concerns</Label>
                              <Textarea
                                id="feedback-discuss"
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                placeholder="What would you like to discuss?"
                                rows={4}
                                data-testid="textarea-feedback"
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" onClick={() => setRespondingId(null)}>
                                Cancel
                              </Button>
                              <Button
                                onClick={handleSubmitResponse}
                                disabled={respondMutation.isPending}
                                data-testid="button-submit-response"
                              >
                                {respondMutation.isPending ? "Submitting..." : "Submit Response"}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Dialog open={respondingId === recommendation.id && responseType === "rejected"} onOpenChange={(open) => !open && setRespondingId(null)}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openResponseDialog(recommendation.id, "rejected")}
                            data-testid={`button-reject-${recommendation.id}`}
                          >
                            <ThumbsDown className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{getDialogTitle()}</DialogTitle>
                            <DialogDescription>{getDialogDescription()}</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 mt-4">
                            <div>
                              <Label htmlFor="feedback-reject">Reason for Rejection</Label>
                              <Textarea
                                id="feedback-reject"
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                placeholder="Please explain why you're rejecting this..."
                                rows={4}
                                data-testid="textarea-feedback"
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" onClick={() => setRespondingId(null)}>
                                Cancel
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={handleSubmitResponse}
                                disabled={respondMutation.isPending}
                                data-testid="button-submit-response"
                              >
                                {respondMutation.isPending ? "Submitting..." : "Submit Response"}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                )}

                {recommendation.clientFeedback && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-1">Your Feedback</p>
                    <p className="text-sm text-muted-foreground">{recommendation.clientFeedback}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
