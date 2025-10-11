import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Loader2, ThumbsUp, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getUserRole } from "@/lib/auth";

interface AIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  contextData: any;
  initialQuestion: string;
}

interface AIAnalysisResult {
  title: string;
  observation: string;
  proposedAction: string;
  impact: "High" | "Medium" | "Low";
  estimatedCost: number;
  triggerMetric: string;
  baselineValue: number;
}

export function AIChatModal({ isOpen, onClose, contextData, initialQuestion }: AIChatModalProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [question, setQuestion] = useState(initialQuestion);
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const userRole = getUserRole();

  const analyzeMutation = useMutation({
    mutationFn: (userQuestion: string) => 
      apiRequest("POST", "/api/ai/analyze-data", { contextData, question: userQuestion }).then(res => res.json()),
    onSuccess: (data: AIAnalysisResult) => {
      setAnalysis(data);
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const requestActionMutation = useMutation({
    mutationFn: (recommendation: AIAnalysisResult) => 
      apiRequest("POST", "/api/ai/request-action", { 
        ...recommendation, 
        clientId: contextData?.clientId // Include clientId for Admin/Staff users
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/initiatives"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agency/recommendations"] });
      toast({
        title: "Action Requested!",
        description: "Your request has been sent to the agency for review. Redirecting to Recommendations page...",
      });
      setTimeout(() => {
        onClose();
        setLocation("/client/recommendations");
      }, 1500);
    },
    onError: (error: Error) => {
      toast({
        title: "Request Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAsk = () => {
    if (!question.trim()) return;
    setAnalysis(null);
    analyzeMutation.mutate(question);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" data-testid="dialog-ai-chat">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Ask AI about your Data
          </DialogTitle>
          <DialogDescription>
            Get instant insights and actionable recommendations based on your performance metrics.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="ai-question">Your Question</Label>
            <Textarea
              id="ai-question"
              data-testid="input-ai-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question about your data..."
              rows={3}
              className="mt-1"
            />
          </div>
          <Button 
            onClick={handleAsk} 
            disabled={analyzeMutation.isPending}
            data-testid="button-ask-question"
          >
            {analyzeMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {analyzeMutation.isPending ? "Analyzing..." : "Ask Question"}
          </Button>

          {analysis && (
            <div className="space-y-4 pt-4 border-t" data-testid="container-ai-analysis">
              <h3 className="font-semibold text-lg" data-testid="text-analysis-title">{analysis.title}</h3>
              <div>
                <h4 className="font-medium text-sm mb-1">Observation</h4>
                <p className="text-sm text-muted-foreground" data-testid="text-analysis-observation">{analysis.observation}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-1">Proposed Action</h4>
                <p className="text-sm text-muted-foreground" data-testid="text-analysis-action">{analysis.proposedAction}</p>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <Badge variant="secondary" data-testid="badge-impact">Impact: {analysis.impact}</Badge>
                <Badge variant="secondary" data-testid="badge-cost">Cost: ${analysis.estimatedCost.toLocaleString()}</Badge>
                <Badge variant="secondary" data-testid="badge-trigger-metric">Metric: {analysis.triggerMetric}</Badge>
                <Badge variant="secondary" data-testid="badge-baseline-value">Baseline: {analysis.baselineValue.toLocaleString()}</Badge>
              </div>
            </div>
          )}
        </div>

        {analysis && (
          <DialogFooter className="border-t pt-4">
            <div className="flex w-full justify-between items-center gap-2">
              <p className="text-sm text-muted-foreground">
                {requestActionMutation.isPending 
                  ? "Submitting your request..." 
                  : requestActionMutation.isSuccess
                  ? "Success! Redirecting..."
                  : "Happy with this suggestion?"}
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    onClose();
                    // Admin/Staff go to agency messages, Client goes to support
                    if (userRole === "Admin" || userRole === "Staff") {
                      setLocation('/agency/messages');
                    } else {
                      setLocation('/client/support');
                    }
                  }}
                  disabled={requestActionMutation.isPending || requestActionMutation.isSuccess}
                  data-testid="button-discuss-am"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {userRole === "Admin" || userRole === "Staff" ? "Chat with Client" : "Discuss with My AM"}
                </Button>
                <Button 
                  size="sm"
                  onClick={() => requestActionMutation.mutate(analysis)}
                  disabled={requestActionMutation.isPending || requestActionMutation.isSuccess}
                  data-testid="button-request-action"
                >
                  {requestActionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <ThumbsUp className="h-4 w-4 mr-2" />
                  Request Action on This
                </Button>
              </div>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
